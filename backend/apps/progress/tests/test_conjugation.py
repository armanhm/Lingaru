import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.content.models import Topic, Lesson, Question
from apps.progress.models import MistakeEntry

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="conjuser", email="conj@example.com", password="testpass123!",
    )


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def conjugation_questions(db):
    topic = Topic.objects.create(
        name_fr="Conjugaison", name_en="Conjugation",
        description="", icon="pen", order=1, difficulty_level=2,
    )
    lesson = Lesson.objects.create(
        topic=topic, type="grammar", title="Verb Drills",
        content={}, order=1, difficulty=2,
    )
    q1 = Question.objects.create(
        lesson=lesson, type="conjugation",
        prompt="Conjugate manger (present, je)",
        correct_answer="mange", wrong_answers=[],
        explanation="je mange (manger, present)", difficulty=2,
    )
    q2 = Question.objects.create(
        lesson=lesson, type="conjugation",
        prompt="Conjugate avoir (present, nous)",
        correct_answer="avons", wrong_answers=[],
        explanation="nous avons (avoir, present)", difficulty=2,
    )
    return [q1, q2]


@pytest.mark.django_db
class TestConjugationCheck:
    def test_correct_answer(self, authenticated_client, conjugation_questions):
        response = authenticated_client.post(
            "/api/progress/conjugation/check/",
            {"verb": "manger", "tense": "present", "subject": "je", "answer": "mange"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["is_correct"] is True

    def test_wrong_answer(self, authenticated_client, conjugation_questions, user):
        response = authenticated_client.post(
            "/api/progress/conjugation/check/",
            {"verb": "manger", "tense": "present", "subject": "je", "answer": "mangez"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["is_correct"] is False
        assert response.data["correct_answer"] == "mange"
        # Should auto-record mistake
        assert MistakeEntry.objects.filter(user=user, mistake_type="conjugation").count() == 1

    def test_missing_fields(self, authenticated_client, conjugation_questions):
        response = authenticated_client.post(
            "/api/progress/conjugation/check/",
            {"verb": "manger"},
            format="json",
        )
        assert response.status_code == 400

    def test_unknown_verb(self, authenticated_client, conjugation_questions):
        response = authenticated_client.post(
            "/api/progress/conjugation/check/",
            {"verb": "dormir", "tense": "present", "subject": "je", "answer": "dors"},
            format="json",
        )
        assert response.status_code == 404


@pytest.mark.django_db
class TestConjugationList:
    def test_returns_verbs_and_tenses(self, authenticated_client, conjugation_questions):
        response = authenticated_client.get("/api/progress/conjugation/verbs/")
        assert response.status_code == 200
        assert "manger" in response.data["verbs"]
        assert "avoir" in response.data["verbs"]
        assert "present" in response.data["tenses"]
