import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.content.models import Lesson, Question, Topic
from apps.progress.models import MistakeEntry

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="mistakeuser",
        email="mistakes@example.com",
        password="testpass123!",
    )


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def sample_mistakes(user, db):
    topic = Topic.objects.create(
        name_fr="Grammaire",
        name_en="Grammar",
        description="",
        icon="book",
        order=1,
        difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic,
        type="grammar",
        title="Les articles",
        content={},
        order=1,
        difficulty=1,
    )
    q = Question.objects.create(
        lesson=lesson,
        type="fill_blank",
        prompt="__ chat est noir.",
        correct_answer="Le",
        wrong_answers=[],
        explanation="Le = masculine article.",
        difficulty=1,
    )
    m1 = MistakeEntry.objects.create(
        user=user,
        question=q,
        user_answer="La",
        correct_answer="Le",
        mistake_type="gender",
    )
    m2 = MistakeEntry.objects.create(
        user=user,
        question=q,
        user_answer="Les",
        correct_answer="Le",
        mistake_type="gender",
    )
    m3 = MistakeEntry.objects.create(
        user=user,
        question=None,
        user_answer="mangez",
        correct_answer="mange",
        mistake_type="conjugation",
    )
    return [m1, m2, m3]


@pytest.mark.django_db
class TestMistakeList:
    def test_lists_all_mistakes(self, authenticated_client, sample_mistakes):
        response = authenticated_client.get("/api/progress/mistakes/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 3

    def test_filter_by_type(self, authenticated_client, sample_mistakes):
        response = authenticated_client.get("/api/progress/mistakes/?type=conjugation")
        assert len(response.data["results"]) == 1

    def test_filter_by_reviewed(self, authenticated_client, sample_mistakes):
        response = authenticated_client.get("/api/progress/mistakes/?reviewed=false")
        assert len(response.data["results"]) == 3


@pytest.mark.django_db
class TestMistakeMarkReviewed:
    def test_mark_reviewed(self, authenticated_client, sample_mistakes):
        ids = [m.id for m in sample_mistakes[:2]]
        response = authenticated_client.post(
            "/api/progress/mistakes/reviewed/",
            {"mistake_ids": ids},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["updated"] == 2
        assert MistakeEntry.objects.filter(reviewed=True).count() == 2


@pytest.mark.django_db
class TestMistakeAutoRecording:
    """Verify that wrong quiz answers create MistakeEntry records."""

    def test_wrong_answer_creates_mistake(self, authenticated_client, user):
        topic = Topic.objects.create(
            name_fr="Test",
            name_en="Test",
            description="",
            icon="t",
            order=1,
            difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic,
            type="vocab",
            title="Test Lesson",
            content={},
            order=1,
            difficulty=1,
        )
        question = Question.objects.create(
            lesson=lesson,
            type="mcq",
            prompt="What is bonjour?",
            correct_answer="hello",
            wrong_answers=["bye", "thanks", "please"],
            explanation="Bonjour = hello.",
            difficulty=1,
        )

        # Start quiz
        resp = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": lesson.id},
            format="json",
        )
        session_id = resp.data["session_id"]

        # Submit wrong answer
        authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": question.id, "answer": "bye"},
            format="json",
        )

        assert MistakeEntry.objects.filter(user=user).count() == 1
        mistake = MistakeEntry.objects.first()
        assert mistake.user_answer == "bye"
        assert mistake.correct_answer == "hello"
        assert mistake.question == question
