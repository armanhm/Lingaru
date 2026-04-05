import logging

from django.conf import settings
from groq import Groq

from .base import BaseSTTProvider, STTResult

logger = logging.getLogger(__name__)

WHISPER_MODEL = "whisper-large-v3"


class GroqWhisperProvider(BaseSTTProvider):
    """Speech-to-text using Groq's hosted Whisper model."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.client = Groq(api_key=self.api_key)

    def transcribe(self, audio_file, language: str = "fr") -> STTResult:
        response = self.client.audio.transcriptions.create(
            model=WHISPER_MODEL,
            file=audio_file,
            language=language,
            response_format="text",
        )

        transcription = response.strip() if isinstance(response, str) else response.text.strip()

        logger.info(
            "STT transcription: language=%s, length=%d chars",
            language, len(transcription),
        )

        return STTResult(
            transcription=transcription,
            provider="groq_whisper",
            language=language,
        )
