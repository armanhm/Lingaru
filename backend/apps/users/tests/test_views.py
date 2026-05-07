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
        # Registration creates an inactive user pending admin approval.
        assert response.status_code == 202
        assert response.data["status"] == "pending_approval"
        assert response.data["username"] == "newuser"
        assert response.data["email"] == "new@example.com"
        assert "password" not in response.data
        user = User.objects.get(username="newuser")
        assert user.is_active is False

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


@pytest.mark.django_db
class TestChangePasswordView:
    def test_change_password_success(self, api_client, registered_user):
        api_client.force_authenticate(user=registered_user)
        url = reverse("users:change_password")
        data = {
            "old_password": "testpass123!",
            "new_password": "newstrongpass456!",
        }
        response = api_client.put(url, data, format="json")
        assert response.status_code == 200
        assert response.data["detail"] == "Password updated successfully."
        registered_user.refresh_from_db()
        assert registered_user.check_password("newstrongpass456!")

    def test_change_password_wrong_old(self, api_client, registered_user):
        api_client.force_authenticate(user=registered_user)
        url = reverse("users:change_password")
        data = {
            "old_password": "wrongpassword!",
            "new_password": "newstrongpass456!",
        }
        response = api_client.put(url, data, format="json")
        assert response.status_code == 400
        assert "old_password" in response.data

    def test_change_password_too_short(self, api_client, registered_user):
        api_client.force_authenticate(user=registered_user)
        url = reverse("users:change_password")
        data = {
            "old_password": "testpass123!",
            "new_password": "short",
        }
        response = api_client.put(url, data, format="json")
        assert response.status_code == 400
        assert "new_password" in response.data

    def test_change_password_unauthenticated(self, api_client):
        url = reverse("users:change_password")
        data = {
            "old_password": "testpass123!",
            "new_password": "newstrongpass456!",
        }
        response = api_client.put(url, data, format="json")
        assert response.status_code == 401
