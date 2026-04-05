import logging

from apps.media.models import AudioClip
from .gtts_provider import GTTSProvider

logger = logging.getLogger(__name__)


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
    # Check DB cache
    clip = AudioClip.objects.filter(text_content=text, language=language).first()
    if clip:
        logger.debug("TTS DB cache hit: text='%s'", text[:50])
        return clip

    # Generate audio
    provider = GTTSProvider()
    result = provider.synthesize(text=text, language=language)

    # Create DB record
    clip = AudioClip.objects.create(
        text_content=text,
        audio_file=result.audio_path,
        language=language,
        provider=result.provider,
    )

    logger.info("AudioClip created: id=%d, text='%s'", clip.id, text[:50])
    return clip
