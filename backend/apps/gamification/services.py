"""Gamification service — XP, streaks, badges, levels."""

from datetime import date
from typing import Optional

from django.contrib.auth import get_user_model
from django.db import transaction

from .constants import LEVEL_THRESHOLDS
from .models import Badge, UserBadge, UserStats, XPTransaction

User = get_user_model()


def get_level(total_xp: int) -> tuple[str, int]:
    """Return (level_name, level_index) for the given XP total.

    Iterates thresholds in reverse to find the highest matching level.
    """
    for idx in range(len(LEVEL_THRESHOLDS) - 1, -1, -1):
        threshold, name = LEVEL_THRESHOLDS[idx]
        if total_xp >= threshold:
            return name, idx
    return LEVEL_THRESHOLDS[0][1], 0


def get_or_create_stats(user) -> UserStats:
    """Return the UserStats row for the user, creating one if needed."""
    stats, _ = UserStats.objects.get_or_create(user=user)
    return stats


@transaction.atomic
def award_xp(
    user,
    activity_type: str,
    xp_amount: int,
    source_id: Optional[str] = None,
) -> tuple[UserStats, XPTransaction, list[UserBadge]]:
    """Award XP to a user.

    Creates an XPTransaction, updates UserStats (total_xp, level),
    and checks for newly earned badges.

    Returns (updated_stats, transaction, list_of_new_badges).
    """
    txn = XPTransaction.objects.create(
        user=user,
        activity_type=activity_type,
        xp_amount=xp_amount,
        source_id=source_id,
    )

    stats = get_or_create_stats(user)
    stats.total_xp += xp_amount
    _, level_idx = get_level(stats.total_xp)
    stats.level = level_idx
    stats.save()

    new_badges = check_badges(user)

    return stats, txn, new_badges


def check_streak(user, today: Optional[date] = None) -> UserStats:
    """Update the user's streak based on last_active_date.

    Call this whenever the user performs any practice activity.
    If today is the day after last_active_date, increment streak.
    If today == last_active_date, do nothing.
    If there is a gap of 2+ days, reset streak to 1.
    """
    if today is None:
        today = date.today()

    stats = get_or_create_stats(user)

    if stats.last_active_date is None:
        # First ever activity
        stats.current_streak = 1
        stats.longest_streak = 1
        stats.last_active_date = today
        stats.save()
        return stats

    if stats.last_active_date == today:
        # Already active today — no change
        return stats

    delta = (today - stats.last_active_date).days

    if delta == 1:
        # Consecutive day
        stats.current_streak += 1
    else:
        # Streak broken
        stats.current_streak = 1

    stats.longest_streak = max(stats.longest_streak, stats.current_streak)
    stats.last_active_date = today
    stats.save()
    return stats


def check_badges(user) -> list[UserBadge]:
    """Evaluate all badge criteria and award any newly earned badges.

    Returns a list of newly created UserBadge instances.
    """
    stats = get_or_create_stats(user)
    already_earned = set(UserBadge.objects.filter(user=user).values_list("badge_id", flat=True))
    all_badges = Badge.objects.exclude(id__in=already_earned)

    new_badges = []
    for badge in all_badges:
        earned = _evaluate_badge(badge, stats, user)
        if earned:
            ub = UserBadge.objects.create(user=user, badge=badge)
            new_badges.append(ub)

    return new_badges


def _evaluate_badge(badge: Badge, stats: UserStats, user) -> bool:
    """Check whether a single badge's criteria are met."""
    ct = badge.criteria_type
    cv = badge.criteria_value

    if ct == "total_xp":
        return stats.total_xp >= cv

    if ct == "streak_days":
        return stats.current_streak >= cv

    if ct == "level":
        # criteria_value is the XP threshold for the level
        return stats.total_xp >= cv

    if ct == "quizzes_completed":
        from apps.practice.models import QuizSession

        count = QuizSession.objects.filter(
            user=user,
            completed_at__isnull=False,
        ).count()
        return count >= cv

    if ct == "perfect_quizzes":
        from apps.practice.models import QuizSession

        count = (
            QuizSession.objects.filter(
                user=user,
                completed_at__isnull=False,
            )
            .extra(where=["score = total_questions"])
            .count()
        )
        return count >= cv

    if ct == "ai_conversations":
        from django.db.models import Count

        from apps.assistant.models import Conversation

        count = (
            Conversation.objects.filter(user=user)
            .annotate(
                msg_count=Count("messages"),
            )
            .filter(msg_count__gte=5)
            .count()
        )
        return count >= cv

    return False
