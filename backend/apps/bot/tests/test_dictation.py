from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from telegram.ext import ConversationHandler

from apps.bot.handlers.dictation import (
    WAITING_FOR_ANSWER,
    dictation_answer,
    dictation_cancel,
    dictation_command,
)


@pytest.fixture
def update():
    mock = AsyncMock()
    mock.message = AsyncMock()
    mock.message.reply_text = AsyncMock()
    mock.message.reply_audio = AsyncMock()
    return mock


@pytest.fixture
def context():
    mock = MagicMock()
    mock.user_data = {}
    return mock


@pytest.mark.django_db
class TestDictationCommand:
    @pytest.mark.asyncio
    @patch("apps.bot.handlers.dictation.get_or_create_audio")
    @patch("apps.bot.handlers.dictation.Vocabulary")
    async def test_starts_dictation(self, MockVocab, mock_audio, update, context):
        mock_vocab = MagicMock()
        mock_vocab.example_sentence = "Bonjour, comment allez-vous?"
        MockVocab.objects.exclude.return_value.order_by.return_value.first.return_value = mock_vocab

        mock_clip = MagicMock()
        mock_clip.id = 1
        mock_clip.audio_file.path = "/tmp/test.mp3"
        mock_audio.return_value = mock_clip

        with patch("builtins.open", MagicMock()):
            result = await dictation_command(update, context)

        assert result == WAITING_FOR_ANSWER
        assert context.user_data["dictation_expected"] == "Bonjour, comment allez-vous?"
        update.message.reply_text.assert_called()

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.dictation.Vocabulary")
    async def test_no_sentences_available(self, MockVocab, update, context):
        MockVocab.objects.exclude.return_value.order_by.return_value.first.return_value = None

        result = await dictation_command(update, context)

        assert result == ConversationHandler.END
        update.message.reply_text.assert_called_once()


@pytest.mark.django_db
class TestDictationAnswer:
    @pytest.mark.asyncio
    async def test_correct_answer(self, update, context):
        context.user_data["dictation_expected"] = "Bonjour"
        update.message.text = "Bonjour"

        result = await dictation_answer(update, context)

        assert result == ConversationHandler.END
        call_args = update.message.reply_text.call_args[0][0]
        assert "100%" in call_args

    @pytest.mark.asyncio
    async def test_incorrect_answer(self, update, context):
        context.user_data["dictation_expected"] = "Bonjour le monde"
        update.message.text = "Au revoir"

        result = await dictation_answer(update, context)

        assert result == ConversationHandler.END
        call_args = update.message.reply_text.call_args[0][0]
        assert "Expected" in call_args

    @pytest.mark.asyncio
    async def test_no_expected_text(self, update, context):
        update.message.text = "something"

        result = await dictation_answer(update, context)

        assert result == ConversationHandler.END


class TestDictationCancel:
    @pytest.mark.asyncio
    async def test_cancel(self, update, context):
        context.user_data["dictation_expected"] = "test"

        result = await dictation_cancel(update, context)

        assert result == ConversationHandler.END
        assert "dictation_expected" not in context.user_data
