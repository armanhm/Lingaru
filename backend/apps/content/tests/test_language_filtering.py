import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.content.models import Lesson, Topic, Vocabulary

User = get_user_model()


@pytest.mark.django_db
def test_topics_list_filtered_by_target_language():
    fr_user = User.objects.create_user(
        username="fr_user", email="fr@x.com", password="x", target_language="fr"
    )
    en_user = User.objects.create_user(
        username="en_user", email="en@x.com", password="x", target_language="en"
    )
    Topic.objects.create(
        name_fr="Salutations FR",
        name_en="Greetings FR",
        order=1,
        difficulty_level=1,
        language="fr",
    )
    Topic.objects.create(
        name_fr="Salutations EN",
        name_en="Greetings EN",
        order=2,
        difficulty_level=1,
        language="en",
    )

    fr_client = APIClient()
    fr_client.force_authenticate(fr_user)
    en_client = APIClient()
    en_client.force_authenticate(en_user)

    fr_response = fr_client.get("/api/content/topics/")
    en_response = en_client.get("/api/content/topics/")

    assert fr_response.status_code == 200
    assert en_response.status_code == 200

    fr_data = fr_response.json()
    en_data = en_response.json()
    # Handle both paginated and non-paginated shapes:
    fr_list = fr_data.get("results", fr_data) if isinstance(fr_data, dict) else fr_data
    en_list = en_data.get("results", en_data) if isinstance(en_data, dict) else en_data

    fr_names = [t["name_fr"] for t in fr_list]
    en_names = [t["name_fr"] for t in en_list]
    assert "Salutations FR" in fr_names
    assert "Salutations EN" not in fr_names
    assert "Salutations EN" in en_names
    assert "Salutations FR" not in en_names


@pytest.mark.django_db
def test_topic_detail_returns_404_for_cross_language():
    en_user = User.objects.create_user(
        username="x", email="x@x.com", password="x", target_language="en"
    )
    fr_topic = Topic.objects.create(
        name_fr="FR Topic",
        name_en="FR Topic",
        order=1,
        difficulty_level=1,
        language="fr",
    )

    client = APIClient()
    client.force_authenticate(en_user)
    response = client.get(f"/api/content/topics/{fr_topic.pk}/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_random_vocabulary_respects_target_language():
    en_user = User.objects.create_user(
        username="y", email="y@x.com", password="x", target_language="en"
    )
    t = Topic.objects.create(
        name_fr="x",
        name_en="x",
        order=1,
        difficulty_level=1,
        language="fr",
    )
    fr_lesson = Lesson.objects.create(
        topic=t, title="L", order=1, type="vocab", difficulty=1, language="fr"
    )
    Vocabulary.objects.create(lesson=fr_lesson, french="chat", english="cat", language="fr")

    client = APIClient()
    client.force_authenticate(en_user)
    response = client.get("/api/content/vocabulary/random/?count=1")
    # No EN vocab seeded => 404 (RandomVocabularyView returns 404 on empty).
    assert response.status_code == 404
