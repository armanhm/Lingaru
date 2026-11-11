"""XP awards from progress endpoints are idempotent per real-world event (#67)."""

from datetime import date, timedelta
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.content.models import Lesson, Question, Topic, Vocabulary
from apps.gamification.models import UserStats, XPTransaction
from apps.progress.models import SRSCard

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="xpuser", email="xp@example.com", password="testpass123!"
    )


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def lesson(db):
    topic = Topic.objects.create(
        name_fr="T", name_en="T", description="", icon="x", order=1, difficulty_level=1
    )
    return Lesson.objects.create(
        topic=topic, type="vocab", title="L", content={}, order=1, difficulty=1
    )


@pytest.fixture
def card(user, lesson):
    vocab = Vocabulary.objects.create(lesson=lesson, french="pomme", english="apple")
    return SRSCard.objects.create(
        user=user, vocabulary=vocab, next_review_at=timezone.now() - timedelta(hours=1)
    )


def _review(client, card, quality=5):
    return client.post(
        "/api/progress/srs/review/", {"card_id": card.id, "quality": quality}, format="json"
    )


def _total_xp(user):
    return UserStats.objects.get(user=user).total_xp


@pytest.mark.django_db
class TestSRSReviewXP:
    def test_repeat_review_same_day_awards_once(self, client, user, card):
        assert _review(client, card).status_code == 200
        assert _review(client, card).status_code == 200
        txns = XPTransaction.objects.filter(user=user, activity_type="srs_review")
        assert txns.count() == 1
        assert _total_xp(user) == 10

    def test_failed_then_relearned_same_day_awards_once(self, client, user, card):
        # quality < 3 resets repetitions, which used to produce a colliding key
        _review(client, card, quality=1)
        _review(client, card, quality=5)
        _review(client, card, quality=1)
        assert XPTransaction.objects.filter(user=user, activity_type="srs_review").count() == 1

    def test_review_on_a_later_day_awards_again(self, client, user, card):
        with patch("django.utils.timezone.localdate", return_value=date(2026, 11, 10)):
            _review(client, card)
        with patch("django.utils.timezone.localdate", return_value=date(2026, 11, 11)):
            _review(client, card)
        keys = set(
            XPTransaction.objects.filter(user=user, activity_type="srs_review").values_list(
                "source_id", flat=True
            )
        )
        assert keys == {
            f"srs_card_{card.id}_2026-11-10",
            f"srs_card_{card.id}_2026-11-11",
        }
        assert _total_xp(user) == 20


@pytest.mark.django_db
class TestConjugationXP:
    def test_repeat_correct_answer_awards_once(self, client, user, lesson):
        question = Question.objects.create(
            lesson=lesson,
            type="conjugation",
            prompt="Conjugate manger (present, je)",
            correct_answer="mange",
            wrong_answers=[],
            difficulty=2,
        )
        body = {"verb": "manger", "tense": "present", "subject": "je", "answer": "mange"}
        for _ in range(3):
            assert (
                client.post("/api/progress/conjugation/check/", body, format="json").status_code
                == 200
            )
        txns = XPTransaction.objects.filter(user=user, activity_type="conjugation_drill")
        assert list(txns.values_list("source_id", flat=True)) == [f"conjugation_{question.id}"]
        assert _total_xp(user) == 10


@pytest.mark.django_db
class TestLessonCompleteXP:
    def test_repeat_completion_awards_once(self, client, user, lesson):
        url = f"/api/progress/lessons/{lesson.id}/complete/"
        client.post(url, {"score": 3, "total_questions": 5}, format="json")
        client.post(url, {"score": 5, "total_questions": 5}, format="json")
        txns = XPTransaction.objects.filter(user=user, activity_type="lesson_complete")
        assert list(txns.values_list("source_id", flat=True)) == [f"lesson_{lesson.id}"]
        assert _total_xp(user) == 50
