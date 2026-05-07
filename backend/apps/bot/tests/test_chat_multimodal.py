from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from asgiref.sync import sync_to_async
from telegram import Chat, PhotoSize, Update, Voice
from telegram import Message as TGMessage
from telegram import User as TGUser

from apps.assistant.models import Conversation, ImageQuery, Message
from apps.bot.handlers.chat import (
    CHATTING,
    chat_photo,
    chat_start,
    chat_voice,
)
from services.llm.base import LLMResponse
from services.stt.base import STTResult


def make_update_with_photo(user_id=123, first_name="Test", username="testuser", caption=""):
    """Create a mock Telegram Update with a photo."""
    update = MagicMock(spec=Update)
    update.effective_user = MagicMock(spec=TGUser)
    update.effective_user.id = user_id
    update.effective_user.first_name = first_name
    update.effective_user.username = username
    update.message = MagicMock(spec=TGMessage)
    update.message.reply_text = AsyncMock()
    update.message.caption = caption

    # Mock photo array (Telegram sends multiple sizes, we take [-1])
    mock_photo = MagicMock(spec=PhotoSize)
    mock_file = MagicMock()
    mock_file.download_as_bytearray = AsyncMock(return_value=bytearray(b"fake-image-bytes"))
    mock_photo.get_file = AsyncMock(return_value=mock_file)
    update.message.photo = [mock_photo]

    return update


def make_update_with_voice(user_id=123, first_name="Test", username="testuser"):
    """Create a mock Telegram Update with a voice message."""
    update = MagicMock(spec=Update)
    update.effective_user = MagicMock(spec=TGUser)
    update.effective_user.id = user_id
    update.effective_user.first_name = first_name
    update.effective_user.username = username
    update.message = MagicMock(spec=TGMessage)
    update.message.reply_text = AsyncMock()
    update.message.reply_voice = AsyncMock()

    mock_voice = MagicMock(spec=Voice)
    mock_file = MagicMock()
    mock_file.download_as_bytearray = AsyncMock(return_value=bytearray(b"fake-audio-bytes"))
    mock_voice.get_file = AsyncMock(return_value=mock_file)
    update.message.voice = mock_voice

    return update


def make_context(conversation_id=None, user_id=None):
    """Create a mock context with user_data dict."""
    context = MagicMock()
    context.user_data = {}
    if conversation_id is not None:
        context.user_data["conversation_id"] = conversation_id
    if user_id is not None:
        context.user_data["user_id"] = user_id
    context.args = []
    return context


