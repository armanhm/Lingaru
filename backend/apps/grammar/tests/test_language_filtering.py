import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.grammar.models import GrammarCategory, GrammarTopic

User = get_user_model()


@pytest.mark.django_db
def test_grammar_hub_filtered_by_language():
    en_user = User.objects.create_user(
        username="g", email="g@x.com", password="x", target_language="en"
    )
    fr_cat = GrammarCategory.objects.create(name="FR Cat", slug="fr-cat", language="fr")
    en_cat = GrammarCategory.objects.create(name="EN Cat", slug="en-cat", language="en")
    # Each category needs at least one active topic so hub doesn't skip it.
    GrammarTopic.objects.create(
        category=fr_cat,
        title="FR Topic",
        slug="fr-topic",
        explanation=".",
        language="fr",
        is_active=True,
    )
    GrammarTopic.objects.create(
        category=en_cat,
        title="EN Topic",
        slug="en-topic",
        explanation=".",
        language="en",
        is_active=True,
    )

    client = APIClient()
    client.force_authenticate(en_user)
    response = client.get("/api/grammar/hub/")
    assert response.status_code == 200
    body = response.json()
    # The hub payload is {"categories": [...]}
    if isinstance(body, dict):
        categories = body.get("categories", body.get("results", body))
    else:
        categories = body
    cat_names = [c["name"] for c in categories] if isinstance(categories, list) else []
    assert "EN Cat" in cat_names
    assert "FR Cat" not in cat_names


@pytest.mark.django_db
def test_grammar_topic_slug_cross_language_returns_404():
    user = User.objects.create_user(
        username="g2", email="g2@x.com", password="x", target_language="en"
    )
    cat = GrammarCategory.objects.create(name="FR", slug="frc", language="fr")
    GrammarTopic.objects.create(
        category=cat,
        title="Le Présent",
        slug="le-present",
        explanation=".",
        language="fr",
    )

    client = APIClient()
    client.force_authenticate(user)
    response = client.get("/api/grammar/topics/le-present/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_grammar_topic_list_filtered_by_language():
    user = User.objects.create_user(
        username="g3", email="g3@x.com", password="x", target_language="en"
    )
    cat_fr = GrammarCategory.objects.create(name="FR Cat2", slug="fr-cat2", language="fr")
    cat_en = GrammarCategory.objects.create(name="EN Cat2", slug="en-cat2", language="en")
    GrammarTopic.objects.create(
        category=cat_fr,
        title="FR Only Topic",
        slug="fr-only-topic",
        explanation=".",
        language="fr",
        is_active=True,
    )
    GrammarTopic.objects.create(
        category=cat_en,
        title="EN Only Topic",
        slug="en-only-topic",
        explanation=".",
        language="en",
        is_active=True,
    )

    client = APIClient()
    client.force_authenticate(user)
    response = client.get("/api/grammar/topics/")
    assert response.status_code == 200
    body = response.json()
    titles = [t["title"] for t in body] if isinstance(body, list) else []
    assert "EN Only Topic" in titles
    assert "FR Only Topic" not in titles
