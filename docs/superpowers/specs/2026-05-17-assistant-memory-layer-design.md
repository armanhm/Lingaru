# Assistant Memory Layer -- Design

**Status:** approved, ready for implementation planning
**Date:** 2026-05-17
**Owner:** arman

## Problem

The Assistant has no memory or continuity across turns. Every conversation starts cold -- it doesn't know the user's level, weak topics, recent mistakes, goals, or stated preferences. Lots of signal exists in the database (SRS cards, mistake journal, grammar mastery, user profile, exam history), but none of it reaches the LLM beyond the current conversation's literal message history.

The felt symptom: the assistant cannot say "last time you struggled with *subjonctif*, want another round?" or "for your TCF prep, here's the highest-leverage thing to drill today." It treats every B2 immersion-mode learner the same as every A1 vocabulary-first one.

## Goal

Add a hybrid memory layer that combines:

1. **Auto-injected profile context** -- live facts about the user (level, mode, recent mistakes, weakest grammar topics, recent activity, explicit goals) prepended to every assistant turn's system prompt.
2. **User-curated notes** -- a small CRUD store of explicit facts the user (or the assistant, with detection) wants remembered across conversations.

Out of scope (deferred, may revisit):

- Cross-conversation **episodic recall** ("you asked about X last week and I said Y"). Requires a vector store and per-turn retrieval; not justified at our scale yet.
- Memory-as-RAG. Overkill for ~10-30 notes per user plus a few profile fields.
- Letting the assistant **modify or delete** notes. The assistant can only *propose* new ones; only the user can edit/delete.

## Non-goals

- Solving the unrelated "widgets feel shallow" and "routing feels guess-y" Assistant complaints -- those are separate enhancements for later.
- Adding a "memory share" surface across users.
- Localizing memory content. Notes are stored verbatim in whatever language the user wrote them.

## Architecture

A new Django app `apps/memory/` plus a `backend/services/memory/` package. `ChatView` is the only consumer in the chat flow; the REST endpoints serve the Memory tab in Settings.

```
                       ┌──────────────────────────────┐
                       │     POST /api/assistant/     │
                       │            chat/             │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                  ┌─────────────────────────────────────┐
                  │           ChatView.post              │
                  │   1. assemble_user_context(user)     │
                  │   2. prepend to system_prompt        │
                  │   3. call LLM (existing flow)        │
                  │   4. maybe_extract_note(user, turn)  │
                  └─────┬────────────────────────┬───────┘
                        │                        │
        ┌───────────────▼──────────┐   ┌─────────▼────────────┐
        │  services.memory.        │   │  services.memory.    │
        │  assemble_user_context() │   │  maybe_extract_note()│
        │  (one-way reads)         │   │  (writes notes)      │
        └───┬─────────────┬────────┘   └──────────┬───────────┘
            │             │                       │
   ┌────────▼──┐   ┌──────▼───────┐      ┌────────▼──────┐
   │ existing  │   │   memory     │      │   memory      │
   │ tables    │   │   notes      │      │   notes       │
   │ (read)    │   │  (read)      │      │  (write)      │
   └───────────┘   └──────────────┘      └───────────────┘

   ┌────────────────────────────────────┐
   │  GET / POST / PATCH / DELETE       │
   │  /api/memory/notes/(<id>/)         │   --->  Settings > Memory tab
   └────────────────────────────────────┘
```

### Boundary rules

- `services.memory` is the **only** place that reads from `progress`, `grammar`, `users` for the purpose of building assistant context. Other code keeps doing whatever it does.
- `ChatView` **never reads memory tables directly** -- it only calls the two service functions.
- `MemoryNote` writes happen from exactly two places: the REST endpoints (source=`user`) and `maybe_extract_note` (source=`assistant_detected`). Admin can also write, of course.

## Data model

`backend/apps/memory/models.py`:

