import hashlib
import pytest
from unittest.mock import patch, MagicMock

from services.tts.base import BaseTTSProvider, TTSResult
from services.tts.gtts_provider import GTTSProvider


class TestTTSResult:
    def test_fields(self):
        result = TTSResult(audio_path="audio/abc.mp3", provider="gtts")
        assert result.audio_path == "audio/abc.mp3"
        assert result.provider == "gtts"


class TestBaseTTSProvider:
    def test_cannot_instantiate_abstract(self):
        with pytest.raises(TypeError):
            BaseTTSProvider()


class TestGTTSProvider:
    @patch("services.tts.gtts_provider.gTTS")
    def test_synthesize_generates_file(self, MockGTTS, tmp_path, settings):
        settings.MEDIA_ROOT = tmp_path
        mock_tts_instance = MagicMock()
        MockGTTS.return_value = mock_tts_instance

        provider = GTTSProvider()
        result = provider.synthesize("Bonjour", language="fr")

        assert result.provider == "gtts"
        assert result.audio_path.startswith("audio/")
        assert result.audio_path.endswith(".mp3")
        MockGTTS.assert_called_once_with(text="Bonjour", lang="fr", slow=False)
        mock_tts_instance.save.assert_called_once()

    @patch("services.tts.gtts_provider.gTTS")
    def test_synthesize_returns_cached_file(self, MockGTTS, tmp_path, settings):
        settings.MEDIA_ROOT = tmp_path

        # Pre-create the expected file on disk
        audio_dir = tmp_path / "audio"
        audio_dir.mkdir()
        text_hash = hashlib.md5("fr:Bonjour".encode()).hexdigest()
        cached_file = audio_dir / f"{text_hash}.mp3"
        cached_file.write_text("fake audio data")

        provider = GTTSProvider()
        result = provider.synthesize("Bonjour", language="fr")

        assert result.provider == "gtts"
        # gTTS should NOT be called — we hit the disk cache
        MockGTTS.assert_not_called()

    @patch("services.tts.gtts_provider.gTTS")
    def test_synthesize_deterministic_filename(self, MockGTTS, tmp_path, settings):
        settings.MEDIA_ROOT = tmp_path
        MockGTTS.return_value = MagicMock()

        provider = GTTSProvider()
        result1 = provider.synthesize("Bonjour", language="fr")
        # Reset mock, simulate file exists on disk for second call
        (tmp_path / result1.audio_path).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / result1.audio_path).write_text("fake")

        result2 = provider.synthesize("Bonjour", language="fr")
        assert result1.audio_path == result2.audio_path
