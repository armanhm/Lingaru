import pytest
from django.contrib.auth import get_user_model
from apps.users.serializers import RegisterSerializer, UserSerializer

User = get_user_model()


@pytest.mark.django_db
class TestRegisterSerializer:
    def test_valid_registration(self):
        data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "strongpass123!",
            "password_confirm": "strongpass123!",
        }
        serializer = RegisterSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        user = serializer.save()
        assert user.username == "newuser"
        assert user.email == "new@example.com"
        assert user.check_password("strongpass123!")

    def test_password_mismatch(self):
        data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "strongpass123!",
            "password_confirm": "differentpass!",
        }
        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert "password_confirm" in serializer.errors

    def test_duplicate_email(self):
        User.objects.create_user(
            username="existing", email="taken@example.com", password="pass123!"
        )
        data = {
            "username": "newuser",
            "email": "taken@example.com",
            "password": "strongpass123!",
            "password_confirm": "strongpass123!",
        }
        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert "email" in serializer.errors


@pytest.mark.django_db
class TestUserSerializer:
    def test_serializes_user(self):
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="pass123!",
            telegram_id=123456,
            target_level="B1",
            daily_goal_minutes=30,
        )
        serializer = UserSerializer(user)
        data = serializer.data
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"
        assert data["telegram_id"] == 123456
        assert data["target_level"] == "B1"
        assert data["daily_goal_minutes"] == 30
        assert "password" not in data
