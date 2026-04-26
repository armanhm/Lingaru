"""Mastery scoring for grammar topics — SM-2-flavoured spaced repetition."""
from datetime import timedelta
from django.utils import timezone


# Mastery score: 0-100
CORRECT_GAIN = 5
WRONG_PENALTY = 3
MASTERED_THRESHOLD = 80
MASTERED_MIN_ATTEMPTS = 10


def update_mastery(mastery, num_correct: int, num_total: int):
    """
    Update a GrammarMastery record after a drill session.
    Adjusts score, ease_factor, interval_days, and schedules next_review_at.
    """
    if num_total <= 0:
        return mastery

    accuracy = num_correct / num_total

    # ── score: bounded 0-100, weighted by session size ───────────
    delta = (num_correct * CORRECT_GAIN) - ((num_total - num_correct) * WRONG_PENALTY)
    mastery.mastery_score = max(0, min(100, mastery.mastery_score + delta))

    # ── attempts ─────────────────────────────────────────────────
    mastery.attempts += num_total
    mastery.correct_count += num_correct

    # ── SM-2-style scheduling ────────────────────────────────────
    quality = round(accuracy * 5)  # 0-5 scale
    if quality < 3:
        mastery.interval_days = 1.0
    else:
        if mastery.attempts <= num_total:
            mastery.interval_days = 2.0
        elif mastery.interval_days < 6:
            mastery.interval_days = 6.0
        else:
            mastery.interval_days = round(mastery.interval_days * mastery.ease_factor, 1)

    # Update ease factor
    mastery.ease_factor = max(
        1.3,
        mastery.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    )

    now = timezone.now()
    mastery.last_drilled_at = now
    mastery.next_review_at = now + timedelta(days=mastery.interval_days)
    mastery.save()
    return mastery


def status_for(mastery):
    """Quick status label for UI."""
    if not mastery or mastery.attempts == 0:
        return "not_started"
    if mastery.mastery_score >= MASTERED_THRESHOLD and mastery.attempts >= MASTERED_MIN_ATTEMPTS:
        return "mastered"
    if mastery.mastery_score >= 50:
        return "practiced"
    return "learning"
