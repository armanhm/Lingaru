import hashlib
import logging
from pathlib import Path

from django.conf import settings
from gtts import gTTS

from .base import BaseTTSProvider, TTSResult

logger = logging.getLogger(__name__)


class GTTSProvider(BaseTTSProvider):
    """Text-to-speech using Google Translate TTS (gTTS). Free, no API key needed."""

    def synthesize(self, text: str, language: str = "fr") -> TTSResult:
        # Build a deterministic filename from text + language
        text_hash = hashlib.md5(f"{language}:{text}".encode()).hexdigest()
        filename = f"{text_hash}.mp3"
        relative_path = f"audio/{filename}"
        full_path = Path(settings.MEDIA_ROOT) / "audio" / filename

        # Skip generation if file already exists on disk
        if full_path.exists():
            logger.debug("TTS cache hit (disk): %s", relative_path)
            return TTSResult(audio_path=relative_path, provider="gtts")

        # Ensure the audio directory exists
        full_path.parent.mkdir(parents=True, exist_ok=True)

        # Generate audio
        tts = gTTS(text=text, lang=language, slow=False)
        tts.save(str(full_path))

        logger.info("TTS generated: text='%s', file='%s'", text[:50], relative_path)

        return TTSResult(audio_path=relative_path, provider="gtts")
