import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.content.models import (
    Topic,
    Lesson,
    Vocabulary,
    GrammarRule,
    ReadingText,
    Question,
)

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, db):
    user = User.objects.create_user(
        username="testuser", email="test@example.com", password="testpass123!",
    )
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def sample_topic(db):
    return Topic.objects.create(
        name_fr="Les salutations", name_en="Greetings",
        description="Basic greetings", icon="wave", order=1, difficulty_level=1,
    )


@pytest.fixture
def sample_lesson(sample_topic):
    return Lesson.objects.create(
        topic=sample_topic, type="vocab", title="Hello & Goodbye",
        content={"intro": "Greetings"}, order=1, difficulty=1,
    )


@pytest.fixture
def populated_lesson(sample_lesson):
    Vocabulary.objects.create(
        lesson=sample_lesson, french="bonjour", english="hello",
        pronunciation="b\u0254\u0303\u0292u\u0281", example_sentence="Bonjour!",
        gender="n", part_of_speech="interjection",
    )
    Vocabulary.objects.create(
        lesson=sample_lesson, french="au revoir", english="goodbye",
        pronunciation="o \u0281\u0259vwa\u0281", example_sentence="Au revoir!",
        gender="n", part_of_speech="interjection",
    )
    Question.objects.create(
        lesson=sample_lesson, type="mcq", prompt="What does bonjour mean?",
        correct_answer="hello", wrong_answers=["goodbye", "thanks"],
        explanation="Bonjour means hello.", difficulty=1,
    )
    return sample_lesson


@pytest.mark.django_db
class TestTopicListView:
    def test_list_topics_authenticated(self, authenticated_client, sample_topic):
        response = authenticated_client.get("/api/content/topics/")
        assert response.status_code == 200
        results = response.data["results"]
        assert len(results) == 1
        assert results[0]["name_fr"] == "Les salutations"
        assert "lesson_count" in results[0]

    def test_list_topics_unauthenticated(self, api_client, sample_topic):
        response = api_client.get("/api/content/topics/")
        assert response.status_code == 401

    def test_list_topics_ordered(self, authenticated_client, db):
        Topic.objects.create(name_fr="Second", name_en="Second", order=2, difficulty_level=1)
        Topic.objects.create(name_fr="First", name_en="First", order=1, difficulty_level=1)
        response = authenticated_client.get("/api/content/topics/")
        results = response.data["results"]
        assert results[0]["name_fr"] == "First"
        assert results[1]["name_fr"] == "Second"


@pytest.mark.django_db
class TestTopicDetailView:
    def test_topic_detail_with_lessons(self, authenticated_client, sample_topic, sample_lesson):
        response = authenticated_client.get(f"/api/content/topics/{sample_topic.id}/")
        assert response.status_code == 200
        assert response.data["name_fr"] == "Les salutations"
        assert len(response.data["lessons"]) == 1
        assert response.data["lessons"][0]["title"] == "Hello & Goodbye"

    def test_topic_detail_not_found(self, authenticated_client):
        response = authenticated_client.get("/api/content/topics/999/")
        assert response.status_code == 404

    def test_topic_detail_unauthenticated(self, api_client, sample_topic):
        response = api_client.get(f"/api/content/topics/{sample_topic.id}/")
        assert response.status_code == 401


@pytest.mark.django_db
class TestLessonDetailView:
    def test_lesson_detail_with_content(self, authenticated_client, populated_lesson):
        response = authenticated_client.get(f"/api/content/lessons/{populated_lesson.id}/")
        assert response.status_code == 200
        assert response.data["title"] == "Hello & Goodbye"
        assert len(response.data["vocabulary"]) == 2
        assert len(response.data["questions"]) == 1
        assert response.data["topic"]["name_fr"] == "Les salutations"

    def test_lesson_detail_not_found(self, authenticated_client):
        response = authenticated_client.get("/api/content/lessons/999/")
        assert response.status_code == 404

    def test_lesson_detail_unauthenticated(self, api_client, sample_lesson):
        response = api_client.get(f"/api/content/lessons/{sample_lesson.id}/")
        assert response.status_code == 401

    def test_lesson_detail_with_grammar(self, authenticated_client, sample_topic):
        lesson = Lesson.objects.create(
            topic=sample_topic, type="grammar", title="Articles",
            content={}, order=2, difficulty=2,
        )
        GrammarRule.objects.create(
            lesson=lesson, title="Definite Articles",
            explanation="Le, la, les", formula="le/la/les",
            examples=["le chat"], exceptions=[],
        )
        response = authenticated_client.get(f"/api/content/lessons/{lesson.id}/")
        assert response.status_code == 200
        assert len(response.data["grammar_rules"]) == 1

    def test_lesson_detail_with_reading_text(self, authenticated_client, sample_topic):
        lesson = Lesson.objects.create(
            topic=sample_topic, type="text", title="Cafe",
            content={}, order=3, difficulty=1,
        )
        ReadingText.objects.create(
            lesson=lesson, title="Au cafe", content_fr="Bonjour...",
            content_en="Hello...", vocabulary_highlights=["bonjour"],
            comprehension_questions=[{"q": "Where?", "a": "Cafe"}],
        )
        response = authenticated_client.get(f"/api/content/lessons/{lesson.id}/")
        assert response.status_code == 200
        assert len(response.data["reading_texts"]) == 1
