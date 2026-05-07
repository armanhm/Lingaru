from datetime import date

import pytest
from django.contrib.auth import get_user_model

from apps.gamification.models import Badge, UserBadge, UserStats, XPTransaction

User = get_user_model()


@pytest.mark.django_db
class TestUserStats:
    def test_created_with_defaults(self):
        user = User.objects.create_user(username="alice", password="testpass123")
        stats = UserStats.objects.create(user=user)
        assert stats.total_xp == 0
        assert stats.level == 0
        assert stats.current_streak == 0
        assert stats.longest_streak == 0
        assert stats.streak_freeze_available is False
        assert stats.last_active_date is None

    def test_one_to_one_with_user(self):
        user = User.objects.create_user(username="bob", password="testpass123")
        stats = UserStats.objects.create(user=user)
        assert user.stats == stats

    def test_str(self):
        user = User.objects.create_user(username="carol", password="testpass123")
        stats = UserStats.objects.create(user=user, total_xp=500, level=2)
        assert "carol" in str(stats)
        assert "500" in str(stats)


@pytest.mark.django_db
class TestXPTransaction:
    def test_create_transaction(self):
        user = User.objects.create_user(username="dave", password="testpass123")
        txn = XPTransaction.objects.create(
            user=user,
            activity_type="quiz_correct",
            xp_amount=5,
        )
        assert txn.xp_amount == 5
        assert txn.activity_type == "quiz_correct"
        assert txn.source_id is None
        assert txn.created_at is not None

    def test_with_source_id(self):
        user = User.objects.create_user(username="eve", password="testpass123")
        txn = XPTransaction.objects.create(
            user=user,
            activity_type="quiz_perfect",
            xp_amount=25,
            source_id="session_42",
        )
        assert txn.source_id == "session_42"


@pytest.mark.django_db
class TestBadge:
    def test_create_badge(self):
        badge = Badge.objects.create(
            name="First Quiz",
            description="Complete your first quiz",
            icon="trophy",
            criteria_type="quizzes_completed",
            criteria_value=1,
        )
        assert str(badge) == "First Quiz"

    def test_unique_name(self):
        Badge.objects.create(
            name="Unique Badge",
            description="Test",
            icon="star",
            criteria_type="total_xp",
            criteria_value=100,
        )
        with pytest.raises(Exception):
            Badge.objects.create(
                name="Unique Badge",
                description="Duplicate",
                icon="star",
                criteria_type="total_xp",
                criteria_value=200,
            )


@pytest.mark.django_db
class TestUserBadge:
    def test_award_badge(self):
        user = User.objects.create_user(username="frank", password="testpass123")
        badge = Badge.objects.create(
            name="Test Badge",
            description="Test",
            icon="star",
            criteria_type="total_xp",
            criteria_value=100,
        )
        ub = UserBadge.objects.create(user=user, badge=badge)
        assert ub.earned_at is not None
        assert ub.badge == badge

    def test_unique_user_badge(self):
        user = User.objects.create_user(username="grace", password="testpass123")
        badge = Badge.objects.create(
            name="Another Badge",
            description="Test",
            icon="star",
            criteria_type="total_xp",
            criteria_value=100,
        )
        UserBadge.objects.create(user=user, badge=badge)
        with pytest.raises(Exception):
            UserBadge.objects.create(user=user, badge=badge)
