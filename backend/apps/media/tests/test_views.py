import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.media.models import AudioClip

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="audiouser", email="audio@example.com", password="testpass123!",
    )


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.mark.django_db
class TestTTSView:
    @patch("apps.media.views.get_or_create_audio")
    def test_tts_success(self, mock_get_or_create, authenticated_client):
        mock_clip = MagicMock(spec=AudioClip)
        mock_clip.id = 1
        mock_clip.text_content = "Bonjour"
        mock_clip.language = "fr"
        mock_clip.provider = "gtts"
        mock_clip.audio_file.url = "/media/audio/abc.mp3"
        mock_clip.audio_file.__bool__ = lambda self: True
        mock_clip.created_at = "2026-04-05T10:00:00Z"
        mock_get_or_create.return_value = mock_clip

        response = authenticated_client.post(
            "/api/media/tts/",
            {"text": "Bonjour"},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["text_content"] == "Bonjour"
        assert response.data["language"] == "fr"
        assert "audio_url" in response.data
        mock_get_or_create.assert_called_once_with(text="Bonjour", language="fr")

    @patch("apps.media.views.get_or_create_audio")
    def test_tts_with_custom_language(self, mock_get_or_create, authenticated_client):
        mock_clip = MagicMock(spec=AudioClip)
        mock_clip.id = 2
        mock_clip.text_content = "Hello"
        mock_clip.language = "en"
        mock_clip.provider = "gtts"
        mock_clip.audio_file.url = "/media/audio/def.mp3"
        mock_clip.audio_file.__bool__ = lambda self: True
        mock_clip.created_at = "2026-04-05T10:00:00Z"
        mock_get_or_create.return_value = mock_clip

        response = authenticated_client.post(
            "/api/media/tts/",
            {"text": "Hello", "language": "en"},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["language"] == "en"

    def test_tts_empty_text_returns_400(self, authenticated_client):
        response = authenticated_client.post(
            "/api/media/tts/",
            {"text": ""},
            format="json",
        )
        assert response.status_code == 400

    def test_tts_missing_text_returns_400(self, authenticated_client):
        response = authenticated_client.post(
            "/api/media/tts/",
            {},
            format="json",
        )
        assert response.status_code == 400

    def test_tts_unauthenticated_returns_401(self, api_client):
        response = api_client.post(
            "/api/media/tts/",
            {"text": "Bonjour"},
            format="json",
        )
        assert response.status_code == 401
