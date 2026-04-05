"""SM-2 spaced repetition service and mistake recording."""

from datetime import timedelta
from typing import Optional

from django.utils import timezone

from apps.content.models import Question
from .models import MistakeEntry, SRSCard


# ---------------------------------------------------------------------------
# SM-2 pure algorithm (no ORM — easy to unit-test)
# ---------------------------------------------------------------------------

def sm2_update(
    quality: int,
    repetitions: int,
    ease_factor: float,
    interval_days: int,
) -> tuple[int, float, int]:
    """Apply one SM-2 review step.

    Args:
        quality: User self-rating 0-5 (0=blackout, 5=perfect).
        repetitions: Current repetition count.
        ease_factor: Current ease factor (>= 1.3).
        interval_days: Current interval in days.

    Returns:
        (new_repetitions, new_ease_factor, new_interval_days)
    """
    if quality < 0 or quality > 5:
        raise ValueError("quality must be 0-5")

    # Update ease factor
    new_ef = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(new_ef, 1.3)

    if quality < 3:
        # Failed — reset
        new_reps = 0
        new_interval = 1
    else:
        new_reps = repetitions + 1
        if new_reps == 1:
            new_interval = 1
        elif new_reps == 2:
            new_interval = 6
        else:
            new_interval = round(interval_days * new_ef)

    return new_reps, new_ef, new_interval


# ---------------------------------------------------------------------------
# Django-level helpers
# ---------------------------------------------------------------------------

def get_due_cards(user, limit: int = 20):
    """Return SRSCards due for review, oldest first."""
    now = timezone.now()
    return (
        SRSCard.objects
        .filter(user=user, next_review_at__lte=now)
        .select_related("vocabulary")[:limit]
    )


def review_card(card: SRSCard, quality: int) -> SRSCard:
    """Apply an SM-2 review to a card and save it."""
    new_reps, new_ef, new_interval = sm2_update(
        quality=quality,
        repetitions=card.repetitions,
        ease_factor=card.ease_factor,
        interval_days=card.interval_days,
    )
    card.repetitions = new_reps
    card.ease_factor = new_ef
    card.interval_days = new_interval
    card.last_quality = quality
    card.next_review_at = timezone.now() + timedelta(days=new_interval)
    card.save()
    return card


def get_or_create_card(user, vocabulary) -> SRSCard:
    """Get or create an SRS card for the user + vocabulary pair."""
    card, _ = SRSCard.objects.get_or_create(
        user=user,
        vocabulary=vocabulary,
        defaults={
            "ease_factor": 2.5,
            "interval_days": 0,
            "repetitions": 0,
            "next_review_at": timezone.now(),
        },
    )
    return card


# ---------------------------------------------------------------------------
# Mistake recording
# ---------------------------------------------------------------------------

def classify_mistake(question: Optional[Question]) -> str:
    """Infer mistake_type from the question type."""
    if question is None:
        return "other"
    mapping = {
        "conjugation": "conjugation",
    }
    return mapping.get(question.type, "other")


def record_mistake(
    user,
    question: Optional[Question],
    user_answer: str,
    correct_answer: str,
    mistake_type: Optional[str] = None,
) -> MistakeEntry:
    """Create a MistakeEntry. Auto-classifies if mistake_type is not given."""
    if mistake_type is None:
        mistake_type = classify_mistake(question)

    return MistakeEntry.objects.create(
        user=user,
        question=question,
        user_answer=user_answer,
        correct_answer=correct_answer,
        mistake_type=mistake_type,
    )