```python
class MemoryNote(models.Model):
    """A single fact the user wants the assistant to remember.

    Authored either via the Settings > Memory tab (source="user")
    or auto-extracted by services.memory.maybe_extract_note from a
    chat turn (source="assistant_detected"). Either way the user
    can edit or delete it from the Memory tab -- the assistant has
    no ability to modify or delete notes, only propose new ones.
    """

    SOURCE_CHOICES = [
        ("user", "User-authored"),
        ("assistant_detected", "Detected by assistant"),
    ]

    CATEGORY_CHOICES = [
        ("goal",       "Goal"),         # "TCF on June 15"
        ("preference", "Preference"),   # "explain in English first"
        ("background", "Background"),   # "10 years of Spanish"
        ("weakness",   "Weakness"),     # "always confuse qui/que"
        ("other",      "Other"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memory_notes",
    )
    content    = models.TextField()
    category   = models.CharField(max_length=16, choices=CATEGORY_CHOICES, default="other")
    source     = models.CharField(max_length=24, choices=SOURCE_CHOICES, default="user")
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "memory_notes"
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["user", "is_active", "-updated_at"])]


class MemoryExtractionLog(models.Model):
    """Audit trail for auto-detected notes. Lets us:
      (a) show the user *why* a note was saved (link back to the message),
      (b) debug false positives,
      (c) cap auto-extraction (at-most-N per day per user).
    """
    user       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message    = models.ForeignKey("assistant.Message", on_delete=models.SET_NULL, null=True, blank=True)
    note       = models.ForeignKey(MemoryNote, on_delete=models.SET_NULL, null=True, blank=True)
    extracted  = models.BooleanField()
    raw_output = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "memory_extraction_log"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "-created_at"])]
```

### Notes on the choices

- **Five categories** instead of free-form tags. Keeps the prompt-injection layer formatting tight (we group notes by category in the system prompt) without forcing the user to think about taxonomy. "Other" is the safety valve.
- **`is_active` soft-delete instead of hard delete.** A user toggling a note off shouldn't blow away the extraction log entry. The DELETE endpoint sets `is_active=False`.
- **`MemoryExtractionLog.extracted=False` rows are kept** so we can count "how often is the extractor finding nothing?" -- useful for tuning the prompt or deciding to throttle further.
- **No `priority` / `pinned` fields yet.** YAGNI; if the note list ever grows beyond ~20 we can add it.

## Service layer

`backend/services/memory/context.py` and `backend/services/memory/extractor.py`. Two functions; `ChatView` and the REST views are the only callers.

### 3a. `assemble_user_context(user) -> str`

Builds the LEARNER CONTEXT block prepended to the system prompt. Pure read. ~300-400 tokens depending on signal density.

**What it pulls, in order:**

1. **Identity** -- from `User`: `target_level`, `proficiency_level`, `mode`, `native_language`, `daily_goal_minutes`.
2. **Goals** -- all active `MemoryNote` rows with `category="goal"`, verbatim, oldest first.
3. **Recent mistakes** -- top 3 `MistakeEntry` rows from the last 7 days, grouped by `mistake_type`. Format: `"qui/que confusion (3 times), passé composé agreement (2 times)"`.
4. **Weakest grammar topics** -- bottom 3 by mastery score in `apps/grammar`, only topics the user has actually touched. Format: `"Relative pronouns (28%), Subjonctif présent (35%)"`.
5. **Recent activity** -- one-line summary from `LessonCompletion` + `ExamPrepSession` + SRS reviews in the last 7 days.
6. **Preferences / weaknesses / background** -- all active `MemoryNote` rows in those three categories, grouped.

**Output shape (illustrative):**

```
## LEARNER CONTEXT

**Profile:** B2 target . advanced . mode=immersive . native=en . 15 min/day goal

**Goals:**
- TCF on June 15
- Pass C1 by end of year

**Recent mistakes (last 7 days):** qui/que confusion (3x), passé composé agreement (2x)

**Weakest grammar topics:** Relative pronouns (28%), Subjonctif présent (35%)

**This week:** 4 lessons completed, 1 mock exam, 12 SRS reviews

**Preferences:**
- Explain grammar in English first, then French
- Skip vocabulary I already know well

**Weaknesses (user-reported):**
- Always confuse depuis/pendant
```

