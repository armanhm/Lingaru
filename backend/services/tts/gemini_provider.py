import hashlib
import logging
import wave
from io import BytesIO
from pathlib import Path

from django.conf import settings
from google import genai
from google.genai import types

from .base import BaseTTSProvider, TTSResult

logger = logging.getLogger(__name__)

GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts"

# A natural French voice
VOICE_NAME = "Aoede"


def _pcm_to_wav(
    pcm_data: bytes, sample_rate: int = 24000, channels: int = 1, sample_width: int = 2
) -> bytes:
    """Wrap raw PCM bytes in a WAV container."""
    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)
    return buf.getvalue()


def _parse_sample_rate(mime_type: str) -> int:
    """Extract rate from mime type like 'audio/L16;codec=pcm;rate=24000'."""
    for part in mime_type.split(";"):
        part = part.strip()
        if part.startswith("rate="):
            try:
                return int(part.split("=")[1])
            except ValueError:
                pass
    return 24000  # default


class GeminiTTSProvider(BaseTTSProvider):
    """Text-to-speech using Google Gemini 2.5 Flash TTS preview."""

    def __init__(self):
        self._client = genai.Client(api_key=settings.GEMINI_API_KEY)

    def synthesize(self, text: str, language: str = "fr") -> TTSResult:
        # Deterministic filename based on text + voice
        text_hash = hashlib.md5(f"gemini-tts:{language}:{VOICE_NAME}:{text}".encode()).hexdigest()
        filename = f"{text_hash}.wav"
        relative_path = f"audio/{filename}"
        full_path = Path(settings.MEDIA_ROOT) / "audio" / filename

        # Return cached file if it already exists
        if full_path.exists():
            logger.debug("Gemini TTS cache hit (disk): %s", relative_path)
            return TTSResult(audio_path=relative_path, provider="gemini_tts")

        full_path.parent.mkdir(parents=True, exist_ok=True)

        # Call Gemini TTS — must use a contents list with explicit user turn
        response = self._client.models.generate_content(
            model=GEMINI_TTS_MODEL,
            contents=[
                types.Content(
                    role="user",
                    parts=[types.Part(text=text)],
                )
            ],
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=VOICE_NAME,
                        )
                    )
                ),
            ),
        )

        part = response.candidates[0].content.parts[0]
        pcm_data = part.inline_data.data
        sample_rate = _parse_sample_rate(part.inline_data.mime_type)

        wav_data = _pcm_to_wav(pcm_data, sample_rate=sample_rate)
        full_path.write_bytes(wav_data)

        logger.info("Gemini TTS generated: text='%s', file='%s'", text[:60], relative_path)
        return TTSResult(audio_path=relative_path, provider="gemini_tts")
