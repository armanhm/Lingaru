# Memory Layer -- Phase B: Chat Integration + Auto-Extraction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the memory layer into the assistant chat flow. Every text-chat turn now prepends a learner-context block to the system prompt, and after each turn a cheap second LLM call detects "remember X" intent and auto-saves notes. The frontend renders an inline "Saved to memory" chip and a small "N notes active" indicator near the agent selector.

**Architecture:** New `backend/services/memory/` package with two pure-ish functions (`assemble_user_context` for read, `maybe_extract_note` for write). `ChatView` calls them at fixed seams. Frontend reads a new `memory_saved` field on the chat response. Behind a `LINGARU_MEMORY_ENABLED` env flag; defaults to off so deploying Phase B does not flip behaviour by surprise.

**Tech Stack:** Django 5.1, DRF, pytest, requests-mock, React 18, Tailwind. Reuses the existing `ProviderRouter` pattern (`backend/services/llm/`) and the existing JSON-salvage helper in `apps/assistant/blocks.py`.

**Spec:** [`docs/superpowers/specs/2026-05-17-assistant-memory-layer-design.md`](../specs/2026-05-17-assistant-memory-layer-design.md)
**Phase A plan:** [`2026-05-17-phase18a-memory-backend-and-settings.md`](2026-05-17-phase18a-memory-backend-and-settings.md) (already shipped)

---

## File Structure

**Backend (new):**

- `backend/services/memory/__init__.py` -- exports `assemble_user_context`, `maybe_extract_note`, `is_memory_enabled`
- `backend/services/memory/context.py` -- `assemble_user_context()` and per-section helpers
- `backend/services/memory/extractor.py` -- `maybe_extract_note()` and the daily-cap helper
- `backend/services/memory/prompts.py` -- the extractor prompt template
- `backend/services/memory/tests/__init__.py`
- `backend/services/memory/tests/test_context.py`
- `backend/services/memory/tests/test_extractor.py`

**Backend (modified):**

- `backend/apps/assistant/views.py` -- `ChatView.post` calls memory service at two seams
- `backend/apps/assistant/tests/test_chat_with_memory.py` -- new integration test file (the existing `apps/assistant/tests/` directory already has a structure; this is a sibling)
- `backend/config/settings/base.py` -- read `LINGARU_MEMORY_ENABLED` env var (default `False`)

**Frontend (new):**

- (none -- everything is modifications to existing files)

**Frontend (modified):**

- `frontend/src/pages/Assistant.jsx` -- handle `memory_saved` field, render chip, render "N notes active" indicator
- `frontend/src/api/memory.js` -- add `getMemoryCount()` helper (lean call for the indicator)
- `frontend/src/locales/en.json` -- new `assistant.memory.*` keys
- `frontend/src/locales/fr.json` -- French translations
- `README.md` -- add a new env var `LINGARU_MEMORY_ENABLED` to the env-vars table

---

## Conventions to follow

- **Backend tests:** pytest, `config.settings.test`, factories where useful. Mock the LLM router; never hit real Gemini/Groq in tests.
- **Backend code style:** Ruff lint + format. Run `ruff format . && ruff check .` from `backend/` before committing.
- **Frontend code style:** existing patterns. `useTranslation()` for all user-visible strings. No em-dashes.
- **Commits:** Conventional Commits (`feat(memory): ...`, `test(memory): ...`).
- **Service layer is the only consumer-facing API.** `ChatView` only knows about `assemble_user_context` and `maybe_extract_note`; it doesn't touch `MemoryNote` directly.
- **Defensive defaults.** Memory must never break a chat turn. Every external read in `assemble_user_context` is in its own try/except; the extractor's whole body is in a try/except that always returns `None` on failure.

---

## Task 1: Create the empty `services/memory/` package + feature flag

**Files:**
- Create: `backend/services/memory/__init__.py`
- Create: `backend/services/memory/tests/__init__.py`
- Modify: `backend/config/settings/base.py` -- add `LINGARU_MEMORY_ENABLED`

- [ ] **Step 1: Create the directory and empty files**

```bash
mkdir -p backend/services/memory/tests
touch backend/services/memory/__init__.py
touch backend/services/memory/tests/__init__.py
```

- [ ] **Step 2: Write the `__init__.py` with the feature-flag helper**

`backend/services/memory/__init__.py`:

```python
"""Memory layer for the assistant. Two service functions:

- assemble_user_context(user) -> str
    Read-only. Builds the LEARNER CONTEXT block prepended to the
    system prompt on every text-chat turn.

- maybe_extract_note(user, user_message, assistant_response, message=None)
    Write. Runs a cheap second LLM call after each chat turn; if it
    detects "remember X" intent, saves a MemoryNote with
    source="assistant_detected".

Both functions are no-ops when LINGARU_MEMORY_ENABLED is False. The
REST endpoints in apps/memory still work independently of this flag,
the flag only controls chat-side wiring.
"""

from django.conf import settings


def is_memory_enabled() -> bool:
    """Whether chat-side memory injection and extraction are active."""
    return bool(getattr(settings, "LINGARU_MEMORY_ENABLED", False))


__all__ = ["is_memory_enabled"]
```

- [ ] **Step 3: Add the setting to `base.py`**

In `backend/config/settings/base.py`, find a clean place near where similar feature toggles live (look for any existing `os.environ.get(...)` block, or near `SENTRY_DSN`). Add:

```python
# Phase B chat-memory wiring kill switch. When False (default) the
# /api/memory/ REST endpoints still work as a personal note bank, but
# ChatView does not inject learner context or auto-extract notes. Set
# to "true"/"1" in production to enable.
LINGARU_MEMORY_ENABLED = os.environ.get("LINGARU_MEMORY_ENABLED", "").lower() in ("1", "true", "yes")
```

If `import os` is not already at the top of `base.py`, add it.

- [ ] **Step 4: Smoke-test**

Run from `backend/`:

```bash
DJANGO_SETTINGS_MODULE=config.settings.test python -c "from services.memory import is_memory_enabled; print('enabled:', is_memory_enabled())"
```

