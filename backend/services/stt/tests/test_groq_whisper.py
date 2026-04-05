import pytest
from unittest.mock import patch, MagicMock

from services.stt.base import BaseSTTProvider, STTResult
from services.stt.groq_whisper import GroqWhisperProvider


class TestSTTResult:
    def test_fields(self):
        result = STTResult(
            transcription="bonjour", provider="groq_whisper", language="fr",
        )
        assert result.transcription == "bonjour"
        assert result.provider == "groq_whisper"
        assert result.language == "fr"


class TestBaseSTTProvider:
    def test_cannot_instantiate_abstract(self):
        with pytest.raises(TypeError):
            BaseSTTProvider()


class TestGroqWhisperProvider:
    @patch("services.stt.groq_whisper.Groq")
    def test_transcribe_success(self, MockGroq):
        mock_client = MagicMock()
        MockGroq.return_value = mock_client
        mock_client.audio.transcriptions.create.return_value = "Bonjour le monde"

        provider = GroqWhisperProvider(api_key="fake-key")
        result = provider.transcribe(
            audio_file=MagicMock(), language="fr",
        )

        assert result.transcription == "Bonjour le monde"
        assert result.provider == "groq_whisper"
        assert result.language == "fr"
        mock_client.audio.transcriptions.create.assert_called_once()

    @patch("services.stt.groq_whisper.Groq")
    def test_transcribe_strips_whitespace(self, MockGroq):
        mock_client = MagicMock()
        MockGroq.return_value = mock_client
        mock_client.audio.transcriptions.create.return_value = "  Bonjour  \n"

        provider = GroqWhisperProvider(api_key="fake-key")
        result = provider.transcribe(audio_file=MagicMock())

        assert result.transcription == "Bonjour"

    @patch("services.stt.groq_whisper.Groq")
    def test_transcribe_raises_on_api_error(self, MockGroq):
        mock_client = MagicMock()
        MockGroq.return_value = mock_client
        mock_client.audio.transcriptions.create.side_effect = Exception("API error")

        provider = GroqWhisperProvider(api_key="fake-key")
        with pytest.raises(Exception, match="API error"):
            provider.transcribe(audio_file=MagicMock())