@pytest.mark.django_db
class TestChatPhoto:
    """Test that photo messages in /chat mode trigger image queries."""

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.chat.create_llm_router")
    async def test_photo_message_calls_vision_and_replies(self, mock_factory):
        """Photo in chat triggers Gemini Vision and replies with analysis."""
        # Start a chat first to get conversation_id and user_id
        from apps.bot.handlers.chat import chat_start

        start_update = MagicMock(spec=Update)
        start_update.effective_user = MagicMock(spec=TGUser)
        start_update.effective_user.id = 111222
        start_update.effective_user.first_name = "Photo"
        start_update.effective_user.username = "photouser"
        start_update.message = MagicMock(spec=TGMessage)
        start_update.message.reply_text = AsyncMock()

        context = make_context()
        await chat_start(start_update, context)

        # Now send a photo
        mock_router = MagicMock()
        mock_router.generate_with_image.return_value = LLMResponse(
            content="This is a French sign saying 'Interdit de stationner'.",
            provider="gemini",
            tokens_used=100,
        )
        mock_factory.return_value = mock_router

        photo_update = make_update_with_photo(user_id=111222, caption="What does this say?")

        result = await chat_photo(photo_update, context)

        assert result == CHATTING
        mock_router.generate_with_image.assert_called_once()
        call_kwargs = mock_router.generate_with_image.call_args
        assert call_kwargs.kwargs["image_data"] == b"fake-image-bytes"

        # Should reply with "Analyzing..." then the AI response
        reply_texts = [call.args[0] for call in photo_update.message.reply_text.call_args_list]
        assert "Analyzing your image..." in reply_texts
        assert any("Interdit" in t for t in reply_texts)

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.chat.create_llm_router")
    async def test_photo_saves_image_query(self, mock_factory):
        """Photo handler saves an ImageQuery record."""
        start_update = MagicMock(spec=Update)
        start_update.effective_user = MagicMock(spec=TGUser)
        start_update.effective_user.id = 111333
        start_update.effective_user.first_name = "Photo2"
        start_update.effective_user.username = "photo2user"
        start_update.message = MagicMock(spec=TGMessage)
        start_update.message.reply_text = AsyncMock()

        context = make_context()
        await chat_start(start_update, context)

        mock_router = MagicMock()
        mock_router.generate_with_image.return_value = LLMResponse(
            content="A French menu.",
            provider="gemini",
            tokens_used=50,
        )
        mock_factory.return_value = mock_router

        photo_update = make_update_with_photo(user_id=111333, caption="Menu?")
        await chat_photo(photo_update, context)

        iq_exists = await sync_to_async(
            ImageQuery.objects.filter(
                question="Menu?",
                ai_response="A French menu.",
            ).exists
        )()
        assert iq_exists

    @pytest.mark.asyncio
    async def test_photo_no_conversation_ends(self):
        """Photo with no active conversation returns END."""
        from telegram.ext import ConversationHandler

        photo_update = make_update_with_photo()
        context = make_context()  # no conversation_id

        result = await chat_photo(photo_update, context)
        assert result == ConversationHandler.END

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.chat.create_llm_router")
    async def test_photo_vision_error_handled(self, mock_factory):
        """Vision API error is handled gracefully."""
        start_update = MagicMock(spec=Update)
        start_update.effective_user = MagicMock(spec=TGUser)
        start_update.effective_user.id = 111444
        start_update.effective_user.first_name = "PhotoErr"
        start_update.effective_user.username = "photoerruser"
        start_update.message = MagicMock(spec=TGMessage)
        start_update.message.reply_text = AsyncMock()

        context = make_context()
        await chat_start(start_update, context)

        mock_router = MagicMock()
        mock_router.generate_with_image.side_effect = Exception("Vision API down")
        mock_factory.return_value = mock_router

        photo_update = make_update_with_photo(user_id=111444)
        result = await chat_photo(photo_update, context)

        assert result == CHATTING
        reply_texts = [call.args[0] for call in photo_update.message.reply_text.call_args_list]
        assert any("unavailable" in t.lower() for t in reply_texts)


