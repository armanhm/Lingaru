import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.content.models import Lesson, Question, Topic
from apps.gamification.models import UserStats, XPTransaction
from apps.practice.models import QuizAnswer, QuizSession

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="quizzer",
        email="q@example.com",
        password="testpass123",
    )


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def lesson_with_questions(db):
    topic = Topic.objects.create(
        name_fr="Sujet Test",
        name_en="Test Topic",
        order=1,
        difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic,
        type="vocab",
        title="Test Lesson",
        order=1,
        difficulty=1,
    )
    q1 = Question.objects.create(
        lesson=lesson,
        type="mcq",
        prompt="Q1?",
        correct_answer="oui",
        wrong_answers=["non", "peut-etre"],
        difficulty=1,
    )
    q2 = Question.objects.create(
        lesson=lesson,
        type="mcq",
        prompt="Q2?",
        correct_answer="bonjour",
        wrong_answers=["au revoir", "merci"],
        difficulty=1,
    )
    return lesson, [q1, q2]


@pytest.mark.django_db
class TestQuizXPIntegration:
    def test_completing_quiz_awards_xp(self, auth_client, user, lesson_with_questions):
        lesson, questions = lesson_with_questions

        # Start quiz
        resp = auth_client.post("/api/practice/quiz/start/", {"lesson_id": lesson.id})
        session_id = resp.json()["session_id"]

        # Answer both correctly
        for q in questions:
            auth_client.post(
                f"/api/practice/quiz/{session_id}/answer/",
                {"question_id": q.id, "answer": q.correct_answer},
            )

        # Complete quiz
        resp = auth_client.post(f"/api/practice/quiz/{session_id}/complete/")
        assert resp.status_code == 200

        # Verify XP was awarded
        stats = UserStats.objects.get(user=user)
        # 2 correct answers x 5 = 10, plus perfect score bonus 25 = 35
        assert stats.total_xp == 35
        assert XPTransaction.objects.filter(user=user).count() >= 2

    def test_partial_quiz_no_perfect_bonus(self, auth_client, user, lesson_with_questions):
        lesson, questions = lesson_with_questions

        resp = auth_client.post("/api/practice/quiz/start/", {"lesson_id": lesson.id})
        session_id = resp.json()["session_id"]

        # Answer first correctly, second wrong
        auth_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": questions[0].id, "answer": questions[0].correct_answer},
        )
        auth_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": questions[1].id, "answer": "wrong"},
        )

        auth_client.post(f"/api/practice/quiz/{session_id}/complete/")

        stats = UserStats.objects.get(user=user)
        # 1 correct x 5 = 5 (no perfect bonus)
        assert stats.total_xp == 5

    def test_completing_quiz_updates_streak(self, auth_client, user, lesson_with_questions):
        lesson, questions = lesson_with_questions

        resp = auth_client.post("/api/practice/quiz/start/", {"lesson_id": lesson.id})
        session_id = resp.json()["session_id"]

        for q in questions:
            auth_client.post(
                f"/api/practice/quiz/{session_id}/answer/",
                {"question_id": q.id, "answer": q.correct_answer},
            )

        auth_client.post(f"/api/practice/quiz/{session_id}/complete/")

        stats = UserStats.objects.get(user=user)
        assert stats.current_streak == 1
        assert stats.last_active_date is not None
