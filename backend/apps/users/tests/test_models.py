import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
class TestUserModel:
    def test_create_user(self):
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123!",
        )
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.check_password("testpass123!")
        assert user.is_active
        assert not user.is_staff

    def test_create_user_with_telegram_id(self):
        user = User.objects.create_user(
            username="telegramuser",
            email="tg@example.com",
            password="testpass123!",
            telegram_id=123456789,
        )
        assert user.telegram_id == 123456789

    def test_create_user_default_fields(self):
        user = User.objects.create_user(
            username="defaultuser",
            email="default@example.com",
            password="testpass123!",
        )
        assert user.telegram_id is None
        assert user.native_language == "en"
        assert user.target_level == "B2"
        assert user.daily_goal_minutes == 15

    def test_create_superuser(self):
        user = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="adminpass123!",
        )
        assert user.is_staff
        assert user.is_superuser

    def test_user_str(self):
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123!",
        )
        assert str(user) == "testuser"
