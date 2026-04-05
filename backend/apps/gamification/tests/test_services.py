import pytest
from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model

from apps.gamification.models import (
    XPTransaction, UserStats, Badge, UserBadge,
)
from apps.gamification.services import (
    award_xp,
    check_streak,
    check_badges,
    get_level,
    get_or_create_stats,
)

User = get_user_model()


class TestGetLevel:
    def test_zero_xp(self):
        name, idx = get_level(0)
        assert name == "Debutant"
        assert idx == 0

    def test_100_xp(self):
        name, idx = get_level(100)
        assert name == "Explorateur"
        assert idx == 1

    def test_499_xp(self):
        name, idx = get_level(499)
        assert name == "Explorateur"
        assert idx == 1

    def test_500_xp(self):
        name, idx = get_level(500)
        assert name == "Apprenti"
        assert idx == 2

    def test_10000_xp(self):
        name, idx = get_level(10000)
        assert name == "Expert"
        assert idx == 5

    def test_above_max(self):
        name, idx = get_level(999999)
        assert name == "Expert"
        assert idx == 5


@pytest.mark.django_db
class TestGetOrCreateStats:
    def test_creates_stats_if_missing(self):
        user = User.objects.create_user(username="s1", password="testpass123")
        stats = get_or_create_stats(user)
        assert stats.total_xp == 0
        assert stats.pk is not None

    def test_returns_existing_stats(self):
        user = User.objects.create_user(username="s2", password="testpass123")
        existing = UserStats.objects.create(user=user, total_xp=100)
        stats = get_or_create_stats(user)
        assert stats.pk == existing.pk
        assert stats.total_xp == 100


@pytest.mark.django_db
class TestAwardXP:
    def test_creates_transaction_and_updates_stats(self):
        user = User.objects.create_user(username="a1", password="testpass123")
        stats, txn, new_badges = award_xp(user, "quiz_correct", 5)
        assert txn.xp_amount == 5
        assert txn.activity_type == "quiz_correct"
        assert stats.total_xp == 5

    def test_accumulates_xp(self):
        user = User.objects.create_user(username="a2", password="testpass123")
        award_xp(user, "quiz_correct", 5)
        stats, txn, _ = award_xp(user, "quiz_correct", 5)
        assert stats.total_xp == 10

    def test_updates_level_when_threshold_crossed(self):
        user = User.objects.create_user(username="a3", password="testpass123")
        stats, _, _ = award_xp(user, "quiz_perfect", 100)
        assert stats.level == 1  # Explorateur

    def test_with_source_id(self):
        user = User.objects.create_user(username="a4", password="testpass123")
        _, txn, _ = award_xp(user, "quiz_correct", 5, source_id="session_1")
        assert txn.source_id == "session_1"

    def test_triggers_badge_check(self):
        user = User.objects.create_user(username="a5", password="testpass123")
        Badge.objects.create(
            name="XP Starter",
            description="Earn 10 XP",
            icon="star",
            criteria_type="total_xp",
            criteria_value=10,
        )
        award_xp(user, "quiz_correct", 5)
        _, _, new_badges = award_xp(user, "quiz_correct", 5)
        assert len(new_badges) == 1
        assert new_badges[0].badge.name == "XP Starter"


@pytest.mark.django_db
class TestCheckStreak:
    def test_first_activity_starts_streak(self):
        user = User.objects.create_user(username="st1", password="testpass123")
        today = date(2026, 4, 4)
        stats = check_streak(user, today)
        assert stats.current_streak == 1
        assert stats.last_active_date == today

    def test_same_day_no_change(self):
        user = User.objects.create_user(username="st2", password="testpass123")
        today = date(2026, 4, 4)
        check_streak(user, today)
        stats = check_streak(user, today)
        assert stats.current_streak == 1

    def test_next_day_increments(self):
        user = User.objects.create_user(username="st3", password="testpass123")
        day1 = date(2026, 4, 4)
        day2 = date(2026, 4, 5)
        check_streak(user, day1)
        stats = check_streak(user, day2)
        assert stats.current_streak == 2
        assert stats.longest_streak == 2

    def test_gap_resets_streak(self):
        user = User.objects.create_user(username="st4", password="testpass123")
        day1 = date(2026, 4, 4)
        day3 = date(2026, 4, 6)  # skipped day 5
        check_streak(user, day1)
        stats = check_streak(user, day3)
        assert stats.current_streak == 1
        assert stats.longest_streak == 1

    def test_longest_streak_preserved(self):
        user = User.objects.create_user(username="st5", password="testpass123")
        # Build a 3-day streak
        check_streak(user, date(2026, 4, 1))
        check_streak(user, date(2026, 4, 2))
        check_streak(user, date(2026, 4, 3))
        # Gap, then restart
        stats = check_streak(user, date(2026, 4, 5))
        assert stats.current_streak == 1
        assert stats.longest_streak == 3


@pytest.mark.django_db
class TestCheckBadges:
    def test_awards_xp_badge(self):
        user = User.objects.create_user(username="b1", password="testpass123")
        Badge.objects.create(
            name="XP 100",
            description="Earn 100 XP",
            icon="gem",
            criteria_type="total_xp",
            criteria_value=100,
        )
        UserStats.objects.create(user=user, total_xp=100)
        new_badges = check_badges(user)
        assert len(new_badges) == 1
        assert new_badges[0].badge.name == "XP 100"

    def test_does_not_re_award(self):
        user = User.objects.create_user(username="b2", password="testpass123")
        badge = Badge.objects.create(
            name="XP 100",
            description="Earn 100 XP",
            icon="gem",
            criteria_type="total_xp",
            criteria_value=100,
        )
        UserStats.objects.create(user=user, total_xp=100)
        UserBadge.objects.create(user=user, badge=badge)
        new_badges = check_badges(user)
        assert len(new_badges) == 0

    def test_streak_badge(self):
        user = User.objects.create_user(username="b3", password="testpass123")
        Badge.objects.create(
            name="Week Warrior",
            description="7-day streak",
            icon="fire",
            criteria_type="streak_days",
            criteria_value=7,
        )
        UserStats.objects.create(user=user, current_streak=7)
        new_badges = check_badges(user)
        assert len(new_badges) == 1

    def test_level_badge(self):
        user = User.objects.create_user(username="b4", password="testpass123")
        Badge.objects.create(
            name="Apprenti Badge",
            description="Reach Apprenti",
            icon="medal",
            criteria_type="level",
            criteria_value=500,
        )
        UserStats.objects.create(user=user, total_xp=500, level=2)
        new_badges = check_badges(user)
        assert len(new_badges) == 1
