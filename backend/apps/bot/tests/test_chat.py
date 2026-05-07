from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from telegram import Chat, Update
from telegram import Message as TGMessage
from telegram import User as TGUser

from apps.bot.handlers.chat import (
    CHATTING,
    chat_end,
    chat_message,
    chat_start,
)
from services.llm.base import LLMResponse


def make_update(text, user_id=123, first_name="Test", username="testuser"):
    """Create a mock Telegram Update."""
    update = MagicMock(spec=Update)
    update.effective_user = MagicMock(spec=TGUser)
    update.effective_user.id = user_id
    update.effective_user.first_name = first_name
    update.effective_user.username = username
    update.message = MagicMock(spec=TGMessage)
    update.message.text = text
    update.message.reply_text = AsyncMock()
    return update


def make_context():
    """Create a mock context with user_data dict."""
    context = MagicMock()
    context.user_data = {}
    context.args = []
    return context


@pytest.mark.django_db
class TestChatStart:
    @pytest.mark.asyncio
    async def test_chat_start_sends_welcome(self):
        update = make_update("/chat")
        context = make_context()

        result = await chat_start(update, context)

        assert result == CHATTING
        update.message.reply_text.assert_called_once()
        call_text = update.message.reply_text.call_args[0][0]
        assert "conversation" in call_text.lower() or "chat" in call_text.lower()
        assert "conversation_id" in context.user_data


@pytest.mark.django_db
class TestChatMessage:
    @pytest.mark.asyncio
    @patch("apps.bot.handlers.chat.create_llm_router")
    async def test_chat_message_gets_ai_response(self, mock_factory):
        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="Bonjour! Comment allez-vous?",
            provider="gemini",
            tokens_used=20,
        )
        mock_factory.return_value = mock_router

        update = make_update("/chat")
        context = make_context()
        # Start chat first to set up context
        await chat_start(update, context)

        # Now send a message
        update2 = make_update("Bonjour!")
        result = await chat_message(update2, context)

        assert result == CHATTING
        update2.message.reply_text.assert_called_once()
        call_text = update2.message.reply_text.call_args[0][0]
        assert "Bonjour" in call_text

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.chat.create_llm_router")
    async def test_chat_message_handles_llm_error(self, mock_factory):
        mock_router = MagicMock()
        mock_router.generate.side_effect = Exception("API down")
        mock_factory.return_value = mock_router

        update = make_update("/chat")
        context = make_context()
        await chat_start(update, context)

        update2 = make_update("Bonjour!")
        result = await chat_message(update2, context)

        assert result == CHATTING
        call_text = update2.message.reply_text.call_args[0][0]
        assert "sorry" in call_text.lower() or "unavailable" in call_text.lower()


@pytest.mark.django_db
class TestChatEnd:
    @pytest.mark.asyncio
    async def test_chat_end_cleans_up(self):
        update = make_update("/chat")
        context = make_context()
        await chat_start(update, context)

        update2 = make_update("/endchat")
        from telegram.ext import ConversationHandler

        result = await chat_end(update2, context)

        assert result == ConversationHandler.END
        assert "conversation_id" not in context.user_data