Expected: `enabled: False` (test settings don't set the flag).

- [ ] **Step 5: Lint and format**

From `backend/`:

```bash
ruff format services/memory && ruff check services/memory
```

- [ ] **Step 6: Commit**

```bash
git add backend/services/memory/ backend/config/settings/base.py
git commit -m "feat(memory): scaffold services/memory package + LINGARU_MEMORY_ENABLED flag"
```

---

## Task 2: Implement `assemble_user_context` with tests

**Files:**
- Create: `backend/services/memory/tests/test_context.py`
- Create: `backend/services/memory/context.py`

This is the read-only context assembler. It pulls from 6 sources (User profile, MemoryNote goals, MistakeEntry, GrammarMastery, recent activity, MemoryNote preferences/weaknesses/background) and returns a markdown-formatted string. Every section is in its own try/except.

- [ ] **Step 1: Write the failing test**

Create `backend/services/memory/tests/test_context.py`:

```python
"""Tests for assemble_user_context.

Strategy: build a user with realistic signal in every relevant table,
call the assembler, assert the output contains the expected substrings.
We don't pin the exact format string -- only that each section's facts
are present. Then test the defensive paths: brand-new user, individual
section failures.
"""
from unittest import mock

import pytest
from django.contrib.auth import get_user_model

from apps.memory.models import MemoryNote
from services.memory.context import assemble_user_context


User = get_user_model()


@pytest.mark.django_db
def test_brand_new_user_returns_empty_string():
    user = User.objects.create_user(username="newbie", email="n@x.com", password="x")
    assert assemble_user_context(user) == ""


@pytest.mark.django_db
def test_identity_only_user_includes_profile_block():
    user = User.objects.create_user(
        username="ident",
        email="i@x.com",
        password="x",
        target_level="B2",
        proficiency_level="advanced",
        native_language="en",
        daily_goal_minutes=15,
    )
    out = assemble_user_context(user)
    assert "B2" in out
    assert "advanced" in out
    assert "en" in out


@pytest.mark.django_db
def test_goal_notes_appear_under_goals_heading():
    user = User.objects.create_user(username="goalie", email="g@x.com", password="x")
    MemoryNote.objects.create(user=user, content="TCF on June 15", category="goal")
    MemoryNote.objects.create(user=user, content="Pass C1 by end of year", category="goal")
    # An inactive goal note should NOT appear
    MemoryNote.objects.create(user=user, content="old goal", category="goal", is_active=False)

    out = assemble_user_context(user)
    assert "TCF on June 15" in out
    assert "Pass C1 by end of year" in out
    assert "old goal" not in out
    assert "Goals" in out


@pytest.mark.django_db
def test_preference_weakness_background_notes_grouped():
    user = User.objects.create_user(username="prefuser", email="p@x.com", password="x")
    MemoryNote.objects.create(user=user, content="Explain in English first", category="preference")
    MemoryNote.objects.create(user=user, content="Confuse depuis/pendant", category="weakness")
    MemoryNote.objects.create(user=user, content="10 years of Spanish", category="background")

    out = assemble_user_context(user)
    assert "Explain in English first" in out
    assert "Confuse depuis/pendant" in out
    assert "10 years of Spanish" in out


@pytest.mark.django_db
def test_failure_in_one_section_skips_that_section_but_returns_others():
    """If pulling mistakes raises, we should still get identity + notes."""
    user = User.objects.create_user(
        username="resilient",
        email="r@x.com",
        password="x",
        target_level="B1",
    )
    MemoryNote.objects.create(user=user, content="watch French news daily", category="goal")

    # Mock the mistakes section to raise.
    with mock.patch(
        "services.memory.context._fetch_recent_mistakes",
        side_effect=RuntimeError("table missing"),
    ):
        out = assemble_user_context(user)

    assert "B1" in out
    assert "watch French news daily" in out
    # No exception escaped.


@pytest.mark.django_db
def test_total_failure_returns_empty_string():
    """If something blows up at the outer level (e.g. user is None
    somehow, or the User row is mid-deletion), return '' rather than raise."""
    out = assemble_user_context(None)
    assert out == ""


@pytest.mark.django_db
def test_inactive_notes_excluded_for_all_categories():
    user = User.objects.create_user(username="inactive_user", email="ia@x.com", password="x")
    for cat in ("goal", "preference", "background", "weakness", "other"):
        MemoryNote.objects.create(user=user, content=f"inactive {cat}", category=cat, is_active=False)

    out = assemble_user_context(user)
    for cat in ("goal", "preference", "background", "weakness", "other"):
        assert f"inactive {cat}" not in out
```

- [ ] **Step 2: Run the test to verify it fails**

From `backend/`:

```bash
DJANGO_SETTINGS_MODULE=config.settings.test pytest services/memory/tests/test_context.py -v
```

Expected: all tests FAIL with `ModuleNotFoundError: No module named 'services.memory.context'` (or import error).

- [ ] **Step 3: Implement `context.py`**

Create `backend/services/memory/context.py`:

```python
"""Build the LEARNER CONTEXT block prepended to the assistant's system
prompt on every text-chat turn. Read-only.

Resilience: each section is wrapped in its own try/except so a missing
table or schema change in one subsystem cannot kill the chat turn. If
the outer function itself raises, callers receive an empty string and
chat proceeds with the unaugmented system prompt.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from django.utils import timezone

from apps.memory.models import MemoryNote


logger = logging.getLogger(__name__)


def assemble_user_context(user) -> str:
    """Return the LEARNER CONTEXT markdown block for `user`, or '' if
    the user has no signal at all or anything went wrong.
    """
    if user is None or not getattr(user, "is_authenticated", True):
        return ""

    try:
        sections: list[str] = []

        identity = _fetch_identity(user)
        if identity:
            sections.append(identity)

        goals = _fetch_goal_notes(user)
        if goals:
            sections.append(goals)

        mistakes = _fetch_recent_mistakes(user)
        if mistakes:
            sections.append(mistakes)

        weakest = _fetch_weakest_topics(user)
        if weakest:
            sections.append(weakest)

        activity = _fetch_recent_activity(user)
        if activity:
            sections.append(activity)

        pref_weak_bg = _fetch_preference_weakness_background_notes(user)
        if pref_weak_bg:
            sections.append(pref_weak_bg)

        if not sections:
            return ""

        return "## LEARNER CONTEXT\n\n" + "\n\n".join(sections) + "\n"
    except Exception as exc:
        logger.error("assemble_user_context failed for user=%s: %s", getattr(user, "id", None), exc)
        return ""


# -------- Per-section helpers --------
# Each wraps its own try/except. Returns either a markdown chunk or ''.

def _safe(fn):
    """Decorator: wrap a section-builder so it returns '' on any error."""
    def wrapper(user):
        try:
            return fn(user)
        except Exception as exc:
            logger.warning("memory.context.%s failed: %s", fn.__name__, exc)
            return ""
    return wrapper


@_safe
def _fetch_identity(user) -> str:
    parts: list[str] = []
    if getattr(user, "target_level", None):
        parts.append(f"{user.target_level} target")
    if getattr(user, "proficiency_level", None):
        parts.append(str(user.proficiency_level))
    if getattr(user, "mode", None):
        parts.append(f"mode={user.mode}")
    if getattr(user, "native_language", None):
        parts.append(f"native={user.native_language}")
    if getattr(user, "daily_goal_minutes", None):
        parts.append(f"{user.daily_goal_minutes} min/day goal")
    if not parts:
        return ""
    return "**Profile:** " + " . ".join(parts)


@_safe
def _fetch_goal_notes(user) -> str:
    notes = MemoryNote.objects.filter(
        user=user, category="goal", is_active=True
    ).order_by("created_at")
    contents = [n.content for n in notes]
    if not contents:
        return ""
    return "**Goals:**\n" + "\n".join(f"- {c}" for c in contents)


@_safe
def _fetch_recent_mistakes(user) -> str:
    """Top 3 mistake types from the last 7 days, grouped by type."""
    from collections import Counter

    from apps.progress.models import MistakeEntry

    since = timezone.now() - timedelta(days=7)
    recents = MistakeEntry.objects.filter(
        user=user, created_at__gte=since
    ).values_list("mistake_type", flat=True)
    counter = Counter(recents)
    top = counter.most_common(3)
    if not top:
        return ""
    formatted = ", ".join(f"{label} ({count}x)" for label, count in top)
    return f"**Recent mistakes (last 7 days):** {formatted}"


@_safe
def _fetch_weakest_topics(user) -> str:
    """Bottom 3 GrammarMastery rows by mastery_score, only topics the user has touched."""
    from apps.grammar.models import GrammarMastery

    rows = (
        GrammarMastery.objects
        .filter(user=user, attempts__gt=0)
        .select_related("topic")
        .order_by("mastery_score")[:3]
    )
    if not rows:
        return ""
    parts = [f"{r.topic.title} ({int(r.mastery_score)}%)" for r in rows]
    return "**Weakest grammar topics:** " + ", ".join(parts)


@_safe
def _fetch_recent_activity(user) -> str:
    """One-line summary of activity in the last 7 days."""
    from apps.exam_prep.models import ExamSession
    from apps.progress.models import LessonCompletion, SRSCard

    since = timezone.now() - timedelta(days=7)

    lessons = LessonCompletion.objects.filter(user=user, completed_at__gte=since).count()
    mocks = ExamSession.objects.filter(
        user=user, completed_at__gte=since, mode="mock"
    ).count() if hasattr(ExamSession, "mode") else 0
    srs_reviews = SRSCard.objects.filter(
        user=user, last_quality__gt=0, next_review_at__gte=since
    ).count()

    if lessons == 0 and mocks == 0 and srs_reviews == 0:
        return ""

    parts: list[str] = []
    if lessons:
        parts.append(f"{lessons} lesson{'s' if lessons != 1 else ''} completed")
    if mocks:
        parts.append(f"{mocks} mock exam{'s' if mocks != 1 else ''}")
    if srs_reviews:
        parts.append(f"{srs_reviews} SRS review{'s' if srs_reviews != 1 else ''}")

    return "**This week:** " + ", ".join(parts)


@_safe
def _fetch_preference_weakness_background_notes(user) -> str:
    """All active MemoryNote rows in preference/weakness/background, grouped."""
    headings = {
        "preference": "Preferences",
        "weakness": "Weaknesses (user-reported)",
        "background": "Background",
    }
    out_chunks: list[str] = []
    for cat, heading in headings.items():
        contents = list(
            MemoryNote.objects.filter(user=user, category=cat, is_active=True)
            .order_by("created_at")
            .values_list("content", flat=True)
        )
        if not contents:
            continue
        out_chunks.append(f"**{heading}:**\n" + "\n".join(f"- {c}" for c in contents))
    return "\n\n".join(out_chunks)
```

Two implementation notes worth pinning before committing:

- The `_safe` decorator is defined locally and wraps every section-builder. The test `test_failure_in_one_section_skips_that_section_but_returns_others` mocks `_fetch_recent_mistakes` directly, so the decorator must not change the function's `__name__` -- and since this is a plain function decorator (not `functools.wraps`-based), Python's default `wrapper` name leaks. That's fine because the test patches the name `_fetch_recent_mistakes` in the module namespace, not via `__name__` lookup -- it's a substitution at the module level.
- `_fetch_recent_activity` checks `hasattr(ExamSession, "mode")` defensively; that field exists on the model today but the guard means a future schema change can't silently break this section.

- [ ] **Step 4: Run tests to verify they pass**

From `backend/`:

```bash
DJANGO_SETTINGS_MODULE=config.settings.test pytest services/memory/tests/test_context.py -v
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Lint and format**

```bash
ruff format services/memory && ruff check services/memory
```

- [ ] **Step 6: Commit**

```bash
git add backend/services/memory/context.py backend/services/memory/tests/test_context.py
git commit -m "feat(memory): assemble_user_context with per-section error isolation"
```

---

## Task 3: Implement `maybe_extract_note` with tests

**Files:**
- Create: `backend/services/memory/prompts.py`
- Create: `backend/services/memory/extractor.py`
- Create: `backend/services/memory/tests/test_extractor.py`

The extractor runs a cheap second LLM call after each chat turn. It returns a `MemoryNote` or `None`. Always writes a `MemoryExtractionLog` row.

- [ ] **Step 1: Write the prompt template**

Create `backend/services/memory/prompts.py`:

```python
"""LLM prompt for the post-turn memory extractor.

The extractor runs after every text-chat turn. It looks at the user's
message and the assistant's response and decides whether the user
explicitly asked to remember something. Volunteered facts (e.g. "I
love jazz") do NOT qualify, only imperatives like "remember", "save",
"don't forget", "note that".
"""

EXTRACTOR_SYSTEM_PROMPT = """\
You are a memory extractor. Given a recent chat turn, decide whether the
user is asking the system to remember a fact about themselves.

Return strict JSON, no markdown fences, no commentary:

{
  "remember": true | false,
  "content": "<the fact, third-person, single sentence>" | null,
  "category": "goal" | "preference" | "background" | "weakness" | "other" | null
}

Rules:
- Only return remember=true if the user explicitly asks to remember,
  save, note, or "don't forget". Volunteered facts ("I love jazz") do
  NOT qualify, too noisy.
- Strip the imperative. "Remember I'm prepping for TCF June 15" becomes
  content="User is preparing for the TCF exam on June 15".
- One fact per turn. If multiple, pick the most specific.
- If unsure, return remember=false.
"""


def build_extractor_user_message(user_message: str, assistant_response: str) -> str:
    """The user-role message we feed alongside EXTRACTOR_SYSTEM_PROMPT.

    Assistant response is truncated to 400 chars, the extractor only
    needs enough context to disambiguate, not the whole reply.
    """
    return (
        f'Recent user message:\n"""\n{user_message}\n"""\n\n'
        f'Assistant response (for context only, do not extract facts from it):\n"""\n'
        f"{assistant_response[:400]}\n"
        f'"""'
    )
```

- [ ] **Step 2: Write the failing test**

Create `backend/services/memory/tests/test_extractor.py`:

```python
"""Tests for maybe_extract_note. The LLM router is mocked end-to-end;
we never make a real network call."""
from datetime import timedelta
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.memory.models import MemoryExtractionLog, MemoryNote
from services.llm.base import LLMResponse
from services.memory.extractor import (
    DAILY_EXTRACTION_CAP,
    maybe_extract_note,
)


User = get_user_model()


def _llm_response(text: str) -> LLMResponse:
    return LLMResponse(content=text, provider="groq", tokens_used=42)


@pytest.fixture
def user(db):
    return User.objects.create_user(username="alice", email="a@x.com", password="x")


@pytest.mark.django_db
def test_explicit_remember_saves_note_and_log(user):
    """LLM returns remember=true: a note is created, a log row is written."""
    fake_router = mock.Mock()
    fake_router.generate.return_value = _llm_response(
        '{"remember": true, "content": "User is preparing for the TCF on June 15", "category": "goal"}'
    )

    with mock.patch("services.memory.extractor._build_router", return_value=fake_router):
        note = maybe_extract_note(
            user=user,
            user_message="Remember I'm prepping for TCF June 15",
            assistant_response="Got it, I'll keep that in mind.",
        )

    assert note is not None
    assert note.content == "User is preparing for the TCF on June 15"
    assert note.category == "goal"
    assert note.source == "assistant_detected"
    assert note.is_active is True

    log = MemoryExtractionLog.objects.get(user=user)
    assert log.extracted is True
    assert log.note == note


@pytest.mark.django_db
def test_volunteered_fact_returns_none_and_logs(user):
    """LLM returns remember=false: no note, but a log row is still written."""
    fake_router = mock.Mock()
    fake_router.generate.return_value = _llm_response('{"remember": false, "content": null, "category": null}')

    with mock.patch("services.memory.extractor._build_router", return_value=fake_router):
        note = maybe_extract_note(
            user=user,
            user_message="I love jazz, by the way.",
            assistant_response="Cool, what's your favorite album?",
        )

    assert note is None
    assert MemoryNote.objects.filter(user=user).count() == 0
    log = MemoryExtractionLog.objects.get(user=user)
    assert log.extracted is False


@pytest.mark.django_db
def test_malformed_json_returns_none_and_logs(user):
    fake_router = mock.Mock()
    fake_router.generate.return_value = _llm_response("this is not json")

    with mock.patch("services.memory.extractor._build_router", return_value=fake_router):
        note = maybe_extract_note(
            user=user,
            user_message="remember something",
            assistant_response="ok",
        )

    assert note is None
    log = MemoryExtractionLog.objects.get(user=user)
    assert log.extracted is False
    assert "this is not json" in log.raw_output


@pytest.mark.django_db
def test_router_failure_returns_none_and_logs(user):
    fake_router = mock.Mock()
    fake_router.generate.side_effect = RuntimeError("groq exploded")

    with mock.patch("services.memory.extractor._build_router", return_value=fake_router):
        note = maybe_extract_note(
            user=user,
            user_message="remember something",
            assistant_response="ok",
        )

    assert note is None
    log = MemoryExtractionLog.objects.get(user=user)
    assert log.extracted is False
    assert "groq exploded" in log.raw_output


@pytest.mark.django_db
def test_daily_cap_prevents_new_extractions(user):
    """Once DAILY_EXTRACTION_CAP successful extractions in the last 24h
    exist, no new ones are created. A log row is still written to record
    that the cap blocked us."""
    for i in range(DAILY_EXTRACTION_CAP):
        MemoryExtractionLog.objects.create(user=user, extracted=True, raw_output="prior")

    fake_router = mock.Mock()
    fake_router.generate.return_value = _llm_response(
        '{"remember": true, "content": "should not be saved", "category": "other"}'
    )

    with mock.patch("services.memory.extractor._build_router", return_value=fake_router):
        note = maybe_extract_note(
            user=user,
            user_message="remember X",
            assistant_response="ok",
        )

    assert note is None
    # The router was not called (cap short-circuits before the LLM call)
    fake_router.generate.assert_not_called()
    # Cap-block is recorded
    cap_log = MemoryExtractionLog.objects.filter(extracted=False, user=user).last()
    assert cap_log is not None
    assert "cap" in cap_log.raw_output.lower()


@pytest.mark.django_db
def test_cap_only_counts_last_24h(user):
    """Old extractions outside the 24h window do not count against the cap."""
    old_time = timezone.now() - timedelta(hours=25)
    for _ in range(DAILY_EXTRACTION_CAP + 5):
        log = MemoryExtractionLog.objects.create(user=user, extracted=True, raw_output="ancient")
        MemoryExtractionLog.objects.filter(pk=log.pk).update(created_at=old_time)

    fake_router = mock.Mock()
    fake_router.generate.return_value = _llm_response(
        '{"remember": true, "content": "User likes mornings", "category": "preference"}'
    )

    with mock.patch("services.memory.extractor._build_router", return_value=fake_router):
        note = maybe_extract_note(
            user=user,
            user_message="remember I prefer mornings",
            assistant_response="ok",
        )

    assert note is not None


@pytest.mark.django_db
def test_remember_true_but_missing_content_returns_none(user):
    """Defensive: LLM said remember=true but didn't give us content. Skip."""
    fake_router = mock.Mock()
    fake_router.generate.return_value = _llm_response(
        '{"remember": true, "content": null, "category": "goal"}'
    )

    with mock.patch("services.memory.extractor._build_router", return_value=fake_router):
        note = maybe_extract_note(
            user=user,
            user_message="remember",
            assistant_response="ok",
        )

    assert note is None
    log = MemoryExtractionLog.objects.get(user=user)
    assert log.extracted is False
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
DJANGO_SETTINGS_MODULE=config.settings.test pytest services/memory/tests/test_extractor.py -v
```

Expected: import errors / module not found -- `services.memory.extractor` doesn't exist yet.

- [ ] **Step 4: Implement `extractor.py`**

Create `backend/services/memory/extractor.py`:

```python
"""Post-turn memory extractor. Detects 'remember X' intent in a chat
turn and persists a MemoryNote with source='assistant_detected'.

Runs SYNCHRONOUSLY in the chat request. Adds ~300-500ms per turn.
Never raises, always writes a MemoryExtractionLog audit row.

Routing: uses a dedicated ProviderRouter instance with Groq as primary
(faster + cheaper for this thin classification task) and Gemini as
fallback. Not the same router instance the chat view uses.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.memory.models import MemoryExtractionLog, MemoryNote
from services.llm.base import BaseProvider
from services.llm.gemini import GeminiProvider
from services.llm.groq_provider import GroqProvider
from services.llm.router import ProviderRouter

from .prompts import EXTRACTOR_SYSTEM_PROMPT, build_extractor_user_message


logger = logging.getLogger(__name__)

DAILY_EXTRACTION_CAP = 3
VALID_CATEGORIES = {"goal", "preference", "background", "weakness", "other"}


def maybe_extract_note(
    *,
    user,
    user_message: str,
    assistant_response: str,
    message=None,
) -> MemoryNote | None:
    """Try to extract a memory-worthy fact from the just-finished turn.

    Returns the saved MemoryNote on success, None otherwise. Always
    writes a MemoryExtractionLog row (extracted=True if a note was
    created, extracted=False otherwise with the failure reason in
    raw_output).

    Never raises.
    """
    # Cap check first: do not even make the LLM call if we are over.
    cutoff = timezone.now() - timedelta(hours=24)
    recent_success_count = MemoryExtractionLog.objects.filter(
        user=user, extracted=True, created_at__gte=cutoff,
    ).count()
    if recent_success_count >= DAILY_EXTRACTION_CAP:
        MemoryExtractionLog.objects.create(
            user=user,
            message=message,
            extracted=False,
            raw_output=f"cap reached: {recent_success_count} >= {DAILY_EXTRACTION_CAP} in last 24h",
        )
        return None

    raw_output = ""
    try:
        router = _build_router()
        response = router.generate(
            messages=[
                {
                    "role": "user",
                    "content": build_extractor_user_message(user_message, assistant_response),
                }
            ],
            system_prompt=EXTRACTOR_SYSTEM_PROMPT,
        )
        raw_output = response.content
        payload = _parse_json(raw_output)
    except Exception as exc:
        MemoryExtractionLog.objects.create(
            user=user,
            message=message,
            extracted=False,
            raw_output=f"{type(exc).__name__}: {exc}\n---raw---\n{raw_output[:1000]}",
        )
        return None

    if not payload.get("remember"):
        MemoryExtractionLog.objects.create(
            user=user,
            message=message,
            extracted=False,
            raw_output=raw_output[:2000],
        )
        return None

    content = (payload.get("content") or "").strip()
    if not content:
        MemoryExtractionLog.objects.create(
            user=user,
            message=message,
            extracted=False,
            raw_output=f"remember=true but content empty\n{raw_output[:1000]}",
        )
        return None

    category = payload.get("category")
    if category not in VALID_CATEGORIES:
        category = "other"

    # Cap content to the same limit the serializer enforces.
    content = content[:500]

    note = MemoryNote.objects.create(
        user=user,
        content=content,
        category=category,
        source="assistant_detected",
    )
    MemoryExtractionLog.objects.create(
        user=user,
        message=message,
        note=note,
        extracted=True,
        raw_output=raw_output[:2000],
    )
    return note


# -------- helpers --------

def _build_router() -> ProviderRouter:
    """Dedicated router for the extractor. Groq primary, Gemini fallback.

    Not the same as services.llm.factory.create_llm_router() which is
    Gemini-primary, the chat path. The extractor is a thin
    classification call; we want it fast and cheap.
    """
    primary: BaseProvider | None = None
    fallback: BaseProvider | None = None
    if settings.GROQ_API_KEY:
        primary = GroqProvider(api_key=settings.GROQ_API_KEY, model=settings.GROQ_MODEL)
    if settings.GEMINI_API_KEY:
        if primary is None:
            primary = GeminiProvider(api_key=settings.GEMINI_API_KEY, model=settings.GEMINI_MODEL)
        else:
            fallback = GeminiProvider(api_key=settings.GEMINI_API_KEY, model=settings.GEMINI_MODEL)
    if primary is None:
        raise RuntimeError("No LLM keys configured; memory extractor cannot run")
    return ProviderRouter(primary=primary, fallback=fallback)


_FENCE_RE = re.compile(r"```(?:json)?\s*(.+?)\s*```", re.DOTALL)


def _parse_json(text: str) -> dict:
    """Parse the extractor LLM output. Tolerate markdown fences.

    Falls back to a permissive substring scan for the first {...}
    block if the model emitted commentary before/after the JSON.
    """
    text = text.strip()

    fence_match = _FENCE_RE.search(text)
    if fence_match:
        candidate = fence_match.group(1).strip()
        return json.loads(candidate)

    if text.startswith("{") and text.endswith("}"):
        return json.loads(text)

    # Permissive scan
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        return json.loads(text[start : end + 1])

    raise ValueError("no JSON object found in extractor output")
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
DJANGO_SETTINGS_MODULE=config.settings.test pytest services/memory/tests/test_extractor.py -v
```

Expected: all 7 tests PASS.

- [ ] **Step 6: Lint and format**

```bash
ruff format services/memory && ruff check services/memory
```

- [ ] **Step 7: Commit**

```bash
git add backend/services/memory/extractor.py backend/services/memory/prompts.py backend/services/memory/tests/test_extractor.py
git commit -m "feat(memory): maybe_extract_note with daily cap, JSON salvage, audit log"
```

---

## Task 4: Export the public API from `services/memory/__init__.py`

**Files:**
- Modify: `backend/services/memory/__init__.py`

Now that `context.py` and `extractor.py` exist, the package's `__init__.py` should re-export them for clean import sites.

- [ ] **Step 1: Update the `__init__.py`**

Replace the contents of `backend/services/memory/__init__.py` with:

```python
"""Memory layer for the assistant. Two service functions:

- assemble_user_context(user) -> str
    Read-only. Builds the LEARNER CONTEXT block prepended to the
    system prompt on every text-chat turn.

- maybe_extract_note(user, user_message, assistant_response, message=None)
    Write. Runs a cheap second LLM call after each chat turn; if it
    detects "remember X" intent, saves a MemoryNote with
    source="assistant_detected".

Both functions are no-ops when LINGARU_MEMORY_ENABLED is False. The
REST endpoints in apps/memory still work independently of this flag;
the flag only controls chat-side wiring.
"""
from django.conf import settings

from .context import assemble_user_context
from .extractor import maybe_extract_note


def is_memory_enabled() -> bool:
    """Whether chat-side memory injection and extraction are active."""
    return bool(getattr(settings, "LINGARU_MEMORY_ENABLED", False))


__all__ = ["assemble_user_context", "is_memory_enabled", "maybe_extract_note"]
```

- [ ] **Step 2: Smoke-test the imports**

From `backend/`:

```bash
DJANGO_SETTINGS_MODULE=config.settings.test python -c "from services.memory import assemble_user_context, maybe_extract_note, is_memory_enabled; print('ok')"
```

Expected: `ok`.

- [ ] **Step 3: Lint and format**

```bash
ruff format services/memory && ruff check services/memory
```

- [ ] **Step 4: Commit**

```bash
git add backend/services/memory/__init__.py
git commit -m "feat(memory): export assemble_user_context and maybe_extract_note from the package"
```

---

## Task 5: Integrate memory into `ChatView` with an integration test

**Files:**
- Create: `backend/apps/assistant/tests/test_chat_with_memory.py`
- Modify: `backend/apps/assistant/views.py`

Now we wire the memory service into the chat view. Two seams:

1. **Before LLM call:** prepend `assemble_user_context(user)` to `system_prompt`.
2. **After LLM response saved:** call `maybe_extract_note(...)`, then include `memory_saved` in the response JSON if a note was created.

Both seams are guarded by `is_memory_enabled()`; when the flag is off, nothing changes about the chat flow.

- [ ] **Step 1: Write the failing integration test**

Create `backend/apps/assistant/tests/test_chat_with_memory.py`:

```python
"""Integration tests for ChatView + memory layer.

Asserts the contract:
- When LINGARU_MEMORY_ENABLED is off, chat behaves exactly as before
  (no context injection, no extraction call).
- When on, context is prepended to system prompt AND extractor runs;
  if extractor returns a note, the chat response includes
  memory_saved={id, content, category}.
- An extractor failure does not break the chat turn.
"""
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from apps.memory.models import MemoryNote
from services.llm.base import LLMResponse


User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="alice", email="a@x.com", password="x", target_level="B2"
    )


@pytest.fixture
def authed_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _llm(text):
    return LLMResponse(content=text, provider="gemini", tokens_used=10)


@pytest.mark.django_db
@override_settings(LINGARU_MEMORY_ENABLED=False)
def test_flag_off_does_not_inject_or_extract(authed_client, user):
    """With the flag off, system_prompt is unchanged and extractor never runs."""
    fake_router = mock.Mock()
    fake_router.generate.return_value = _llm("Bonjour!")

    with mock.patch("apps.assistant.views.create_llm_router", return_value=fake_router), \
         mock.patch("services.memory.extractor._build_router") as fake_extractor_router:
        response = authed_client.post(
            "/api/assistant/chat/",
            {"message": "Salut", "mode": "conversation"},
            format="json",
        )

    assert response.status_code == 200
    body = response.json()
    assert "memory_saved" not in body
    # The extractor router should never have been built
    fake_extractor_router.assert_not_called()
    # The system prompt passed to the chat router does NOT contain LEARNER CONTEXT
    _, call_kwargs = fake_router.generate.call_args
    assert "LEARNER CONTEXT" not in call_kwargs["system_prompt"]


@pytest.mark.django_db
@override_settings(LINGARU_MEMORY_ENABLED=True)
def test_flag_on_injects_context_into_system_prompt(authed_client, user):
    """With the flag on and the user having a goal note, the assembled
    LEARNER CONTEXT block should appear in the system prompt sent to the
    chat LLM."""
    MemoryNote.objects.create(user=user, content="Prepping for TCF June 15", category="goal")

    fake_chat_router = mock.Mock()
    fake_chat_router.generate.return_value = _llm("Bonjour!")
    fake_extract_router = mock.Mock()
    fake_extract_router.generate.return_value = _llm('{"remember": false}')

    with mock.patch("apps.assistant.views.create_llm_router", return_value=fake_chat_router), \
         mock.patch("services.memory.extractor._build_router", return_value=fake_extract_router):
        response = authed_client.post(
            "/api/assistant/chat/",
            {"message": "Salut", "mode": "conversation"},
            format="json",
        )

    assert response.status_code == 200
    _, call_kwargs = fake_chat_router.generate.call_args
    assert "LEARNER CONTEXT" in call_kwargs["system_prompt"]
    assert "Prepping for TCF June 15" in call_kwargs["system_prompt"]


@pytest.mark.django_db
@override_settings(LINGARU_MEMORY_ENABLED=True)
def test_extractor_creates_note_returns_memory_saved(authed_client, user):
    """If the extractor's LLM returns remember=true, the chat response
    body must include memory_saved with the new note's id/content/category."""
    fake_chat_router = mock.Mock()
    fake_chat_router.generate.return_value = _llm("Got it.")
    fake_extract_router = mock.Mock()
    fake_extract_router.generate.return_value = _llm(
        '{"remember": true, "content": "User is preparing for the TCF on June 15", "category": "goal"}'
    )

    with mock.patch("apps.assistant.views.create_llm_router", return_value=fake_chat_router), \
         mock.patch("services.memory.extractor._build_router", return_value=fake_extract_router):
        response = authed_client.post(
            "/api/assistant/chat/",
            {"message": "Remember I'm prepping for TCF June 15", "mode": "conversation"},
            format="json",
        )

    assert response.status_code == 200
    body = response.json()
    assert "memory_saved" in body
    assert body["memory_saved"]["category"] == "goal"
    assert body["memory_saved"]["content"] == "User is preparing for the TCF on June 15"
    assert isinstance(body["memory_saved"]["id"], int)
    note = MemoryNote.objects.get(pk=body["memory_saved"]["id"])
    assert note.source == "assistant_detected"


@pytest.mark.django_db
@override_settings(LINGARU_MEMORY_ENABLED=True)
def test_extractor_failure_does_not_break_chat(authed_client, user):
    """If the extractor explodes, the chat response should still be 200
    and `memory_saved` should be absent. The chat reply is intact."""
    fake_chat_router = mock.Mock()
    fake_chat_router.generate.return_value = _llm("Reply intact.")

    with mock.patch("apps.assistant.views.create_llm_router", return_value=fake_chat_router), \
         mock.patch(
             "services.memory.extractor._build_router",
             side_effect=RuntimeError("disaster"),
         ):
        response = authed_client.post(
            "/api/assistant/chat/",
            {"message": "remember X", "mode": "conversation"},
            format="json",
        )

    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "Reply intact."
    assert "memory_saved" not in body


@pytest.mark.django_db
@override_settings(LINGARU_MEMORY_ENABLED=True)
def test_assembler_failure_does_not_break_chat(authed_client, user):
    """If assemble_user_context blows up, the chat turn still succeeds
    with no context injection."""
    fake_chat_router = mock.Mock()
    fake_chat_router.generate.return_value = _llm("Reply intact.")
    fake_extract_router = mock.Mock()
    fake_extract_router.generate.return_value = _llm('{"remember": false}')

    with mock.patch(
        "apps.assistant.views.assemble_user_context",
        side_effect=RuntimeError("assembler died"),
    ), \
         mock.patch("apps.assistant.views.create_llm_router", return_value=fake_chat_router), \
         mock.patch("services.memory.extractor._build_router", return_value=fake_extract_router):
        response = authed_client.post(
            "/api/assistant/chat/",
            {"message": "hello", "mode": "conversation"},
            format="json",
        )

    assert response.status_code == 200
    assert response.json()["reply"] == "Reply intact."
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
DJANGO_SETTINGS_MODULE=config.settings.test pytest apps/assistant/tests/test_chat_with_memory.py -v
```

Expected: failures -- the imports `apps.assistant.views.assemble_user_context` are not present yet, and `memory_saved` is not in the response.

- [ ] **Step 3: Wire memory into `ChatView`**

Edit `backend/apps/assistant/views.py`. Make THREE focused changes; do not touch any other view in the file.

**Change 3a:** Add new imports near the existing imports at the top:

```python
from services.memory import (
    assemble_user_context,
    is_memory_enabled,
    maybe_extract_note,
)
```

**Change 3b:** In `ChatView.post`, find the block that builds the system prompt (around the existing line `system_prompt = SYSTEM_PROMPTS.get(...)`). After the agentic-footer block (the `if getattr(request.user, "mode", None) == "agentic":` block) but BEFORE the RAG block, insert:

```python
        # Memory layer (Phase B): prepend the user's LEARNER CONTEXT block.
        # Defensive: assemble_user_context never raises, returns '' on failure.
        # Gated on LINGARU_MEMORY_ENABLED so deploying this code does not
        # change behaviour for projects that have not opted in.
        if is_memory_enabled():
            learner_context = assemble_user_context(request.user)
            if learner_context:
                system_prompt = f"{learner_context}\n\n{system_prompt}"
```

**Change 3c:** Find the existing `Message.objects.create(... role="assistant" ...)` call that saves the assistant's reply. AFTER that block but BEFORE the gamification block, insert:

```python
        # Memory layer (Phase B): post-turn extraction. Synchronous,
        # ~300-500ms. Never raises -- maybe_extract_note swallows
        # exceptions and writes a MemoryExtractionLog row instead.
        memory_saved = None
        if is_memory_enabled():
            assistant_message = Message.objects.filter(
                conversation=conversation, role="assistant"
            ).order_by("-created_at").first()
            try:
                note = maybe_extract_note(
                    user=request.user,
                    user_message=user_message,
                    assistant_response=prose,
                    message=assistant_message,
                )
            except Exception as exc:
                logger.warning("maybe_extract_note unexpectedly raised: %s", exc)
                note = None
            if note is not None:
                memory_saved = {
                    "id": note.id,
                    "content": note.content,
                    "category": note.category,
                }
```

Then, in the final `return Response({...})` block, add `memory_saved` to the response dict ONLY when it is not None. The final response block becomes:

```python
        response_body = {
            "reply": prose,
            "blocks": blocks,
            "conversation_id": conversation.id,
            "provider": llm_response.provider,
            "tokens_used": llm_response.tokens_used,
            "rag_used": rag_used,
        }
        if memory_saved is not None:
            response_body["memory_saved"] = memory_saved
        return Response(response_body)
```

(Replace the existing `return Response({...})` block with the above. The fields `reply`, `blocks`, `conversation_id`, `provider`, `tokens_used`, `rag_used` are unchanged.)

- [ ] **Step 4: Run the tests to verify they pass**

```bash
DJANGO_SETTINGS_MODULE=config.settings.test pytest apps/assistant/tests/test_chat_with_memory.py -v
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Run the full assistant test suite to confirm nothing regressed**

```bash
DJANGO_SETTINGS_MODULE=config.settings.test pytest apps/assistant/ -v
```

Expected: all existing assistant tests still pass, plus the 5 new ones.

- [ ] **Step 6: Lint and format**

```bash
ruff format apps/assistant services/memory && ruff check apps/assistant services/memory
```

- [ ] **Step 7: Commit**

```bash
git add backend/apps/assistant/views.py backend/apps/assistant/tests/test_chat_with_memory.py
git commit -m "feat(memory): wire ChatView to inject context and auto-extract notes"
```

---

## Task 6: Add `getMemoryCount` helper to the frontend client

**Files:**
- Modify: `frontend/src/api/memory.js`

Phase B's frontend needs a cheap way to count active notes (for the "N notes active" indicator). We could reuse `listMemoryNotes` and `.data.length` but it's nicer to give the indicator a tiny named helper.

- [ ] **Step 1: Append a helper**

Append to `frontend/src/api/memory.js`:

```js
/**
 * Count active notes. The endpoint returns the full list, but the
 * caller (the indicator in Assistant.jsx) only needs the length.
 * Cheap enough to call on Assistant mount; do not call on every keystroke.
 */
export const getMemoryCount = async () => {
  const res = await listMemoryNotes();
  return Array.isArray(res.data) ? res.data.length : 0;
};
```

- [ ] **Step 2: Run lint**

From `frontend/`:

```bash
npm run lint
```

Expected: ESLint exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/memory.js
git commit -m "feat(memory): add getMemoryCount helper for the chat-side indicator"
```

---

## Task 7: Add i18n strings for the chat surfaces

**Files:**
- Modify: `frontend/src/locales/en.json`
- Modify: `frontend/src/locales/fr.json`

- [ ] **Step 1: Add English strings**

In `frontend/src/locales/en.json`, find the top-level `assistant` object. ADD a new `memory` sub-object inside it (preserving everything else):

```json
"memory": {
  "saved": "Saved to memory",
  "undo": "Undo",
  "removed": "Removed from memory",
  "notesActive": "{{count}} note active",
  "notesActive_plural": "{{count}} notes active",
  "manage": "Manage in Settings"
}
```

If there's no top-level `assistant` object yet (unlikely, but possible), inspect the file first; the key MUST go inside the existing `assistant` group or be created at the top level alongside other groups like `settings`.

- [ ] **Step 2: Add French strings**

In `frontend/src/locales/fr.json`, mirror the structure:

```json
"memory": {
  "saved": "Enregistré en mémoire",
  "undo": "Annuler",
  "removed": "Supprimé de la mémoire",
  "notesActive": "{{count}} note active",
  "notesActive_plural": "{{count}} notes actives",
  "manage": "Gérer dans les Réglages"
}
```

- [ ] **Step 3: Verify JSON is valid**

From `frontend/`:

```bash
node -e "JSON.parse(require('fs').readFileSync('src/locales/en.json', 'utf8'))"
node -e "JSON.parse(require('fs').readFileSync('src/locales/fr.json', 'utf8'))"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/locales/en.json frontend/src/locales/fr.json
git commit -m "feat(memory): EN/FR i18n strings for the chat-side memory surfaces"
```

---

## Task 8: Render the "Saved to memory" chip and "N notes active" indicator

**Files:**
- Modify: `frontend/src/pages/Assistant.jsx`

Two additions to the Assistant page:

1. After a chat response with a `memory_saved` field, render a small chip below the assistant bubble: `[icon] Saved to memory: <content> · [Undo]`. Click Undo → DELETE the note, the chip flips to "Removed from memory".
2. Near the agent selector (or wherever a small status row already lives -- the existing header area of the chat surface), show "🧠 N notes active" when `getMemoryCount()` returns ≥ 1. Click → popover with read-only note list + "Manage in Settings" link.

- [ ] **Step 1: Read the file in full**

`Assistant.jsx` is large; read it before making edits.

```bash
wc -l /Users/arman/PycharmProjects/Lingaru/frontend/src/pages/Assistant.jsx
```

Use the Read tool to inspect the relevant sections:
- The state-management hooks (look for the conversation/message state)
- The chat-bubble renderer (look for `ChatBubble` or similar)
- The header / agent selector area near the top of the chat surface

Identify:
- Where individual messages are rendered in the message list
- Where the response from `/api/assistant/chat/` is parsed
- Where the agent selector lives

- [ ] **Step 2: Capture `memory_saved` in the chat-send handler**

In the chat-send handler (the one that POSTs to `/api/assistant/chat/`), after the response comes back, attach the `memory_saved` field to the assistant message object before it goes into state. The message object in state should be extended to optionally carry `memory_saved`. Concretely:

```js
// Inside the chat-send handler, where you currently push the assistant
// reply into state, change something like:
//   setMessages(prev => [...prev, { role: 'assistant', content: data.reply, blocks: data.blocks }]);
// to:
//   setMessages(prev => [...prev, {
//     role: 'assistant',
//     content: data.reply,
//     blocks: data.blocks,
//     memory_saved: data.memory_saved || null,
//   }]);
```

If your existing handler uses different state shapes (e.g. a serialized message from the server), thread `memory_saved` through analogously. The chip needs to know:
- Whether to show ("memory_saved" is truthy on this message)
- The note id, content, category to display
- An "undone" flag once Undo is clicked (so we render "Removed from memory" instead of disappearing -- the user wanted clear feedback)

- [ ] **Step 3: Add the chip renderer**

Inside the `ChatBubble` component (or wherever an individual assistant message is rendered), add the chip BELOW the bubble content, outside the bubble's rounded container so it reads as meta. Pseudocode shape (adapt to actual JSX):

```jsx
{msg.role === "assistant" && msg.memory_saved && !msg.memory_undone && (
  <div className="mt-2 flex items-center gap-2 text-xs text-surface-500">
    <span aria-hidden>💾</span>
    <span>
      {t("assistant.memory.saved")}: <em>{msg.memory_saved.content}</em>
    </span>
    <span aria-hidden>·</span>
    <button
      onClick={() => handleUndoMemorySave(msg)}
      className="underline underline-offset-2 hover:text-surface-700 dark:hover:text-surface-200"
    >
      {t("assistant.memory.undo")}
    </button>
  </div>
)}
{msg.role === "assistant" && msg.memory_undone && (
  <div className="mt-2 text-xs text-surface-400 italic">
    {t("assistant.memory.removed")}
  </div>
)}
```

Add a `handleUndoMemorySave` function in the parent component that:

```js
import { deleteMemoryNote } from "../api/memory";

const handleUndoMemorySave = async (msg) => {
  try {
    await deleteMemoryNote(msg.memory_saved.id);
    setMessages(prev =>
      prev.map(m => m === msg ? { ...m, memory_undone: true } : m)
    );
    // Also refresh the notes-active count
    refreshMemoryCount();
  } catch (exc) {
    console.error("Failed to undo memory save:", exc);
  }
};
```

- [ ] **Step 4: Add the "N notes active" indicator**

Near the agent selector (look for the existing header chip or breadcrumb area in `Assistant.jsx`), add:

```jsx
import { useEffect, useState } from "react";
import { getMemoryCount, listMemoryNotes } from "../api/memory";

// inside the top-level Assistant component:
const [memoryCount, setMemoryCount] = useState(0);
const [memoryPopoverOpen, setMemoryPopoverOpen] = useState(false);
const [memoryPopoverNotes, setMemoryPopoverNotes] = useState([]);

const refreshMemoryCount = async () => {
  try {
    const n = await getMemoryCount();
    setMemoryCount(n);
  } catch (exc) {
    // Silent: the indicator just won't appear. Not worth a user error.
    setMemoryCount(0);
  }
};

useEffect(() => { refreshMemoryCount(); }, []);

const openMemoryPopover = async () => {
  setMemoryPopoverOpen(true);
  try {
    const res = await listMemoryNotes();
    setMemoryPopoverNotes(res.data || []);
  } catch {
    setMemoryPopoverNotes([]);
  }
};

// Render -- placed near the agent selector, only when count >= 1:
{memoryCount >= 1 && (
  <button
    type="button"
    onClick={openMemoryPopover}
    className="inline-flex items-center gap-1 text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-200"
  >
    <span aria-hidden>🧠</span>
    <span>{t("assistant.memory.notesActive", { count: memoryCount })}</span>
  </button>
)}

{memoryPopoverOpen && (
  <div
    role="dialog"
    aria-label={t("assistant.memory.notesActive", { count: memoryCount })}
    className="absolute z-50 right-0 mt-2 w-80 rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-3 shadow-lg"
    onClick={(e) => e.stopPropagation()}
  >
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {memoryPopoverNotes.length === 0 ? (
        <p className="text-xs text-surface-500">No notes</p>
      ) : (
        memoryPopoverNotes.map((n) => (
          <div key={n.id} className="text-xs">
            <p className="text-surface-900 dark:text-surface-50">{n.content}</p>
            <p className="text-surface-500">{n.category}</p>
          </div>
        ))
      )}
    </div>
    <div className="mt-3 border-t border-surface-200 dark:border-surface-800 pt-2 flex justify-end gap-2">
      <button
        onClick={() => setMemoryPopoverOpen(false)}
        className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-200"
      >
        Close
      </button>
      <a
        href="/settings"
        className="text-xs text-primary-600 hover:underline"
      >
        {t("assistant.memory.manage")}
      </a>
    </div>
  </div>
)}
```

The exact placement depends on the existing JSX layout -- look for the row where the agent selector is rendered and put the indicator alongside it. The popover should anchor near where the button is. If the project has a `Popover` primitive in `frontend/src/components/`, use that instead of the inline div above.

The "No notes" text on line `<p className="text-xs text-surface-500">No notes</p>` is fine as English for now -- it shouldn't appear because we only open the popover when count >= 1. If it does appear (race condition between popover open and refresh), it's a degenerate state; not worth a translation key.

- [ ] **Step 5: Lint + build**

From `frontend/`:

```bash
npm run lint && npm run build
```

Expected: both exit 0.

- [ ] **Step 6: Manual smoke test (REQUIRED -- attempt it)**

Phase B is where the felt change lands. The manual test is more important here than in Phase A.

Pre-req: set `LINGARU_MEMORY_ENABLED=true` in `backend/.env` (or export in shell). At least one of `GROQ_API_KEY` or `GEMINI_API_KEY` must be set for the extractor to actually run.

Start backend (`DJANGO_SETTINGS_MODULE=config.settings.local python manage.py runserver`) and frontend (`npm run dev`).

In a browser, log in and:
1. Visit Settings → Memory tab. Add a "goal" note: "Prepping for TCF June 15". Add a "weakness" note: "always confuse depuis/pendant".
2. Open the Assistant. Confirm "🧠 2 notes active" appears near the agent selector. Click it; the popover should show both notes.
3. Send a message: "Can you suggest something to drill?" The assistant's reply should be aware of the TCF goal and depuis/pendant weakness (you may need to look at the network response to confirm the system_prompt contained LEARNER CONTEXT; or just verify the reply is on-topic).
4. Send: "Remember I want to take the DELF B2 next semester."
5. Within ~1 second of the reply landing, a chip should appear below the assistant bubble: "💾 Saved to memory: User wants to take the DELF B2 next semester · [Undo]". Click Undo. The chip flips to "Removed from memory".
6. Refresh the Memory tab. The note's `is_active` should be False; toggle "Show inactive" to see it.

If anything misbehaves -- the chip doesn't appear, the popover crashes, the indicator never shows -- fix before committing.

If you cannot run the full stack in this environment (e.g. no LLM keys, or browser unavailable), document that in the report and rely on lint/build/test as the verification gate. **Do not** commit if the test suite or lint/build is failing.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Assistant.jsx
git commit -m "feat(memory): inline 'Saved to memory' chip and notes-active indicator in chat"
```

---

## Task 9: Document the env flag in the README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Find the env vars table**

Run:

```bash
grep -n "^## Environment Variables" /Users/arman/PycharmProjects/Lingaru/README.md
```

You'll get a line number. The table starts a few lines below it.

- [ ] **Step 2: Add the new row**

Find the existing rows in the `## Environment Variables` table (look for `SENTRY_RELEASE`). Add this new row at the bottom of the table:

```markdown
| `LINGARU_MEMORY_ENABLED` | Enable chat-side memory layer: inject learner context + auto-detect remember intent. Defaults to off; set to `true`/`1` to enable. | No (default: off) |
```

The Memory REST endpoints (`/api/memory/notes/`) keep working regardless of this flag -- it only gates the chat-side wiring. This nuance is worth a one-line note immediately under the table, but if the table is rendered as a section on its own with no prose around it, just add the row.

- [ ] **Step 3: Add a one-line note under the table if appropriate**

If the env vars table is immediately followed by a blank line and then `## Testing`, insert this sentence between them:

```markdown
**`LINGARU_MEMORY_ENABLED` is a kill switch only for the chat-side memory wiring.** The `/api/memory/notes/` REST endpoints and the Settings → Memory tab work regardless.
```

If the table has surrounding prose already, slot the sentence near the row.

- [ ] **Step 4: Verify no em-dashes**

```bash
grep "—" /Users/arman/PycharmProjects/Lingaru/README.md
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs(memory): document LINGARU_MEMORY_ENABLED in the env vars table"
```

---

## Task 10: Push branch and open PR

**Files:** none

- [ ] **Step 1: Run the full backend test suite**

From `backend/`:

```bash
DJANGO_SETTINGS_MODULE=config.settings.test pytest -q
```

Expected: all tests pass. The count is `470 + new tests`: ~14 from services/memory + 5 from chat integration = ~489.

- [ ] **Step 2: Run the full lint + format**

From `backend/`:

```bash
ruff check . && ruff format --check .
```

From `frontend/`:

```bash
npm run lint && npm run build
```

All clean.

- [ ] **Step 3: Push the branch**

```bash
git push -u origin feat/memory-phase-b
```

(If still on `main`, branch first: `git checkout -b feat/memory-phase-b`. Never push to `main` directly.)

- [ ] **Step 4: Open the PR via gh**

```bash
gh pr create --title "feat(memory): Phase B -- chat integration + auto-extraction (behind a flag)" --body "$(cat <<'EOF'
## Summary

Phase B of the assistant memory layer (see [\`docs/superpowers/specs/2026-05-17-assistant-memory-layer-design.md\`](docs/superpowers/specs/2026-05-17-assistant-memory-layer-design.md) and [\`docs/superpowers/plans/2026-05-17-phase18b-memory-chat-integration.md\`](docs/superpowers/plans/2026-05-17-phase18b-memory-chat-integration.md)).

Wires the memory layer into the chat flow. Every text-chat turn now:
1. Prepends a LEARNER CONTEXT block to the system prompt (profile, goals, recent mistakes, weakest topics, recent activity, preferences/weaknesses/background notes).
2. After the LLM reply, runs a cheap second LLM call (Groq primary, Gemini fallback) that detects "remember X" intent and saves a MemoryNote with source="assistant_detected".

The chat response payload gains a \`memory_saved\` field when a note was auto-created; the frontend renders an inline chip below the assistant bubble with an Undo link.

A "🧠 N notes active" indicator appears near the agent selector when the user has at least one active note; clicking opens a read-only popover.

## Behind a flag

Everything is gated on \`LINGARU_MEMORY_ENABLED\` (default off). Phase A's Memory tab and the \`/api/memory/notes/\` endpoints keep working regardless.

## Safety

- Memory cannot break a chat turn. Each context-section query is in its own try/except; the extractor swallows all exceptions and writes a MemoryExtractionLog row instead.
- Daily extraction cap: 3 successful auto-extractions per user per rolling 24h.
- The extractor uses a dedicated ProviderRouter, not the chat router; one being slow does not cascade.

## Verification before opening this PR

- Full backend test suite: all passed (incl. ~14 new memory tests + 5 chat integration tests).
- \`ruff check .\` and \`ruff format --check .\`: clean.
- \`npm run lint\`: 0 errors.
- \`npm run build\`: succeeds.
- Manual smoke test: documented in the PR description below.

## Manual test plan

- [ ] CI green
- [ ] With \`LINGARU_MEMORY_ENABLED=true\`, the assistant's reply demonstrates awareness of an existing goal/weakness note
- [ ] Saying "remember X" produces the inline chip; Undo removes the note
- [ ] The "🧠 N notes active" indicator updates after add/delete in the Memory tab
- [ ] With the flag off, chat behavior is identical to pre-Phase-B
EOF
)"
```

Expected: PR URL returned. Verify CI runs.

---

## Self-Review

**Spec coverage** -- mapping each Phase B spec requirement to its task:

| Spec section | Phase B task(s) |
|---|---|
| `assemble_user_context` builds LEARNER CONTEXT block | Task 2 |
| Identity / goals / recent mistakes / weakest topics / activity / pref+weak+bg | Task 2 (one helper per section) |
| Defensive: per-section try/except + outer try/except returns "" | Task 2 (`_safe` decorator + outer try) |
| Brand-new user returns "" | Task 2 (`test_brand_new_user_returns_empty_string`) |
| `maybe_extract_note` LLM call + JSON parse + DB write | Task 3 |
| Daily cap of 3 per rolling 24h | Task 3 (`DAILY_EXTRACTION_CAP` + cap check before LLM call) |
| Always writes a MemoryExtractionLog row | Task 3 (every code path) |
| Extractor uses Groq primary, Gemini fallback | Task 3 (`_build_router` is a separate router from chat) |
| Tolerates markdown fences / commentary in JSON output | Task 3 (`_parse_json` with fence regex + permissive scan) |
| Never raises | Task 3 (`test_router_failure_returns_none_and_logs`, `test_malformed_json_returns_none_and_logs`) |
| `LINGARU_MEMORY_ENABLED` env flag, default off | Tasks 1, 5 |
| When flag off: no context injection, no extraction | Task 5 (`test_flag_off_does_not_inject_or_extract`) |
| When flag on: context prepended | Task 5 (`test_flag_on_injects_context_into_system_prompt`) |
| When flag on + extractor fires: `memory_saved` in chat response | Task 5 (`test_extractor_creates_note_returns_memory_saved`) |
| Extractor failure does not break chat | Task 5 (`test_extractor_failure_does_not_break_chat`) |
| Assembler failure does not break chat | Task 5 (`test_assembler_failure_does_not_break_chat`) |
| Inline "Saved to memory" chip + Undo | Task 8 |
| "N notes active" indicator (only when count >= 1) | Task 8 |
| README env var documentation | Task 9 |

**Out of scope for Phase B (explicitly deferred):**

- Memory injection into `VoiceChatView` and `ImageQueryView`. Phase B only wires text chat. A separate follow-up can extend the same hooks to those two paths once Phase B is observed in production.
- The bell/notification dot on the Memory tab when new notes are detected (we have the data, just no UX yet).
- Episodic recall / vector store. Spec explicitly deferred.

**Placeholder scan:** No TBDs, every code step has runnable code. Two areas worth flagging where the plan uses pseudocode-like indirection because the existing file shape may have small variations:

- Task 8 Step 2 (capturing `memory_saved` in the send handler) uses pseudocode because the exact handler signature in `Assistant.jsx` isn't pinned. The implementer must read the file to find the handler.
- Task 8 Step 4 (placing the indicator near the agent selector) similarly requires reading the existing JSX. Both steps explicitly say so and give precise behavior; the implementer adapts placement.

These are not placeholder failures -- they're "follow the existing pattern in this file." The plan can't pin the exact diff without first reading the file in this session, and that's the implementer's job.

**Type / name consistency:**

- `assemble_user_context`, `maybe_extract_note`, `is_memory_enabled` are the only exported names from `services.memory.__init__`; they're imported by name in Task 5's `ChatView` changes and Task 5's tests. Consistent.
- `MemoryNote`, `MemoryExtractionLog` field names match Phase A (e.g. `is_active`, `extracted`, `raw_output`).
- `LINGARU_MEMORY_ENABLED` is the same casing in Tasks 1, 5, 9 (plan + README + settings + tests via `override_settings`).
- `memory_saved` is the chat response field; `getMemoryCount`, `listMemoryNotes`, `deleteMemoryNote` are the frontend client names. All consistent between Task 6 (API client) and Task 8 (UI).
- `DAILY_EXTRACTION_CAP = 3` defined in `extractor.py` and imported by name in `test_extractor.py`; the test uses the constant rather than hardcoding 3. Consistent.

---

## Execution Handoff

Plan complete and saved. Two execution options:

1. **Subagent-Driven (recommended)** -- I dispatch a fresh subagent per task, review between tasks. Same approach that worked for Phase A.
2. **Inline Execution** -- batch-execute with checkpoints.

Which approach?
