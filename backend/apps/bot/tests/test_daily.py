from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.bot.handlers.daily import _get_due_card_list, _get_user_by_telegram_id, daily_command
from apps.content.models import Lesson, Topic, Vocabulary
from apps.progress.models import SRSCard

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="botdaily",
        email="daily@example.com",
        password="testpass123!",
        telegram_id=12345,
    )


@pytest.fixture
def vocab(db):
    topic = Topic.objects.create(
        name_fr="Test",
        name_en="Test",
        description="",
        icon="t",
        order=1,
        difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic,
        type="vocab",
        title="Test",
        content={},
        order=1,
        difficulty=1,
    )
    return Vocabulary.objects.create(
        lesson=lesson,
        french="bonjour",
        english="hello",
        pronunciation="/bɔ̃ʒuʁ/",
        gender="a",
        part_of_speech="interjection",
    )


@pytest.fixture
def due_card(user, vocab):
    return SRSCard.objects.create(
        user=user,
        vocabulary=vocab,
        next_review_at=timezone.now() - timedelta(hours=1),
    )


def _make_update(telegram_user_id):
    update = MagicMock()
    update.effective_user.id = telegram_user_id
    update.message.reply_text = AsyncMock()
    return update


@pytest.mark.django_db
class TestDailyHelpers:
    """Test the sync helper functions directly."""

    def test_get_user_returns_none_for_unknown(self):
        result = _get_user_by_telegram_id(99999)
        assert result is None

    def test_get_user_returns_user(self, user):
        result = _get_user_by_telegram_id(user.telegram_id)
        assert result == user

    def test_get_due_card_list_empty(self, user):
        cards = _get_due_card_list(user)
        assert cards == []

    def test_get_due_card_list_with_due(self, user, due_card):
        cards = _get_due_card_list(user)
        assert len(cards) == 1
        assert cards[0].vocabulary.french == "bonjour"

    def test_get_due_card_list_excludes_future(self, user, vocab):
        SRSCard.objects.create(
            user=user,
            vocabulary=vocab,
            next_review_at=timezone.now() + timedelta(days=1),
        )
        cards = _get_due_card_list(user)
        assert cards == []


@pytest.mark.django_db
class TestDailyCommand:
    """Test the async command handler with mocked DB access."""

    @pytest.mark.asyncio
    async def test_unlinked_user(self):
        update = _make_update(telegram_user_id=99999)
        with patch(
            "apps.bot.handlers.daily.sync_to_async",
            return_value=AsyncMock(return_value=None),
        ):
            await daily_command(update, MagicMock())
        update.message.reply_text.assert_called_once()
        assert "haven't linked" in update.message.reply_text.call_args[0][0]

    @pytest.mark.asyncio
    async def test_no_due_cards(self, user):
        update = _make_update(telegram_user_id=user.telegram_id)

        call_count = 0

        def fake_sync_to_async(fn):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return AsyncMock(return_value=user)
            return AsyncMock(return_value=[])

        with patch("apps.bot.handlers.daily.sync_to_async", side_effect=fake_sync_to_async):
            await daily_command(update, MagicMock())
        assert "all caught up" in update.message.reply_text.call_args[0][0]

    @pytest.mark.asyncio
    async def test_with_due_cards(self, user, due_card):
        update = _make_update(telegram_user_id=user.telegram_id)

        call_count = 0

        def fake_sync_to_async(fn):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return AsyncMock(return_value=user)
            return AsyncMock(return_value=[due_card])

        with patch("apps.bot.handlers.daily.sync_to_async", side_effect=fake_sync_to_async):
            await daily_command(update, MagicMock())
        text = update.message.reply_text.call_args[0][0]
        assert "1 card(s) due" in text
        assert "bonjour" in text
