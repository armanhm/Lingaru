import pytest
from django.contrib.auth import get_user_model

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
