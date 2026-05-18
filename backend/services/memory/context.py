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

        for fn in (
            _fetch_identity,
            _fetch_goal_notes,
            _fetch_recent_mistakes,
            _fetch_weakest_topics,
            _fetch_recent_activity,
            _fetch_preference_weakness_background_notes,
        ):
            try:
                result = fn(user)
                if result:
                    sections.append(result)
            except Exception as exc:
                logger.warning(
                    "memory.context.%s failed: %s",
                    getattr(fn, "__name__", repr(fn)),
                    exc,
                )

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
    notes = MemoryNote.objects.filter(user=user, category="goal", is_active=True).order_by(
        "created_at"
    )
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
    recents = MistakeEntry.objects.filter(user=user, created_at__gte=since).values_list(
        "mistake_type", flat=True
    )
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
        GrammarMastery.objects.filter(user=user, attempts__gt=0)
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
    mocks = (
        ExamSession.objects.filter(user=user, completed_at__gte=since, mode="mock").count()
        if hasattr(ExamSession, "mode")
        else 0
    )
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
