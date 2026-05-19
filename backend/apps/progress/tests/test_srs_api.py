from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.content.models import Lesson, Topic, Vocabulary
from apps.progress.models import SRSCard

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="srsuser",
        email="srs@example.com",
        password="testpass123!",
    )


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def vocab_item(db):
    topic = Topic.objects.create(
        name_fr="Nourriture",
        name_en="Food",
        description="Food vocab",
        icon="fork",
        order=1,
        difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic,
        type="vocab",
        title="Fruits",
        content={},
        order=1,
        difficulty=1,
    )
    return Vocabulary.objects.create(
        lesson=lesson,
        french="pomme",
        english="apple",
        pronunciation="/pom/",
        example_sentence="Je mange une pomme.",
        gender="f",
        part_of_speech="noun",
    )


@pytest.fixture
def due_card(user, vocab_item):
    return SRSCard.objects.create(
        user=user,
        vocabulary=vocab_item,
        ease_factor=2.5,
        interval_days=0,
        repetitions=0,
        next_review_at=timezone.now() - timedelta(hours=1),
    )


@pytest.mark.django_db
class TestSRSDueCards:
    def test_returns_due_cards(self, authenticated_client, due_card):
        response = authenticated_client.get("/api/progress/srs/due/")
        assert response.status_code == 200
        assert response.data["count"] == 1
        assert response.data["cards"][0]["french"] == "pomme"

    def test_excludes_future_cards(self, authenticated_client, user, vocab_item):
        SRSCard.objects.create(
            user=user,
            vocabulary=vocab_item,
            next_review_at=timezone.now() + timedelta(days=5),
        )
        response = authenticated_client.get("/api/progress/srs/due/")
        assert response.data["count"] == 0

    def test_unauthenticated_rejected(self, api_client):
        response = api_client.get("/api/progress/srs/due/")
        assert response.status_code == 401

    def test_filters_by_target_language(self, authenticated_client, user, vocab_item, due_card):
        """Cards backed by vocabulary in a different language are excluded.
        Switching target_language should hide the old language's cards
        without deleting them, so progress is preserved across switches.
        """
        topic_en = Topic.objects.create(
            name_fr="Salutations EN",
            name_en="Greetings",
            description="EN greetings",
            icon="hand",
            order=2,
            difficulty_level=1,
            language="en",
        )
        lesson_en = Lesson.objects.create(
            topic=topic_en,
            type="vocab",
            title="Hello",
            content={},
            order=1,
            difficulty=1,
            language="en",
        )
        vocab_en = Vocabulary.objects.create(
            lesson=lesson_en,
            english="hello",
            french="bonjour",
            example_sentence="Hello there.",
            part_of_speech="interjection",
            language="en",
        )
        SRSCard.objects.create(
            user=user,
            vocabulary=vocab_en,
            ease_factor=2.5,
            interval_days=0,
            repetitions=0,
            next_review_at=timezone.now() - timedelta(hours=1),
        )

        # Default user.target_language=fr → only the FR card surfaces.
        response = authenticated_client.get("/api/progress/srs/due/")
        assert response.status_code == 200
        assert response.data["count"] == 1
        assert response.data["cards"][0]["french"] == "pomme"

        # Switch the learner to EN → only the EN card surfaces.
        user.target_language = "en"
        user.save(update_fields=["target_language"])
        response = authenticated_client.get("/api/progress/srs/due/")
        assert response.status_code == 200
        assert response.data["count"] == 1
        assert response.data["cards"][0]["english"] == "hello"


@pytest.mark.django_db
class TestSRSReview:
    def test_review_updates_card(self, authenticated_client, due_card):
        response = authenticated_client.post(
            "/api/progress/srs/review/",
            {"card_id": due_card.id, "quality": 5},
            format="json",
        )
        assert response.status_code == 200
        due_card.refresh_from_db()
        assert due_card.repetitions == 1
        assert due_card.interval_days == 1
        assert due_card.last_quality == 5

    def test_review_invalid_quality(self, authenticated_client, due_card):
        response = authenticated_client.post(
            "/api/progress/srs/review/",
            {"card_id": due_card.id, "quality": 7},
            format="json",
        )
        assert response.status_code == 400

    def test_review_card_not_found(self, authenticated_client):
        response = authenticated_client.post(
            "/api/progress/srs/review/",
            {"card_id": 9999, "quality": 4},
            format="json",
        )
        assert response.status_code == 404
