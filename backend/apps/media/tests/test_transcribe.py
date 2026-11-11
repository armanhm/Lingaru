import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.exam_prep.models import ExamExercise

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="sttuser", email="stt@example.com", password="testpass123!",
    )


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


def _audio(content=b"fake audio data"):
    return SimpleUploadedFile("rec.webm", content, content_type="audio/webm")


def _stt(MockSTT, text="bonjour tout le monde"):
    instance = MagicMock()
    instance.transcribe.return_value = MagicMock(
        transcription=text, provider="groq_whisper", language="fr",
    )
    MockSTT.return_value = instance
    return instance


@pytest.mark.django_db
class TestTranscribeView:
    @patch("apps.media.views.GroqWhisperProvider")
    def test_success_uses_user_target_language(self, MockSTT, authenticated_client, user):
        user.target_language = "es"
        user.save()
        stt = _stt(MockSTT)

        response = authenticated_client.post(
            "/api/media/transcribe/", {"audio": _audio()}, format="multipart",
        )

        assert response.status_code == 200
        assert response.data == {"transcription": "bonjour tout le monde"}
        assert stt.transcribe.call_args.kwargs["language"] == "es"

    @patch("apps.media.views.GroqWhisperProvider")
    def test_uses_exercise_language(self, MockSTT, authenticated_client):
        exercise = ExamExercise.objects.create(
            section="EO", cefr_level="B2", title="Oral", language="en",
            content={"prompt_fr": "x", "prompt_en": "x"},
        )
        stt = _stt(MockSTT)

        response = authenticated_client.post(
            "/api/media/transcribe/",
            {"audio": _audio(), "exercise_id": exercise.id},
            format="multipart",
        )

        assert response.status_code == 200
        assert stt.transcribe.call_args.kwargs["language"] == "en"

    @patch("apps.media.views.GroqWhisperProvider")
    def test_missing_audio_returns_400(self, MockSTT, authenticated_client):
        response = authenticated_client.post(
            "/api/media/transcribe/", {}, format="multipart",
        )
        assert response.status_code == 400
        MockSTT.assert_not_called()

    @patch("apps.media.views.GroqWhisperProvider")
    def test_empty_file_returns_400(self, MockSTT, authenticated_client):
        response = authenticated_client.post(
            "/api/media/transcribe/", {"audio": _audio(b"")}, format="multipart",
        )
        assert response.status_code == 400
        MockSTT.assert_not_called()

    @patch("apps.media.views.GroqWhisperProvider")
    def test_oversized_file_returns_400(self, MockSTT, authenticated_client):
        big = _audio(b"x" * (10 * 1024 * 1024 + 1))
        response = authenticated_client.post(
            "/api/media/transcribe/", {"audio": big}, format="multipart",
        )
        assert response.status_code == 400
        MockSTT.assert_not_called()

    @patch("apps.media.views.GroqWhisperProvider")
    def test_provider_failure_returns_503(self, MockSTT, authenticated_client):
        MockSTT.return_value.transcribe.side_effect = RuntimeError("boom")
        response = authenticated_client.post(
            "/api/media/transcribe/", {"audio": _audio()}, format="multipart",
        )
        assert response.status_code == 503
        assert "boom" not in response.content.decode()

    @patch("apps.media.views.GroqWhisperProvider")
    def test_unauthenticated_returns_401(self, MockSTT, api_client):
        response = api_client.post(
            "/api/media/transcribe/", {"audio": _audio()}, format="multipart",
        )
        assert response.status_code == 401
        MockSTT.assert_not_called()

    @patch("apps.media.views.GroqWhisperProvider")
    def test_unknown_exercise_falls_back_to_user_language(
        self, MockSTT, authenticated_client, user,
    ):
        stt = _stt(MockSTT)
        response = authenticated_client.post(
            "/api/media/transcribe/",
            {"audio": _audio(), "exercise_id": 999999},
            format="multipart",
        )
        assert response.status_code == 200
        assert stt.transcribe.call_args.kwargs["language"] == user.target_language
