from unittest.mock import MagicMock, patch

import pytest

from apps.media.models import AudioClip
from services.tts.service import get_or_create_audio


@pytest.mark.django_db
class TestGetOrCreateAudio:
    @patch("services.tts.service.GTTSProvider")
    def test_creates_clip_when_not_cached(self, MockProvider):
        mock_instance = MagicMock()
        mock_instance.synthesize.return_value = MagicMock(
            audio_path="audio/abc123.mp3",
            provider="gtts",
        )
        MockProvider.return_value = mock_instance

        clip = get_or_create_audio("Bonjour", language="fr")

        assert isinstance(clip, AudioClip)
        assert clip.id is not None
        assert clip.text_content == "Bonjour"
        assert clip.language == "fr"
        assert clip.provider == "gtts"
        assert clip.audio_file.name == "audio/abc123.mp3"
        mock_instance.synthesize.assert_called_once_with(
            text="Bonjour",
            language="fr",
        )

    @patch("services.tts.service.GTTSProvider")
    def test_returns_cached_clip_without_generating(self, MockProvider):
        # Pre-create a cached clip
        AudioClip.objects.create(
            text_content="Merci",
            audio_file="audio/merci.mp3",
            language="fr",
            provider="gtts",
        )

        clip = get_or_create_audio("Merci", language="fr")

        assert clip.text_content == "Merci"
        # Provider should never be instantiated
        MockProvider.assert_not_called()

    @patch("services.tts.service.GTTSProvider")
    def test_different_language_generates_new_clip(self, MockProvider):
        AudioClip.objects.create(
            text_content="Bonjour",
            audio_file="audio/bonjour_fr.mp3",
            language="fr",
            provider="gtts",
        )
        mock_instance = MagicMock()
        mock_instance.synthesize.return_value = MagicMock(
            audio_path="audio/bonjour_en.mp3",
            provider="gtts",
        )
        MockProvider.return_value = mock_instance

        clip = get_or_create_audio("Bonjour", language="en")

        assert clip.language == "en"
        mock_instance.synthesize.assert_called_once()