**Implementation rules:**

- **Defensive defaults.** Each section is wrapped in its own try/except. If any subsystem raises (Grammar Booster table missing, say), that section is skipped, others continue. The function never crashes the chat call.
- **Cheap.** All queries are indexed; aggregate runtime budget < 50ms.
- **Cached.** 60-second per-user cache keyed on `(user.id, user.updated_at, latest_mistake.created_at, latest_note.updated_at)` so it auto-busts when anything changes.
- **No PII leakage.** No email, no `username`, no `telegram_id`. The LLM gets only learning-relevant signal.
- **Brand-new user with zero signal:** returns the empty string `""`. Caller should treat empty as "skip injection".

### 3b. `maybe_extract_note(user, user_message, assistant_response) -> MemoryNote | None`

Cheap second LLM call after the main turn finishes. Returns the saved note or None.

**Behavior:**

- Returns `None` if the extraction cap is reached: max 3 successful extractions per user in a **rolling 24h window**, counted as `MemoryExtractionLog.extracted=True` rows with `created_at >= now() - 24h`.
- Returns `None` if the extractor classifies the turn as "no note here".
- Otherwise creates and returns a `MemoryNote` with `source="assistant_detected"`.
- **Always** writes a `MemoryExtractionLog` row (success or null), linked to the originating `Message`.
- **Runs synchronously** in the chat request. If the call fails, swallow the exception, write a log row with the error text in `raw_output`, return `None`.

**Extractor prompt** (lives in `services/memory/prompts.py`):

```
You are a memory extractor. Given a recent chat turn, decide whether the
user is asking the system to remember a fact about themselves.

Return strict JSON:
{
  "remember": true | false,
  "content": "<the fact, third-person, single sentence>" | null,
  "category": "goal" | "preference" | "background" | "weakness" | "other" | null
}

Rules:
- Only return remember=true if the user explicitly asks to remember,
  save, note, or "don't forget". Volunteered facts ("I love jazz") do
  NOT qualify -- too noisy.
- Strip the imperative. "Remember I'm prepping for TCF June 15" ->
  content="User is preparing for the TCF exam on June 15".
- One fact per turn. If multiple, pick the most specific.
- If unsure, return remember=false.

Recent user message:
"""
{user_message}
"""

Assistant response (for context only, do not extract facts from it):
"""
{assistant_response[:400]}
"""
```

**Routing choices:**

- Uses the existing `ProviderRouter` pattern but a **new instance** with Groq as primary (faster + cheaper for this), Gemini as fallback. Not the same router instance the chat view uses; we don't want one being slow to cascade.
- Reuses the JSON-salvage helper from `apps/assistant/blocks.py` to handle the case where the LLM emits markdown-fenced JSON.

## REST API

All `IsAuthenticated`. All scoped to `request.user`.

| Method | Endpoint                       | Body / Query                                                   | Response                                                                 |
|--------|--------------------------------|----------------------------------------------------------------|--------------------------------------------------------------------------|
| GET    | `/api/memory/notes/`           | `?include_inactive=false` (default)                            | `[{id, content, category, source, is_active, created_at, updated_at}]`   |
| POST   | `/api/memory/notes/`           | `{content, category?}` (category defaults to `"other"`)        | `201` + serialized note; `source` forced to `"user"`                     |
| PATCH  | `/api/memory/notes/<id>/`      | `{content?, category?, is_active?}`                            | `200` + serialized note                                                  |
| DELETE | `/api/memory/notes/<id>/`      | --                                                             | `204` (soft-delete: sets `is_active=False`)                              |

**Rules:**

