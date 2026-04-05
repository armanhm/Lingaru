import pytest
from datetime import date
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.gamification.models import Badge, UserBadge, UserStats, XPTransaction

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


@pytest.mark.django_db
class TestStatsEndpoint:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.get("/api/gamification/stats/")
        assert resp.status_code == 401

    def test_returns_stats_for_new_user(self, auth_client, user):
        resp = auth_client.get("/api/gamification/stats/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_xp"] == 0
        assert data["level"] == 0
        assert data["level_name"] == "Debutant"
        assert data["current_streak"] == 0
        assert data["longest_streak"] == 0

    def test_returns_existing_stats(self, auth_client, user):
        UserStats.objects.create(
            user=user, total_xp=500, level=2,
            current_streak=5, longest_streak=10,
            last_active_date=date(2026, 4, 4),
        )
        resp = auth_client.get("/api/gamification/stats/")
        data = resp.json()
        assert data["total_xp"] == 500
        assert data["level_name"] == "Apprenti"
        assert data["current_streak"] == 5

    def test_includes_rank(self, auth_client, user):
        UserStats.objects.create(user=user, total_xp=100)
        resp = auth_client.get("/api/gamification/stats/")
        data = resp.json()
        assert "rank" in data
        assert data["rank"] == 1


@pytest.mark.django_db
class TestBadgesEndpoint:
    def test_returns_earned_and_available(self, auth_client, user):
        b1 = Badge.objects.create(
            name="Earned Badge", description="d", icon="star",
            criteria_type="total_xp", criteria_value=0,
        )
        b2 = Badge.objects.create(
            name="Locked Badge", description="d", icon="lock",
            criteria_type="total_xp", criteria_value=9999,
        )
        UserBadge.objects.create(user=user, badge=b1)

        resp = auth_client.get("/api/gamification/badges/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["earned"]) == 1
        assert data["earned"][0]["name"] == "Earned Badge"
        assert len(data["available"]) == 1
        assert data["available"][0]["name"] == "Locked Badge"


@pytest.mark.django_db
class TestLeaderboardEndpoint:
    def test_returns_top_users(self, auth_client):
        for i in range(5):
            u = User.objects.create_user(
                username=f"leader{i}", email=f"leader{i}@example.com",
                password="testpass123",
            )
            UserStats.objects.create(user=u, total_xp=(5 - i) * 100)

        resp = auth_client.get("/api/gamification/leaderboard/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) == 5
        # First user has highest XP
        assert data["results"][0]["total_xp"] == 500

    def test_leaderboard_limited_to_top_50(self, auth_client):
        resp = auth_client.get("/api/gamification/leaderboard/")
        assert resp.status_code == 200


@pytest.mark.django_db
class TestHistoryEndpoint:
    def test_returns_recent_transactions(self, auth_client, user):
        for i in range(3):
            XPTransaction.objects.create(
                user=user, activity_type="quiz_correct", xp_amount=5,
            )
        resp = auth_client.get("/api/gamification/history/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) == 3
