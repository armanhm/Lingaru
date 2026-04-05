import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from apps.media.models import AudioClip, PronunciationAttempt
from apps.content.models import Topic, Lesson, Vocabulary

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


@pytest.mark.django_db
class TestPronunciationCheckView:
    @patch("apps.media.views.award_xp")
    @patch("apps.media.views.check_streak")
    @patch("apps.media.views.GroqWhisperProvider")
    def test_pronunciation_check_success(
        self, MockSTT, mock_streak, mock_xp, authenticated_client,
    ):
        mock_stt_instance = MagicMock()
        mock_stt_instance.transcribe.return_value = MagicMock(
            transcription="bonjour", provider="groq_whisper", language="fr",
        )
        MockSTT.return_value = mock_stt_instance

        audio = SimpleUploadedFile(
            "test.webm", b"fake audio data", content_type="audio/webm",
        )

        response = authenticated_client.post(
            "/api/media/pronunciation/check/",
            {"audio": audio, "expected_text": "Bonjour"},
            format="multipart",
        )

        assert response.status_code == 200
        assert response.data["transcription"] == "bonjour"
        assert response.data["accuracy_score"] == 1.0
        assert "feedback" in response.data
        assert PronunciationAttempt.objects.count() == 1
        mock_xp.assert_called_once()
        mock_streak.assert_called_once()

    @patch("apps.media.views.award_xp")
    @patch("apps.media.views.check_streak")
    @patch("apps.media.views.GroqWhisperProvider")
    def test_pronunciation_partial_match(
        self, MockSTT, mock_streak, mock_xp, authenticated_client,
    ):
        mock_stt_instance = MagicMock()
        mock_stt_instance.transcribe.return_value = MagicMock(
            transcription="bonjour monde", provider="groq_whisper", language="fr",
        )
        MockSTT.return_value = mock_stt_instance

        audio = SimpleUploadedFile(
            "test.webm", b"fake audio data", content_type="audio/webm",
        )

        response = authenticated_client.post(
            "/api/media/pronunciation/check/",
            {"audio": audio, "expected_text": "Bonjour le monde"},
            format="multipart",
        )

        assert response.status_code == 200
        assert 0.0 < response.data["accuracy_score"] < 1.0

    def test_pronunciation_missing_audio_returns_400(self, authenticated_client):
        response = authenticated_client.post(
            "/api/media/pronunciation/check/",
            {"expected_text": "Bonjour"},
            format="multipart",
        )
        assert response.status_code == 400

    def test_pronunciation_unauthenticated_returns_401(self, api_client):
        audio = SimpleUploadedFile(
            "test.webm", b"fake audio data", content_type="audio/webm",
        )
        response = api_client.post(
            "/api/media/pronunciation/check/",
            {"audio": audio, "expected_text": "Bonjour"},
            format="multipart",
        )
        assert response.status_code == 401


@pytest.fixture
def sample_vocab_with_sentence(db):
    topic = Topic.objects.create(
        name_fr="Test", name_en="Test",
        description="", icon="", order=1, difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic, type="vocab", title="Test Lesson",
        content={}, order=1, difficulty=1,
    )
    return Vocabulary.objects.create(
        lesson=lesson,
        french="Bonjour",
        english="Hello",
        example_sentence="Bonjour, comment allez-vous?",
    )


@pytest.mark.django_db
class TestDictationStartView:
    @patch("apps.media.views.get_or_create_audio")
    def test_start_dictation_success(
        self, mock_get_audio, authenticated_client, sample_vocab_with_sentence,
    ):
        mock_clip = MagicMock(spec=AudioClip)
        mock_clip.id = 1
        mock_clip.text_content = "Bonjour, comment allez-vous?"
        mock_clip.language = "fr"
        mock_clip.provider = "gtts"
        mock_clip.audio_file.url = "/media/audio/test.mp3"
        mock_clip.audio_file.__bool__ = lambda self: True
        mock_clip.created_at = "2026-04-05T10:00:00Z"
        mock_get_audio.return_value = mock_clip

        response = authenticated_client.get("/api/media/dictation/start/")

        assert response.status_code == 200
        assert "sentence_id" in response.data
        assert "audio_clip" in response.data
        assert "audio_url" in response.data["audio_clip"]

    def test_start_dictation_no_sentences(self, authenticated_client):
        response = authenticated_client.get("/api/media/dictation/start/")
        assert response.status_code == 404

    def test_start_dictation_unauthenticated(self, api_client):
        response = api_client.get("/api/media/dictation/start/")
        assert response.status_code == 401


@pytest.mark.django_db
class TestDictationCheckView:
    @patch("apps.media.views.award_xp")
    @patch("apps.media.views.check_streak")
    def test_check_dictation_correct(self, mock_streak, mock_xp, authenticated_client):
        clip = AudioClip.objects.create(
            text_content="Bonjour le monde",
            audio_file="audio/test.mp3",
            language="fr",
        )

        response = authenticated_client.post(
            "/api/media/dictation/check/",
            {"audio_clip_id": clip.id, "user_text": "Bonjour le monde"},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["correct"] is True
        assert response.data["accuracy"] == 1.0
        assert response.data["expected"] == "Bonjour le monde"
        mock_xp.assert_called_once()

    @patch("apps.media.views.award_xp")
    @patch("apps.media.views.check_streak")
    def test_check_dictation_incorrect(self, mock_streak, mock_xp, authenticated_client):
        clip = AudioClip.objects.create(
            text_content="Bonjour le monde",
            audio_file="audio/test.mp3",
            language="fr",
        )

        response = authenticated_client.post(
            "/api/media/dictation/check/",
            {"audio_clip_id": clip.id, "user_text": "Au revoir"},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["correct"] is False
        assert response.data["accuracy"] < 0.9

    def test_check_dictation_missing_clip(self, authenticated_client):
        response = authenticated_client.post(
            "/api/media/dictation/check/",
            {"audio_clip_id": 9999, "user_text": "test"},
            format="json",
        )
        assert response.status_code == 404

    def test_check_dictation_unauthenticated(self, api_client):
        response = api_client.post(
            "/api/media/dictation/check/",
            {"audio_clip_id": 1, "user_text": "test"},
            format="json",
        )
        assert response.status_code == 401