- `source` is **never** writable from the API; set internally.
- `content` capped at 500 chars at the serializer level.
- DELETE on an already-inactive note is a no-op `204`, not 404.
- Wrong-owner access returns 404, never 403 (no information leak).

A new `### Memory (/api/memory/)` row gets added to `README.md`.

## Chat response shape

When a note is auto-saved, `ChatView` adds a field to its response:

```json
{
  "message": { ... },
  "blocks": [ ... ],
  "memory_saved": {
    "id": 42,
    "content": "User is preparing for the TCF exam on June 15",
    "category": "goal"
  }
}
```

`memory_saved` is omitted when no note was saved. The frontend uses its presence to render the confirmation chip.

## Frontend surfaces

### Memory tab in Settings

New tab in the existing `Settings.jsx`. Layout (terminal-rendered mock):

```
[Profile] [Language] [Notifications] [Memory] [Account]

What the assistant remembers about you
--------------------------------------
Notes here are injected into every assistant conversation.
The assistant cannot delete or edit these -- only you can.

+ Add a new note
  Category: ( goal | preference | background | weakness | other )
  [ textarea -- e.g. "Always confuse depuis and pendant" ]
                                                  [ Cancel ] [ Save ]

GOALS
  TCF on June 15                                  [edit] [x]
  Detected from chat . 3 days ago

  Pass C1 by end of year                          [edit] [x]
  Added manually . 2 weeks ago

WEAKNESSES
  Always confuse depuis/pendant                   [edit] [x]
  Added manually . yesterday

PREFERENCES
  (empty -- categories with zero active notes are hidden)

Show inactive notes  [ toggle ]
```

Behavior:

- Notes grouped by category; empty categories hidden unless "Show inactive" is on.
- Each card shows source badge ("Detected from chat" / "Added manually") and relative time.
- Inline edit: content textarea + category dropdown + Save/Cancel.
- `x` is a soft delete; card grays out for ~1s, slides out, "Undo" toast appears for 5s.
- The Memory tab gets a small dot when there are notes the assistant detected in the last 24h that the user hasn't viewed (tracked in `localStorage`, no backend flag).

### Inline confirmation chip in chat

When the chat response includes `memory_saved`, the assistant bubble gets a chip rendered *below* the content (visually meta, not part of the message):

```
[ Assistant ]
Of course! I'll keep that in mind. For the
TCF on June 15 ...

  [memory icon] Saved to memory: User is preparing for
                the TCF exam on June 15  .  [ Undo ]
```

- Chip styling matches the existing agentic-action mini-cards.
- Undo POSTs `DELETE /api/memory/notes/<id>/` and the chip flips to "Removed from memory."
- Chip is in-session only; reload removes it. The note itself reflects whatever state was last set.

### Memory indicator near the agent selector

```
[ @ ] Chatting with default assistant  .  [brain icon] 5 notes active
```

- Only renders when active note count >= 1.
- Click opens a read-only popover listing active notes by category, with a "Manage in Settings" link.

## Error handling

The memory layer **must never break a chat turn**.

| Boundary                                | Failure mode                                | Behavior                                                                                              |
|-----------------------------------------|---------------------------------------------|-------------------------------------------------------------------------------------------------------|
| `assemble_user_context()` section       | DB query raises (table missing, etc.)       | try/except per section -- skip that section, continue. Logged at WARNING.                             |
| `assemble_user_context()` total         | Unexpected exception                        | Outer try/except returns `""`. Chat proceeds with original system prompt. Logged at ERROR.            |
| `maybe_extract_note()` LLM call         | Router raises, JSON malformed, cap exceeded | Returns `None`. Writes `MemoryExtractionLog` row with `extracted=False` and `raw_output`. Swallowed.  |
| REST endpoints                          | Standard DRF                                | 400 on bad input. 404 on missing/wrong-owner. 403 not used.                                           |

**Ownership:** every endpoint filters by `user=request.user`. No path exposes another user's notes.

