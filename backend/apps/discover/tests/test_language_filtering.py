import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.discover.models import DiscoverCard

User = get_user_model()


@pytest.mark.django_db
def test_news_list_filtered_by_language():
    user = User.objects.create_user(
        username="n", email="n@x.com", password="x", target_language="en"
    )
    DiscoverCard.objects.create(
        type="news",
        topic="politics",
        title="FR News",
        summary="s",
        content_json={},
        generated_at=timezone.now(),
        level="B1",
        language="fr",
    )
    DiscoverCard.objects.create(
        type="news",
        topic="politics",
        title="EN News",
        summary="s",
        content_json={},
        generated_at=timezone.now(),
        level="B1",
        language="en",
    )

    client = APIClient()
    client.force_authenticate(user)
    response = client.get("/api/news/")
    assert response.status_code == 200
    body = response.json()
    # News payload is paginated: {count, results: {articles: [...], topics: [...]}}
    if isinstance(body, dict):
        results = body.get("results", body)
        if isinstance(results, dict):
            articles = results.get("articles", [])
        else:
            articles = results
    else:
        articles = body
    titles = [a["title"] for a in articles] if isinstance(articles, list) else []
    assert "EN News" in titles
    assert "FR News" not in titles


@pytest.mark.django_db
def test_discover_feed_filtered_by_language():
    """The Discover feed (non-news cards) also respects language."""
    user = User.objects.create_user(
        username="d", email="d@x.com", password="x", target_language="en"
    )
    DiscoverCard.objects.create(
        type="word",
        topic="general",
        title="FR Word",
        summary="s",
        content_json={},
        generated_at=timezone.now(),
        level="B1",
        language="fr",
    )
    DiscoverCard.objects.create(
        type="word",
        topic="general",
        title="EN Word",
        summary="s",
        content_json={},
        generated_at=timezone.now(),
        level="B1",
        language="en",
    )

    client = APIClient()
    client.force_authenticate(user)
    response = client.get("/api/discover/feed/")
    assert response.status_code == 200
    body = response.json()
    if isinstance(body, dict):
        cards = body.get("results", body.get("cards", []))
    else:
        cards = body
    titles = [c["title"] for c in cards] if isinstance(cards, list) else []
    assert "EN Word" in titles
    assert "FR Word" not in titles