@pytest.mark.django_db
class TestChatVoice:
    """Test that voice messages in /chat mode trigger voice conversation."""

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.chat.get_or_create_audio")
    @patch("apps.bot.handlers.chat.create_llm_router")
    @patch("apps.bot.handlers.chat.GroqWhisperProvider")
    async def test_voice_message_full_pipeline(
        self,
        mock_stt_cls,
        mock_factory,
        mock_tts,
    ):
        """Voice in chat: download -> STT -> LLM -> TTS -> reply."""
        # Start chat
        start_update = MagicMock(spec=Update)
        start_update.effective_user = MagicMock(spec=TGUser)
        start_update.effective_user.id = 333444
        start_update.effective_user.first_name = "Voice"
        start_update.effective_user.username = "voiceuser"
        start_update.message = MagicMock(spec=TGMessage)
        start_update.message.reply_text = AsyncMock()

        context = make_context()
        await chat_start(start_update, context)

        # Setup mocks
        mock_stt = MagicMock()
        mock_stt.transcribe.return_value = STTResult(
            transcription="Bonjour",
            provider="groq_whisper",
            language="fr",
        )
        mock_stt_cls.return_value = mock_stt

        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="Bonjour! Comment ca va?",
            provider="gemini",
            tokens_used=30,
        )
        mock_factory.return_value = mock_router

        mock_clip = MagicMock()
        mock_clip.audio_file.path = "/tmp/fake_audio.mp3"
        mock_tts.return_value = mock_clip

        voice_update = make_update_with_voice(user_id=333444)

        with patch("builtins.open", MagicMock()):
            result = await chat_voice(voice_update, context)

        assert result == CHATTING
        mock_stt.transcribe.assert_called_once()
        mock_router.generate.assert_called_once()

        # Should have "I heard" and the LLM response in replies
        reply_texts = [call.args[0] for call in voice_update.message.reply_text.call_args_list]
        assert any("Bonjour" in t for t in reply_texts)
        assert any("Comment" in t for t in reply_texts)

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.chat.GroqWhisperProvider")
    async def test_voice_stt_error_handled(self, mock_stt_cls):
        """STT failure is handled gracefully."""
        start_update = MagicMock(spec=Update)
        start_update.effective_user = MagicMock(spec=TGUser)
        start_update.effective_user.id = 333555
        start_update.effective_user.first_name = "VoiceErr"
        start_update.effective_user.username = "voiceerruser"
        start_update.message = MagicMock(spec=TGMessage)
        start_update.message.reply_text = AsyncMock()

        context = make_context()
        await chat_start(start_update, context)

        mock_stt = MagicMock()
        mock_stt.transcribe.side_effect = Exception("STT down")
        mock_stt_cls.return_value = mock_stt

        voice_update = make_update_with_voice(user_id=333555)
        result = await chat_voice(voice_update, context)

        assert result == CHATTING
        reply_texts = [call.args[0] for call in voice_update.message.reply_text.call_args_list]
        assert any("couldn't understand" in t.lower() for t in reply_texts)

    @pytest.mark.asyncio
    async def test_voice_no_conversation_ends(self):
        """Voice with no active conversation returns END."""
        from telegram.ext import ConversationHandler

        voice_update = make_update_with_voice()
        context = make_context()  # no conversation_id

        result = await chat_voice(voice_update, context)
        assert result == ConversationHandler.END

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.chat.get_or_create_audio")
    @patch("apps.bot.handlers.chat.create_llm_router")
    @patch("apps.bot.handlers.chat.GroqWhisperProvider")
    async def test_voice_saves_messages(
        self,
        mock_stt_cls,
        mock_factory,
        mock_tts,
    ):
        """Voice handler saves user and assistant messages."""
        start_update = MagicMock(spec=Update)
        start_update.effective_user = MagicMock(spec=TGUser)
        start_update.effective_user.id = 333666
        start_update.effective_user.first_name = "VoiceMsg"
        start_update.effective_user.username = "voicemsguser"
        start_update.message = MagicMock(spec=TGMessage)
        start_update.message.reply_text = AsyncMock()

        context = make_context()
        await chat_start(start_update, context)

        mock_stt = MagicMock()
        mock_stt.transcribe.return_value = STTResult(
            transcription="Comment allez-vous?",
            provider="groq_whisper",
            language="fr",
        )
        mock_stt_cls.return_value = mock_stt

        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="Je vais bien, merci!",
            provider="gemini",
            tokens_used=25,
        )
        mock_factory.return_value = mock_router

        mock_clip = MagicMock()
        mock_clip.audio_file.path = "/tmp/fake_audio.mp3"
        mock_tts.return_value = mock_clip

        voice_update = make_update_with_voice(user_id=333666)

        with patch("builtins.open", MagicMock()):
            await chat_voice(voice_update, context)

        conversation_id = context.user_data["conversation_id"]
        user_msg_exists = await sync_to_async(
            Message.objects.filter(
                conversation_id=conversation_id,
                role="user",
                content="Comment allez-vous?",
            ).exists
        )()
        assistant_msg_exists = await sync_to_async(
            Message.objects.filter(
                conversation_id=conversation_id,
                role="assistant",
                content="Je vais bien, merci!",
            ).exists
        )()
        assert user_msg_exists
        assert assistant_msg_exists

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.chat.get_or_create_audio")
    @patch("apps.bot.handlers.chat.create_llm_router")
    @patch("apps.bot.handlers.chat.GroqWhisperProvider")
    async def test_voice_tts_failure_still_sends_text(
        self,
        mock_stt_cls,
        mock_factory,
        mock_tts,
    ):
        """If TTS fails, the text response is still sent."""
        start_update = MagicMock(spec=Update)
        start_update.effective_user = MagicMock(spec=TGUser)
        start_update.effective_user.id = 333777
        start_update.effective_user.first_name = "VoiceTTS"
        start_update.effective_user.username = "voicettsuser"
        start_update.message = MagicMock(spec=TGMessage)
        start_update.message.reply_text = AsyncMock()

        context = make_context()
        await chat_start(start_update, context)

        mock_stt = MagicMock()
        mock_stt.transcribe.return_value = STTResult(
            transcription="Salut",
            provider="groq_whisper",
            language="fr",
        )
        mock_stt_cls.return_value = mock_stt

        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="Salut! Tout va bien?",
            provider="gemini",
            tokens_used=20,
        )
        mock_factory.return_value = mock_router

        # TTS fails
        mock_tts.side_effect = Exception("TTS service down")

        voice_update = make_update_with_voice(user_id=333777)
        result = await chat_voice(voice_update, context)

        assert result == CHATTING
        # Text response should still be sent even if TTS fails
        reply_texts = [call.args[0] for call in voice_update.message.reply_text.call_args_list]
        assert any("Tout va bien" in t for t in reply_texts)