**Cache invalidation:** the `assemble_user_context` cache key includes `latest_note.updated_at`, so any write from any path auto-busts on next read.

## Testing

| File                                              | What it covers                                                                                                  |
|---------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| `apps/memory/tests/test_models.py`                | `MemoryNote` defaults, ordering, soft-delete via `is_active`; index existence.                                  |
| `apps/memory/tests/test_views.py`                 | CRUD endpoints: list, create (source forced "user"), patch, soft-delete, 404 on other-user notes, length cap.   |
| `services/memory/tests/test_context.py`           | New user -> empty string; full user -> all sections render; one subsystem raising -> that section skipped; cache hits don't re-query. |
| `services/memory/tests/test_extractor.py`         | Mocked router: explicit-remember -> note saved + log row; volunteered -> no note + log; malformed JSON -> no note + log; daily cap -> no note + log. |
| `apps/assistant/tests/test_chat_with_memory.py`   | Integration: chat returns `memory_saved` when extractor fires; doesn't when it doesn't; extractor failure does not break chat. |
| `frontend/e2e/memory.spec.js`                     | Playwright: add a note via the Memory tab, see it under the right category, soft-delete it, see the Undo toast. Not a visual baseline (surface too dynamic). |

Target: 90%+ coverage on the new service functions. The chat integration test is the most important -- it guards the invariant "memory never breaks chat".

## Rollout

**Phase A -- Backend + Memory tab** (one PR):

- New `apps/memory/` with models, serializers, views, urls, admin, migration.
- New `backend/services/memory/` package.
- New Memory tab in `Settings.jsx`, wired to the REST endpoints.
- Tests for the data layer and REST endpoints (everything except the chat integration test).

This phase is fully usable on its own -- the Memory tab is a self-contained feature.

**Phase B -- Chat integration** (separate PR):

- Wire `ChatView` to call `assemble_user_context` (system prompt) and `maybe_extract_note` (post-turn).
- Add `memory_saved` to the chat response shape.
- Render the inline confirmation chip + brain-icon indicator in the Assistant page.
- Add the chat-integration test and the Playwright spec.

### Feature flag

Single env-driven kill-switch: `LINGARU_MEMORY_ENABLED` (read once at module import in `services/memory/__init__.py`). When `False`:

- `assemble_user_context` returns `""`.
- `maybe_extract_note` returns `None` without making the LLM call.
- The REST endpoints still work (the Memory tab keeps functioning as a personal note bank).

Cheap insurance against a bad extractor regression in production.

### Migration

Two new tables, no FK to existing tables modified, no backfill. Forward-only, reversible. Zero risk of locking production tables.

## Observability

- **Sentry spans:** `memory.assemble` around `assemble_user_context`, `memory.extract` around `maybe_extract_note`. Existing Sentry config picks them up.
- **Admin:** register both models with list-display, filters (user, category, source, extracted), search by content.
- **Post-Phase-B metrics to watch:**
    - Auto-extraction precision (manual review of the admin for the first ~30 extractions).
    - Median chat-turn latency before vs. after (extractor adds ~300-500ms; track to confirm it's tolerable).
    - % of users with >=1 active note after 7 days (adoption).

## Open questions

None at design time. All trade-offs were explicitly resolved during brainstorming:

- Hybrid memory shape (profile + notes), not episodic / RAG.
- Both surfaces for note creation (natural-language detection + Memory tab).
- Full identity + activity + goals injection (~400 tokens/turn).
- Synchronous extraction (not Celery).
- Groq primary / Gemini fallback for the extractor.
- Two-phase rollout, single env-driven kill-switch, no per-user flag.

## Future work (explicitly deferred)

- Cross-conversation **episodic recall** with a vector store.
- Per-conversation memory toggle ("don't use my memory for this chat").
- Memory **sharing** between users (study buddies).
- An admin-facing dashboard summarising what the extractor has been saving.
