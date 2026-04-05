import pytest
from django.contrib.auth import get_user_model
from apps.bot.handlers.start import get_or_create_telegram_user

User = get_user_model()


@pytest.mark.django_db
class TestGetOrCreateTelegramUser:
    def test_create_new_user_from_telegram(self):
        """When no user exists with this telegram_id, create one."""
        user, created = get_or_create_telegram_user(
            telegram_id=123456789,
            first_name="Jean",
            username="jean_fr",
        )
        assert created is True
        assert user.telegram_id == 123456789
        assert user.username == "tg_123456789"
        assert user.first_name == "Jean"

    def test_find_existing_user_by_telegram_id(self):
        """When a user already has this telegram_id, return them."""
        existing = User.objects.create_user(
            username="existing_user",
            email="existing@example.com",
            password="testpass123!",
            telegram_id=123456789,
        )
        user, created = get_or_create_telegram_user(
            telegram_id=123456789,
            first_name="Jean",
            username="jean_fr",
        )
        assert created is False
        assert user.pk == existing.pk

    def test_create_user_without_telegram_username(self):
        """Handle Telegram users who have no username set."""
        user, created = get_or_create_telegram_user(
            telegram_id=987654321,
            first_name="Marie",
            username=None,
        )
        assert created is True
        assert user.telegram_id == 987654321
        assert user.username == "tg_987654321"

    def test_create_user_sets_unusable_password(self):
        """Telegram-created users should not be able to log in via password."""
        user, created = get_or_create_telegram_user(
            telegram_id=111222333,
            first_name="Pierre",
            username="pierre_fr",
        )
        assert created is True
        assert user.has_usable_password() is False

    def test_duplicate_telegram_username_gets_suffixed(self):
        """If tg_<id> username is taken, the user is still created."""
        User.objects.create_user(
            username="tg_555666777",
            email="taken@example.com",
            password="testpass123!",
        )
        user, created = get_or_create_telegram_user(
            telegram_id=555666777,
            first_name="Luc",
            username="luc_fr",
        )
        assert created is True
        assert user.telegram_id == 555666777
        # Username should be different since tg_555666777 was taken
        assert user.username != "tg_555666777"
        assert user.username.startswith("tg_555666777_")
