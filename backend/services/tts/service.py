import logging
import re

from django.conf import settings

from apps.media.models import AudioClip
from .gemini_provider import GeminiTTSProvider
from .gtts_provider import GTTSProvider

logger = logging.getLogger(__name__)


def strip_markdown(text: str) -> str:
    """Remove markdown formatting so TTS reads clean plain text."""
    # Remove code blocks
    text = re.sub(r"```[\s\S]*?```", "", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    # Remove headers (### Header)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # Remove bold/italic (**, *, __, _)
    text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", text)
    text = re.sub(r"_{1,3}([^_]+)_{1,3}", r"\1", text)
    # Remove links [text](url)
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)
    # Remove bullet/numbered list markers
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)
    # Remove blockquotes
    text = re.sub(r"^>\s+", "", text, flags=re.MULTILINE)
    # Remove horizontal rules
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    # Collapse multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def get_or_create_audio(text: str, language: str = "fr") -> AudioClip:
    """Return an AudioClip for the given text, generating audio if needed.

    Checks the database first (cache). If not found, generates via gTTS,
    saves the file, and creates the AudioClip record.

    Args:
        text: The text to synthesize.
        language: BCP-47 language code.

    Returns:
        AudioClip instance (saved).
    """
    # Strip markdown so TTS reads clean plain text
    clean_text = strip_markdown(text)

    # Check DB cache (use clean text as key)
    clip = AudioClip.objects.filter(text_content=clean_text, language=language).first()
    if clip:
        logger.debug("TTS DB cache hit: text='%s'", clean_text[:50])
        return clip

    # Generate audio — prefer Gemini TTS, fall back to gTTS
    if settings.GEMINI_API_KEY:
        try:
            provider = GeminiTTSProvider()
            result = provider.synthesize(text=clean_text, language=language)
        except Exception as exc:
            logger.warning("Gemini TTS failed, falling back to gTTS: %s", exc)
            provider = GTTSProvider()
            result = provider.synthesize(text=clean_text, language=language)
    else:
        provider = GTTSProvider()
        result = provider.synthesize(text=clean_text, language=language)

    # Create DB record
    clip = AudioClip.objects.create(
        text_content=clean_text,
        audio_file=result.audio_path,
        language=language,
        provider=result.provider,
    )

    logger.info("AudioClip created: id=%d, text='%s'", clip.id, clean_text[:50])
    return clip
