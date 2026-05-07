import pytest
from datetime import timedelta
from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.discover.models import DiscoverCard, UserDiscoverHistory
from apps.gamification.models import UserStats

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="testuser", email="test@example.com", password="testpass123",
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def sample_cards(db):
    now = timezone.now()
    cards = []
    for i, card_type in enumerate(["word", "grammar", "trivia", "news"]):
        card = DiscoverCard.objects.create(
            type=card_type,
            title=f"Card {i}",
            summary=f"Summary {i}",
            content_json={"data": f"content_{i}"},
            generated_at=now - timedelta(hours=i),
            expires_at=now + timedelta(hours=24),
        )
        cards.append(card)
    return cards


@pytest.mark.django_db
class TestFeedEndpoint:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.get("/api/discover/feed/")
        assert resp.status_code == 401

    def test_returns_cards(self, auth_client, sample_cards):
        resp = auth_client.get("/api/discover/feed/")
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        # /api/discover/feed/ excludes news cards (news has its own surface
        # at /api/news/), so only word + grammar + trivia are returned.
        assert len(data["results"]) == 3
        types = {r["type"] for r in data["results"]}
        assert "news" not in types

    def test_unseen_cards_come_first(self, auth_client, user, sample_cards):
        # Mark the newest card (index 0) as seen
        UserDiscoverHistory.objects.create(user=user, card=sample_cards[0])

        resp = auth_client.get("/api/discover/feed/")
        data = resp.json()
        results = data["results"]

        # The first 3 results should be unseen cards
        seen_ids = {sample_cards[0].pk}
        unseen_results = [r for r in results if r["id"] not in seen_ids]
        seen_results = [r for r in results if r["id"] in seen_ids]

        # Unseen cards appear before seen cards
        if unseen_results and seen_results:
            first_unseen_idx = next(
                i for i, r in enumerate(results) if r["id"] not in seen_ids
            )
            last_seen_idx = max(
                i for i, r in enumerate(results) if r["id"] in seen_ids
            )
            assert first_unseen_idx < last_seen_idx

    def test_excludes_expired_cards(self, auth_client, db):
        now = timezone.now()
        DiscoverCard.objects.create(
            type="word", title="Expired", content_json={},
            generated_at=now - timedelta(hours=48),
            expires_at=now - timedelta(hours=1),
        )
        DiscoverCard.objects.create(
            type="word", title="Active", content_json={},
            generated_at=now,
            expires_at=now + timedelta(hours=24),
        )

        resp = auth_client.get("/api/discover/feed/")
        data = resp.json()
        titles = [r["title"] for r in data["results"]]
        assert "Active" in titles
        assert "Expired" not in titles

    def test_includes_cards_with_no_expiry(self, auth_client, db):
        DiscoverCard.objects.create(
            type="trivia", title="No Expiry", content_json={},
            expires_at=None,
        )
        resp = auth_client.get("/api/discover/feed/")
        data = resp.json()
        assert len(data["results"]) == 1

    def test_marks_seen_and_interacted_fields(self, auth_client, user, sample_cards):
        UserDiscoverHistory.objects.create(
            user=user, card=sample_cards[0], interacted=False,
        )
        UserDiscoverHistory.objects.create(
            user=user, card=sample_cards[1], interacted=True,
        )

        resp = auth_client.get("/api/discover/feed/")
        data = resp.json()
        results_by_id = {r["id"]: r for r in data["results"]}

        assert results_by_id[sample_cards[0].pk]["seen"] is True
        assert results_by_id[sample_cards[0].pk]["interacted"] is False
        assert results_by_id[sample_cards[1].pk]["seen"] is True
        assert results_by_id[sample_cards[1].pk]["interacted"] is True
        assert results_by_id[sample_cards[2].pk]["seen"] is False


@pytest.mark.django_db
class TestGenerateMoreEndpoint:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.post("/api/discover/generate-more/")
        assert resp.status_code == 401

    @patch("apps.discover.views.generate_daily_cards")
    def test_generates_and_returns_cards(self, mock_generate, auth_client, db):
        now = timezone.now()
        mock_cards = [
            DiscoverCard.objects.create(
                type="word", title="New Word", content_json={},
                generated_at=now,
            ),
            DiscoverCard.objects.create(
                type="trivia", title="New Trivia", content_json={},
                generated_at=now,
            ),
        ]
        mock_generate.return_value = mock_cards

        resp = auth_client.post("/api/discover/generate-more/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["generated"] == 2
        assert len(data["cards"]) == 2
        mock_generate.assert_called_once()

    @patch("apps.discover.views.generate_daily_cards")
    def test_returns_empty_when_generation_fails(self, mock_generate, auth_client):
        mock_generate.return_value = []

        resp = auth_client.post("/api/discover/generate-more/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["generated"] == 0
        assert data["cards"] == []


@pytest.mark.django_db
class TestInteractEndpoint:
    def test_unauthenticated_returns_401(self, api_client, sample_cards):
        resp = api_client.post(f"/api/discover/cards/{sample_cards[0].pk}/interact/")
        assert resp.status_code == 401

    def test_interact_creates_history_and_awards_xp(self, auth_client, user, sample_cards):
        resp = auth_client.post(f"/api/discover/cards/{sample_cards[0].pk}/interact/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["xp_awarded"] == 3

        # History created
        history = UserDiscoverHistory.objects.get(user=user, card=sample_cards[0])
        assert history.interacted is True

    def test_interact_idempotent_no_double_xp(self, auth_client, user, sample_cards):
        url = f"/api/discover/cards/{sample_cards[0].pk}/interact/"
        resp1 = auth_client.post(url)
        assert resp1.json()["xp_awarded"] == 3

        resp2 = auth_client.post(url)
        assert resp2.json()["xp_awarded"] == 0
        assert resp2.json()["already_interacted"] is True

    def test_interact_nonexistent_card_returns_404(self, auth_client):
        resp = auth_client.post("/api/discover/cards/99999/interact/")
        assert resp.status_code == 404

    def test_interact_also_marks_seen(self, auth_client, user, sample_cards):
        auth_client.post(f"/api/discover/cards/{sample_cards[0].pk}/interact/")
        history = UserDiscoverHistory.objects.get(user=user, card=sample_cards[0])
        assert history.seen_at is not None
        assert history.interacted is True
