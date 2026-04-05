import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from apps.media.models import AudioClip, PronunciationAttempt

User = get_user_model()


@pytest.mark.django_db
class TestAudioClip:
    def test_create_audio_clip(self):
        clip = AudioClip.objects.create(
            text_content="Bonjour",
            audio_file="audio/bonjour.mp3",
            language="fr",
            provider="gtts",
        )
        assert clip.id is not None
        assert clip.text_content == "Bonjour"
        assert clip.language == "fr"
        assert clip.provider == "gtts"
        assert clip.created_at is not None

    def test_str_representation(self):
        clip = AudioClip(text_content="Bonjour le monde", language="fr")
        assert "Bonjour le monde" in str(clip)
        assert "fr" in str(clip)

    def test_unique_text_language_constraint(self):
        AudioClip.objects.create(
            text_content="Bonjour",
            audio_file="audio/bonjour1.mp3",
            language="fr",
        )
        with pytest.raises(IntegrityError):
            AudioClip.objects.create(
                text_content="Bonjour",
                audio_file="audio/bonjour2.mp3",
                language="fr",
            )

    def test_same_text_different_language_allowed(self):
        AudioClip.objects.create(
            text_content="Bonjour",
            audio_file="audio/bonjour_fr.mp3",
            language="fr",
        )
        clip2 = AudioClip.objects.create(
            text_content="Bonjour",
            audio_file="audio/bonjour_en.mp3",
            language="en",
        )
        assert clip2.id is not None

    def test_default_values(self):
        clip = AudioClip.objects.create(
            text_content="Merci",
            audio_file="audio/merci.mp3",
        )
        assert clip.language == "fr"
        assert clip.provider == "gtts"


@pytest.mark.django_db
class TestPronunciationAttempt:
    @pytest.fixture
    def user(self, db):
        return User.objects.create_user(
            username="pronuser", email="pron@example.com", password="testpass123!",
        )

    def test_create_attempt(self, user):
        attempt = PronunciationAttempt.objects.create(
            user=user,
            expected_text="Bonjour",
            audio_file="pronunciation/test.webm",
            transcription="bonjour",
            accuracy_score=1.0,
            feedback="Perfect pronunciation!",
        )
        assert attempt.id is not None
        assert attempt.user == user
        assert attempt.vocabulary is None
        assert attempt.accuracy_score == 1.0

    def test_str_representation(self, user):
        attempt = PronunciationAttempt(user=user, accuracy_score=0.85)
        assert "0.85" in str(attempt)

    def test_ordering(self, user):
        a1 = PronunciationAttempt.objects.create(
            user=user, expected_text="Bonjour",
            audio_file="pronunciation/a1.webm",
        )
        a2 = PronunciationAttempt.objects.create(
            user=user, expected_text="Merci",
            audio_file="pronunciation/a2.webm",
        )
        attempts = list(PronunciationAttempt.objects.all())
        assert attempts[0].id == a2.id  # newest first
