import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def user_data():
    return {
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpass123!",
    }


@pytest.fixture
def create_user(db, user_data):
    user = User.objects.create_user(**user_data)
    return user


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, create_user):
    api_client.force_authenticate(user=create_user)
    return api_client
