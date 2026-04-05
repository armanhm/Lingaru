import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def registered_user(db):
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123!",
    )


@pytest.mark.django_db
class TestRegisterView:
    def test_register_success(self, api_client):
        url = reverse("users:register")
        data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "strongpass123!",
            "password_confirm": "strongpass123!",
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == 201
        assert response.data["username"] == "newuser"
        assert response.data["email"] == "new@example.com"
        assert "password" not in response.data
        assert User.objects.filter(username="newuser").exists()

    def test_register_password_mismatch(self, api_client):
        url = reverse("users:register")
        data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "strongpass123!",
            "password_confirm": "wrongpass!",
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == 400


@pytest.mark.django_db
class TestLoginView:
    def test_login_success(self, api_client, registered_user):
        url = reverse("users:token_obtain")
        data = {"username": "testuser", "password": "testpass123!"}
        response = api_client.post(url, data, format="json")
        assert response.status_code == 200
        assert "access" in response.data
        assert "refresh" in response.data

    def test_login_wrong_password(self, api_client, registered_user):
        url = reverse("users:token_obtain")
        data = {"username": "testuser", "password": "wrongpass!"}
        response = api_client.post(url, data, format="json")
        assert response.status_code == 401


@pytest.mark.django_db
class TestMeView:
    def test_get_profile_authenticated(self, api_client, registered_user):
        api_client.force_authenticate(user=registered_user)
        url = reverse("users:me")
        response = api_client.get(url)
        assert response.status_code == 200
        assert response.data["username"] == "testuser"
        assert response.data["email"] == "test@example.com"

    def test_get_profile_unauthenticated(self, api_client):
        url = reverse("users:me")
        response = api_client.get(url)
        assert response.status_code == 401

    def test_update_profile(self, api_client, registered_user):
        api_client.force_authenticate(user=registered_user)
        url = reverse("users:me")
        response = api_client.patch(
            url, {"daily_goal_minutes": 30, "target_level": "B2"}, format="json"
        )
        assert response.status_code == 200
        assert response.data["daily_goal_minutes"] == 30
        assert response.data["target_level"] == "B2"
