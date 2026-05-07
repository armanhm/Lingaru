from datetime import date

import pytest
from django.contrib.auth import get_user_model

from apps.bot.handlers.stats import get_user_stats
from apps.content.models import Lesson, Question, Topic
from apps.gamification.models import Badge, UserBadge, UserStats
from apps.practice.models import QuizSession

User = get_user_model()


@pytest.fixture
def user_with_quizzes(db):
    user = User.objects.create_user(
        username="statsuser",
        email="stats@example.com",
        password="testpass123!",
        telegram_id=111222333,
    )
    topic = Topic.objects.create(
        name_fr="Grammaire",
        name_en="Grammar",
        description="Grammar basics",
        icon="book",
        order=1,
        difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic,
        type="grammar",
        title="Conjugation",
        content={},
        order=1,
        difficulty=1,
    )
    from django.utils import timezone

    QuizSession.objects.create(
        user=user,
        lesson=lesson,
        total_questions=5,
        score=4,
        completed_at=timezone.now(),
    )
    QuizSession.objects.create(
        user=user,
        lesson=lesson,
        total_questions=5,
        score=3,
        completed_at=timezone.now(),
    )
    return user


@pytest.mark.django_db
class TestGetUserStats:
    def test_returns_stats_for_user_with_quizzes(self, user_with_quizzes):
        stats = get_user_stats(user_with_quizzes)
        assert stats["quizzes_completed"] == 2
        assert stats["total_correct"] == 7
        assert stats["total_questions"] == 10

    def test_returns_zeroes_for_user_without_quizzes(self, db):
        user = User.objects.create_user(
            username="newuser",
            email="new@example.com",
            password="testpass123!",
            telegram_id=444555666,
        )
        stats = get_user_stats(user)
        assert stats["quizzes_completed"] == 0
        assert stats["total_correct"] == 0
        assert stats["total_questions"] == 0

    def test_stats_contain_expected_keys(self, user_with_quizzes):
        stats = get_user_stats(user_with_quizzes)
        assert "quizzes_completed" in stats
        assert "total_correct" in stats
        assert "total_questions" in stats
        assert "username" in stats
        assert "total_xp" in stats
        assert "level_name" in stats
        assert "current_streak" in stats
        assert "longest_streak" in stats
        assert "badges_count" in stats

    def test_includes_gamification_data(self):
        user = User.objects.create_user(
            username="tguser",
            password="testpass123",
        )
        UserStats.objects.create(
            user=user,
            total_xp=500,
            level=2,
            current_streak=5,
            longest_streak=10,
            last_active_date=date(2026, 4, 4),
        )
        badge = Badge.objects.create(
            name="First Quiz",
            description="Complete your first quiz",
            icon="trophy",
            criteria_type="quizzes_completed",
            criteria_value=1,
        )
        UserBadge.objects.create(user=user, badge=badge)

        stats = get_user_stats(user)
        assert stats["total_xp"] == 500
        assert stats["level_name"] == "Apprenti"
        assert stats["current_streak"] == 5
        assert stats["longest_streak"] == 10
        assert stats["badges_count"] == 1

    def test_new_user_gets_defaults(self):
        user = User.objects.create_user(
            username="newuser2",
            password="testpass123",
        )
        stats = get_user_stats(user)
        assert stats["total_xp"] == 0
        assert stats["level_name"] == "Debutant"
        assert stats["current_streak"] == 0
