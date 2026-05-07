from unittest.mock import MagicMock, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.assistant.models import Conversation, Message
from apps.users.models import User
from services.llm.base import LLMResponse
from services.stt.base import STTResult


class TestVoiceChatAPI(TestCase):
    """Test POST /api/assistant/voice-chat/ endpoint."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="voiceuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.url = "/api/assistant/voice-chat/"

    @patch("apps.assistant.views.get_or_create_audio")
    @patch("apps.assistant.views.create_llm_router")
    @patch("apps.assistant.views.GroqWhisperProvider")
    def test_voice_chat_full_pipeline(self, mock_stt_cls, mock_create_router, mock_tts):
        """Audio in -> STT -> LLM -> TTS -> response with text + audio."""
        # STT mock
        mock_stt = MagicMock()
        mock_stt.transcribe.return_value = STTResult(
            transcription="Bonjour, comment allez-vous?",
            provider="groq_whisper",
            language="fr",
        )
        mock_stt_cls.return_value = mock_stt

        # LLM mock
        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="Je vais bien, merci! Et vous?",
            provider="gemini",
            tokens_used=50,
        )
        mock_create_router.return_value = mock_router

        # TTS mock
        mock_clip = MagicMock()
        mock_clip.audio_file.url = "/media/audio/abc123.mp3"
        mock_tts.return_value = mock_clip

        audio = SimpleUploadedFile(
            "voice.webm",
            b"fake-audio-data",
            content_type="audio/webm",
        )
        response = self.client.post(
            self.url,
            {"audio": audio},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["transcription"], "Bonjour, comment allez-vous?")
        self.assertEqual(response.data["ai_response_text"], "Je vais bien, merci! Et vous?")
        self.assertIn("ai_response_audio_url", response.data)
        self.assertIn("conversation_id", response.data)

    @patch("apps.assistant.views.get_or_create_audio")
    @patch("apps.assistant.views.create_llm_router")
    @patch("apps.assistant.views.GroqWhisperProvider")
    def test_voice_chat_with_existing_conversation(
        self,
        mock_stt_cls,
        mock_create_router,
        mock_tts,
    ):
        """Voice chat can continue an existing conversation."""
        conv = Conversation.objects.create(user=self.user, title="Voice chat")

        mock_stt = MagicMock()
        mock_stt.transcribe.return_value = STTResult(
            transcription="Merci",
            provider="groq_whisper",
            language="fr",
        )
        mock_stt_cls.return_value = mock_stt

        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="De rien!",
            provider="gemini",
            tokens_used=20,
        )
        mock_create_router.return_value = mock_router

        mock_clip = MagicMock()
        mock_clip.audio_file.url = "/media/audio/def456.mp3"
        mock_tts.return_value = mock_clip

        audio = SimpleUploadedFile(
            "voice.webm",
            b"fake-audio",
            content_type="audio/webm",
        )
        response = self.client.post(
            self.url,
            {"audio": audio, "conversation_id": conv.id},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["conversation_id"], conv.id)

        # Verify messages saved to conversation
        messages = Message.objects.filter(conversation=conv)
        self.assertEqual(messages.count(), 2)
        self.assertEqual(messages.first().role, "user")
        self.assertEqual(messages.last().role, "assistant")

    def test_voice_chat_no_audio_returns_400(self):
        """Request without audio file returns 400."""
        response = self.client.post(self.url, {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("apps.assistant.views.GroqWhisperProvider")
    def test_voice_chat_stt_failure_returns_503(self, mock_stt_cls):
        """STT failure returns 503 with helpful message."""
        mock_stt = MagicMock()
        mock_stt.transcribe.side_effect = Exception("Whisper API down")
        mock_stt_cls.return_value = mock_stt

        audio = SimpleUploadedFile(
            "voice.webm",
            b"fake",
            content_type="audio/webm",
        )
        response = self.client.post(
            self.url,
            {"audio": audio},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    def test_voice_chat_requires_auth(self):
        """Unauthenticated request returns 401."""
        anon = APIClient()
        audio = SimpleUploadedFile(
            "voice.webm",
            b"fake",
            content_type="audio/webm",
        )
        response = anon.post(self.url, {"audio": audio}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
