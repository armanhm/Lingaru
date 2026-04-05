# Phase 7: Audio — Implementation Plan

**Date:** 2026-04-05
**Depends on:** Phases 1-6 (User, Content, Practice, Telegram, AI Assistant, Gamification)
**Delivers:** TTS for vocabulary/sentences, STT for pronunciation practice, dictation exercises via API + Frontend + Telegram

---

## Overview

This phase adds audio capabilities to Lingaru:

1. **TTS Service** (`backend/services/tts/`) — generates French audio using gTTS, caches results as `AudioClip` records
2. **STT Service** (`backend/services/stt/`) — transcribes user audio via Groq Whisper, scores pronunciation accuracy
3. **Media App** (`backend/apps/media/`) — models (AudioClip, PronunciationAttempt), API endpoints for TTS, pronunciation check, and dictation
4. **Frontend** — audio play buttons on vocab cards, dictation page, pronunciation page
5. **Telegram** — `/dictation` command, voice audio in `/word`

### New dependency

```
gTTS>=2.5.0
```

---

## Task 1: TTS Service + AudioClip Model

**Goal:** Create `backend/services/tts/` with a gTTS wrapper and the `AudioClip` model in a new `backend/apps/media/` app. TDD with mocked gTTS.

**Why first:** Every audio feature depends on generating and storing audio clips.

### Step 1.1 — Create the media app skeleton

```bash
cd backend
python manage.py startapp media apps/media
```

Create the directory structure:

```
backend/apps/media/
├── __init__.py
├── admin.py
├── apps.py
├── models.py
├── serializers.py
├── views.py
├── urls.py
├── migrations/
│   └── __init__.py
└── tests/
    ├── __init__.py
    ├── test_models.py
    ├── test_services.py
    ├── test_serializers.py
    └── test_views.py
```

**File:** `backend/apps/media/apps.py`

```python
from django.apps import AppConfig


class MediaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.media"
    verbose_name = "Media"
```

Register in `backend/config/settings/base.py`:

```python
INSTALLED_APPS = [
    # ...existing apps...
    "apps.media",
]
```

### Step 1.2 — AudioClip model

**File:** `backend/apps/media/models.py`

```python
from django.db import models


class AudioClip(models.Model):
    PROVIDER_CHOICES = [
        ("gtts", "Google TTS (gTTS)"),
    ]

    text_content = models.TextField()
    audio_file = models.FileField(upload_to="audio/")
    language = models.CharField(max_length=10, default="fr")
    provider = models.CharField(
        max_length=20, choices=PROVIDER_CHOICES, default="gtts",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "media_audio_clips"
        constraints = [
            models.UniqueConstraint(
                fields=["text_content", "language"],
                name="unique_text_language",
            ),
        ]

    def __str__(self):
        return f"AudioClip({self.language}): {self.text_content[:50]}"
```

**File:** `backend/apps/media/admin.py`

```python
from django.contrib import admin
from .models import AudioClip


@admin.register(AudioClip)
class AudioClipAdmin(admin.ModelAdmin):
    list_display = ("id", "text_content_short", "language", "provider", "created_at")
    list_filter = ("language", "provider")
    search_fields = ("text_content",)

    def text_content_short(self, obj):
        return obj.text_content[:60]
    text_content_short.short_description = "Text"
```

Run migration:

```bash
python manage.py makemigrations media
python manage.py migrate
```

### Step 1.3 — Write AudioClip model tests (RED)

**File:** `backend/apps/media/tests/test_models.py`

```python
import pytest
from django.db import IntegrityError
from apps.media.models import AudioClip


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
```

Run tests — confirm they pass once the model exists:

```bash
pytest backend/apps/media/tests/test_models.py -v
```

### Step 1.4 — Create the TTS service

Create the service directory structure:

```
backend/services/tts/
├── __init__.py
├── base.py
└── gtts_provider.py
```

**File:** `backend/services/tts/__init__.py`

```python
```

**File:** `backend/services/tts/base.py`

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class TTSResult:
    audio_path: str
    provider: str


class BaseTTSProvider(ABC):
    @abstractmethod
    def synthesize(self, text: str, language: str = "fr") -> TTSResult:
        """Generate an audio file from text.

        Args:
            text: The text to synthesize.
            language: BCP-47 language code (default "fr").

        Returns:
            TTSResult with the path to the generated audio file and provider name.
        """
```

**File:** `backend/services/tts/gtts_provider.py`

```python
import hashlib
import logging
from pathlib import Path

from django.conf import settings
from gtts import gTTS

from .base import BaseTTSProvider, TTSResult

logger = logging.getLogger(__name__)


class GTTSProvider(BaseTTSProvider):
    """Text-to-speech using Google Translate TTS (gTTS). Free, no API key needed."""

    def synthesize(self, text: str, language: str = "fr") -> TTSResult:
        # Build a deterministic filename from text + language
        text_hash = hashlib.md5(f"{language}:{text}".encode()).hexdigest()
        filename = f"{text_hash}.mp3"
        relative_path = f"audio/{filename}"
        full_path = Path(settings.MEDIA_ROOT) / "audio" / filename

        # Skip generation if file already exists on disk
        if full_path.exists():
            logger.debug("TTS cache hit (disk): %s", relative_path)
            return TTSResult(audio_path=relative_path, provider="gtts")

        # Ensure the audio directory exists
        full_path.parent.mkdir(parents=True, exist_ok=True)

        # Generate audio
        tts = gTTS(text=text, lang=language, slow=False)
        tts.save(str(full_path))

        logger.info("TTS generated: text='%s', file='%s'", text[:50], relative_path)

        return TTSResult(audio_path=relative_path, provider="gtts")
```

### Step 1.5 — Create the TTS service facade

**File:** `backend/services/tts/service.py`

```python
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
```

### Step 1.6 — Write TTS service tests (RED then GREEN)

**File:** `backend/services/tts/tests/__init__.py`

```python
```

**File:** `backend/services/tts/tests/test_gtts_provider.py`

```python
import pytest
from pathlib import Path
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

        import hashlib
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
```

**File:** `backend/services/tts/tests/test_service.py`

```python
import pytest
from unittest.mock import patch, MagicMock

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
            text="Bonjour", language="fr",
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
```

Run all tests:

```bash
pytest backend/services/tts/tests/ -v
pytest backend/apps/media/tests/test_models.py -v
```

### Step 1.7 — Commit

```
git add backend/apps/media/ backend/services/tts/ backend/config/settings/base.py
git commit -m "feat(media): add AudioClip model and TTS service with gTTS provider

- New apps/media Django app with AudioClip model (text + language unique constraint)
- New services/tts/ with BaseTTSProvider, GTTSProvider (disk + DB caching)
- get_or_create_audio() facade: check DB → generate if missing → save AudioClip
- Full test coverage: model tests, provider tests (mocked gTTS), service tests"
```

---

## Task 2: TTS API Endpoint

**Goal:** `POST /api/media/tts/` that accepts `{text, language?}`, returns the audio file URL (generates and caches if not present). TDD.

**Why second:** Frontend and Telegram both need an API to request audio.

### Step 2.1 — TTS serializers

**File:** `backend/apps/media/serializers.py`

```python
from rest_framework import serializers
from .models import AudioClip


class TTSRequestSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=1000)
    language = serializers.CharField(max_length=10, default="fr", required=False)

    def validate_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Text cannot be empty.")
        return value


class AudioClipSerializer(serializers.ModelSerializer):
    audio_url = serializers.SerializerMethodField()

    class Meta:
        model = AudioClip
        fields = ("id", "text_content", "language", "provider", "audio_url", "created_at")

    def get_audio_url(self, obj):
        request = self.context.get("request")
        if request and obj.audio_file:
            return request.build_absolute_uri(obj.audio_file.url)
        if obj.audio_file:
            return obj.audio_file.url
        return None
```

### Step 2.2 — TTS view

**File:** `backend/apps/media/views.py`

```python
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from services.tts.service import get_or_create_audio
from .serializers import TTSRequestSerializer, AudioClipSerializer


class TTSView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = TTSRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        text = serializer.validated_data["text"]
        language = serializer.validated_data.get("language", "fr")

        clip = get_or_create_audio(text=text, language=language)

        return Response(
            AudioClipSerializer(clip, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )
```

### Step 2.3 — URL routing

**File:** `backend/apps/media/urls.py`

```python
from django.urls import path
from . import views

app_name = "media"

urlpatterns = [
    path("tts/", views.TTSView.as_view(), name="tts"),
]
```

Add to `backend/config/urls.py`:

```python
urlpatterns = [
    # ...existing...
    path("api/media/", include("apps.media.urls")),
]
```

### Step 2.4 — Write TTS endpoint tests (RED then GREEN)

**File:** `backend/apps/media/tests/test_serializers.py`

```python
import pytest
from apps.media.serializers import TTSRequestSerializer


class TestTTSRequestSerializer:
    def test_valid_data(self):
        s = TTSRequestSerializer(data={"text": "Bonjour"})
        assert s.is_valid()
        assert s.validated_data["text"] == "Bonjour"
        assert s.validated_data["language"] == "fr"

    def test_valid_data_with_language(self):
        s = TTSRequestSerializer(data={"text": "Hello", "language": "en"})
        assert s.is_valid()
        assert s.validated_data["language"] == "en"

    def test_empty_text_invalid(self):
        s = TTSRequestSerializer(data={"text": ""})
        assert not s.is_valid()

    def test_whitespace_text_invalid(self):
        s = TTSRequestSerializer(data={"text": "   "})
        assert not s.is_valid()

    def test_missing_text_invalid(self):
        s = TTSRequestSerializer(data={})
        assert not s.is_valid()

    def test_text_too_long(self):
        s = TTSRequestSerializer(data={"text": "a" * 1001})
        assert not s.is_valid()
```

**File:** `backend/apps/media/tests/test_views.py`

```python
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
```

Run tests:

```bash
pytest backend/apps/media/tests/ -v
```

### Step 2.5 — Commit

```
git add backend/apps/media/serializers.py backend/apps/media/views.py backend/apps/media/urls.py backend/config/urls.py backend/apps/media/tests/
git commit -m "feat(media): add POST /api/media/tts/ endpoint for text-to-speech

- TTSView accepts {text, language?}, returns AudioClip with audio URL
- TTSRequestSerializer with validation (non-empty, max 1000 chars)
- AudioClipSerializer with absolute audio_url via request context
- URL registered at /api/media/tts/
- Full test coverage: serializer tests, view tests with mocked service"
```

---

## Task 3: STT Service + Pronunciation Check

**Goal:** Create `backend/services/stt/` with Groq Whisper wrapper, `PronunciationAttempt` model, and pronunciation check endpoint. TDD with mocked Whisper.

**Why third:** Pronunciation practice requires both STT and TTS (Task 1-2) to work.

### Step 3.1 — PronunciationAttempt model

Add to `backend/apps/media/models.py`:

```python
from django.conf import settings


class PronunciationAttempt(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pronunciation_attempts",
    )
    vocabulary = models.ForeignKey(
        "content.Vocabulary",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pronunciation_attempts",
    )
    expected_text = models.TextField()
    audio_file = models.FileField(upload_to="pronunciation/")
    transcription = models.TextField(blank=True, default="")
    accuracy_score = models.FloatField(default=0.0)
    feedback = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "media_pronunciation_attempts"
        ordering = ["-created_at"]

    def __str__(self):
        return f"PronunciationAttempt(user={self.user_id}, score={self.accuracy_score})"
```

Run migration:

```bash
python manage.py makemigrations media
python manage.py migrate
```

### Step 3.2 — PronunciationAttempt model tests (RED then GREEN)

Add to `backend/apps/media/tests/test_models.py`:

```python
from django.contrib.auth import get_user_model
from apps.media.models import PronunciationAttempt

User = get_user_model()


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
```

### Step 3.3 — Create the STT service

```
backend/services/stt/
├── __init__.py
├── base.py
├── groq_whisper.py
├── scoring.py
└── tests/
    ├── __init__.py
    ├── test_groq_whisper.py
    └── test_scoring.py
```

**File:** `backend/services/stt/__init__.py`

```python
```

**File:** `backend/services/stt/base.py`

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class STTResult:
    transcription: str
    provider: str
    language: str


class BaseSTTProvider(ABC):
    @abstractmethod
    def transcribe(self, audio_file, language: str = "fr") -> STTResult:
        """Transcribe an audio file to text.

        Args:
            audio_file: A file-like object containing audio data.
            language: BCP-47 language code hint.

        Returns:
            STTResult with the transcription, provider name, and detected language.
        """
```

**File:** `backend/services/stt/groq_whisper.py`

```python
import logging

from django.conf import settings
from groq import Groq

from .base import BaseSTTProvider, STTResult

logger = logging.getLogger(__name__)

WHISPER_MODEL = "whisper-large-v3"


class GroqWhisperProvider(BaseSTTProvider):
    """Speech-to-text using Groq's hosted Whisper model."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.client = Groq(api_key=self.api_key)

    def transcribe(self, audio_file, language: str = "fr") -> STTResult:
        response = self.client.audio.transcriptions.create(
            model=WHISPER_MODEL,
            file=audio_file,
            language=language,
            response_format="text",
        )

        transcription = response.strip() if isinstance(response, str) else response.text.strip()

        logger.info(
            "STT transcription: language=%s, length=%d chars",
            language, len(transcription),
        )

        return STTResult(
            transcription=transcription,
            provider="groq_whisper",
            language=language,
        )
```

**File:** `backend/services/stt/scoring.py`

```python
"""Pronunciation accuracy scoring — compares expected text to transcription."""

import re
import unicodedata


def normalize_text(text: str) -> str:
    """Normalize text for comparison: lowercase, strip punctuation, normalize unicode."""
    text = text.lower().strip()
    # Normalize unicode (e.g., accented characters)
    text = unicodedata.normalize("NFC", text)
    # Remove punctuation except apostrophes (important in French: l'homme, j'ai)
    text = re.sub(r"[^\w\s']", "", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def calculate_accuracy(expected: str, transcription: str) -> float:
    """Calculate word-level accuracy between expected text and transcription.

    Returns a float between 0.0 (no match) and 1.0 (perfect match).
    Uses simple word overlap — Jaccard similarity on word sets would
    over-count repeated words, so we use ordered comparison.
    """
    expected_words = normalize_text(expected).split()
    transcription_words = normalize_text(transcription).split()

    if not expected_words:
        return 1.0 if not transcription_words else 0.0

    # Count matching words in order (longest common subsequence approach is overkill;
    # simple sequential matching works well for short utterances)
    matches = 0
    t_index = 0
    for e_word in expected_words:
        for i in range(t_index, len(transcription_words)):
            if transcription_words[i] == e_word:
                matches += 1
                t_index = i + 1
                break

    return round(matches / len(expected_words), 2)


def generate_feedback(accuracy: float, expected: str, transcription: str) -> str:
    """Generate human-readable feedback based on accuracy score."""
    if accuracy >= 0.95:
        return "Excellent! Your pronunciation is nearly perfect."
    elif accuracy >= 0.8:
        return (
            f"Good job! Most words were correct. "
            f"Expected: \"{expected}\" — You said: \"{transcription}\""
        )
    elif accuracy >= 0.5:
        return (
            f"Keep practicing! Some words need work. "
            f"Expected: \"{expected}\" — You said: \"{transcription}\""
        )
    else:
        return (
            f"Let's try again. Listen carefully and repeat. "
            f"Expected: \"{expected}\" — You said: \"{transcription}\""
        )
```

### Step 3.4 — STT service tests (RED then GREEN)

**File:** `backend/services/stt/tests/__init__.py`

```python
```

**File:** `backend/services/stt/tests/test_groq_whisper.py`

```python
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
```

**File:** `backend/services/stt/tests/test_scoring.py`

```python
import pytest
from services.stt.scoring import normalize_text, calculate_accuracy, generate_feedback


class TestNormalizeText:
    def test_lowercase(self):
        assert normalize_text("Bonjour") == "bonjour"

    def test_strip_punctuation(self):
        assert normalize_text("Bonjour!") == "bonjour"

    def test_preserve_apostrophes(self):
        assert normalize_text("L'homme") == "l'homme"

    def test_collapse_whitespace(self):
        assert normalize_text("Bonjour   le   monde") == "bonjour le monde"

    def test_strip_edges(self):
        assert normalize_text("  Bonjour  ") == "bonjour"

    def test_unicode_normalization(self):
        # Ensure accented chars are preserved
        assert "é" in normalize_text("café")


class TestCalculateAccuracy:
    def test_perfect_match(self):
        assert calculate_accuracy("Bonjour le monde", "Bonjour le monde") == 1.0

    def test_case_insensitive(self):
        assert calculate_accuracy("Bonjour", "bonjour") == 1.0

    def test_partial_match(self):
        score = calculate_accuracy("Bonjour le monde", "Bonjour monde")
        assert 0.5 <= score <= 0.7  # 2 of 3 words matched

    def test_no_match(self):
        assert calculate_accuracy("Bonjour", "Au revoir") == 0.0

    def test_empty_expected(self):
        assert calculate_accuracy("", "") == 1.0

    def test_empty_expected_nonempty_transcription(self):
        assert calculate_accuracy("", "hello") == 0.0

    def test_empty_transcription(self):
        assert calculate_accuracy("Bonjour", "") == 0.0

    def test_extra_words_in_transcription(self):
        # "Bonjour" is found, so 1/1 = 1.0
        assert calculate_accuracy("Bonjour", "Oui Bonjour monsieur") == 1.0


class TestGenerateFeedback:
    def test_excellent(self):
        feedback = generate_feedback(1.0, "Bonjour", "Bonjour")
        assert "Excellent" in feedback

    def test_good(self):
        feedback = generate_feedback(0.85, "Bonjour le monde", "bonjour monde")
        assert "Good" in feedback

    def test_keep_practicing(self):
        feedback = generate_feedback(0.6, "Bonjour le monde", "bonjour")
        assert "practicing" in feedback

    def test_try_again(self):
        feedback = generate_feedback(0.2, "Bonjour", "au revoir")
        assert "try again" in feedback.lower()
```

### Step 3.5 — Pronunciation check endpoint

Add serializers to `backend/apps/media/serializers.py`:

```python
class PronunciationCheckSerializer(serializers.Serializer):
    audio = serializers.FileField()
    expected_text = serializers.CharField(max_length=1000)
    vocabulary_id = serializers.IntegerField(required=False, allow_null=True)


class PronunciationResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = PronunciationAttempt
        fields = (
            "id", "expected_text", "transcription",
            "accuracy_score", "feedback", "created_at",
        )
```

(Add `PronunciationAttempt` import at top of serializers.py.)

Add view to `backend/apps/media/views.py`:

```python
from services.stt.groq_whisper import GroqWhisperProvider
from services.stt.scoring import calculate_accuracy, generate_feedback
from apps.gamification.services import award_xp, check_streak
from .models import AudioClip, PronunciationAttempt
from .serializers import (
    TTSRequestSerializer,
    AudioClipSerializer,
    PronunciationCheckSerializer,
    PronunciationResultSerializer,
)


class PronunciationCheckView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = PronunciationCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        audio_file = serializer.validated_data["audio"]
        expected_text = serializer.validated_data["expected_text"]
        vocabulary_id = serializer.validated_data.get("vocabulary_id")

        # Transcribe
        stt = GroqWhisperProvider()
        result = stt.transcribe(audio_file=audio_file, language="fr")

        # Score
        accuracy = calculate_accuracy(expected_text, result.transcription)
        feedback = generate_feedback(accuracy, expected_text, result.transcription)

        # Save attempt
        attempt = PronunciationAttempt.objects.create(
            user=request.user,
            vocabulary_id=vocabulary_id,
            expected_text=expected_text,
            audio_file=audio_file,
            transcription=result.transcription,
            accuracy_score=accuracy,
            feedback=feedback,
        )

        # Award XP for pronunciation practice
        award_xp(
            request.user,
            activity_type="pronunciation",
            xp_amount=5,
            source_id=f"pronunciation_{attempt.id}",
        )
        check_streak(request.user)

        return Response(
            PronunciationResultSerializer(attempt).data,
            status=status.HTTP_200_OK,
        )
```

Add URL to `backend/apps/media/urls.py`:

```python
urlpatterns = [
    path("tts/", views.TTSView.as_view(), name="tts"),
    path("pronunciation/check/", views.PronunciationCheckView.as_view(), name="pronunciation-check"),
]
```

### Step 3.6 — Pronunciation endpoint tests (RED then GREEN)

Add to `backend/apps/media/tests/test_views.py`:

```python
from io import BytesIO
from django.core.files.uploadedfile import SimpleUploadedFile


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
```

Run tests:

```bash
pytest backend/apps/media/tests/ backend/services/stt/tests/ -v
```

### Step 3.7 — Commit

```
git add backend/apps/media/ backend/services/stt/
git commit -m "feat(media): add STT service and pronunciation check endpoint

- PronunciationAttempt model (user, expected_text, transcription, score, feedback)
- New services/stt/ with BaseSTTProvider, GroqWhisperProvider (Groq Whisper API)
- Scoring module: normalize_text, calculate_accuracy (word-level), generate_feedback
- POST /api/media/pronunciation/check/ — upload audio + expected text, get scored
- Awards 5 XP per pronunciation attempt via gamification service
- Full test coverage: model, provider (mocked Groq), scoring unit tests, view tests"
```

---

## Task 4: Dictation Endpoints

**Goal:** Two endpoints: start a dictation (random sentence + audio) and check a dictation (compare user text to expected). TDD.

**Why fourth:** Dictation combines TTS (Task 1-2) with text comparison, completing the audio practice loop.

### Step 4.1 — Dictation serializers

Add to `backend/apps/media/serializers.py`:

```python
class DictationStartSerializer(serializers.Serializer):
    """Response serializer for starting a dictation exercise."""
    audio_clip = AudioClipSerializer()
    sentence_id = serializers.IntegerField()


class DictationCheckRequestSerializer(serializers.Serializer):
    audio_clip_id = serializers.IntegerField()
    user_text = serializers.CharField(max_length=2000)


class DictationCheckResponseSerializer(serializers.Serializer):
    correct = serializers.BooleanField()
    expected = serializers.CharField()
    user_text = serializers.CharField()
    accuracy = serializers.FloatField()
    feedback = serializers.CharField()
```

### Step 4.2 — Dictation views

Add to `backend/apps/media/views.py`:

```python
from apps.content.models import Vocabulary


class DictationStartView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        # Pick a random vocabulary item that has an example sentence
        vocab = Vocabulary.objects.exclude(
            example_sentence="",
        ).order_by("?").first()

        if vocab is None:
            return Response(
                {"detail": "No sentences available for dictation."},
                status=status.HTTP_404_NOT_FOUND,
            )

        sentence = vocab.example_sentence
        clip = get_or_create_audio(text=sentence, language="fr")

        return Response({
            "sentence_id": vocab.id,
            "audio_clip": AudioClipSerializer(
                clip, context={"request": request},
            ).data,
        })


class DictationCheckView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = DictationCheckRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        clip_id = serializer.validated_data["audio_clip_id"]
        user_text = serializer.validated_data["user_text"]

        try:
            clip = AudioClip.objects.get(pk=clip_id)
        except AudioClip.DoesNotExist:
            return Response(
                {"detail": "Audio clip not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        expected = clip.text_content
        accuracy = calculate_accuracy(expected, user_text)
        is_correct = accuracy >= 0.9
        feedback = generate_feedback(accuracy, expected, user_text)

        # Award XP for dictation
        award_xp(
            request.user,
            activity_type="dictation",
            xp_amount=15,
            source_id=f"dictation_clip_{clip.id}",
        )
        check_streak(request.user)

        return Response({
            "correct": is_correct,
            "expected": expected,
            "user_text": user_text,
            "accuracy": accuracy,
            "feedback": feedback,
        })
```

Add URLs to `backend/apps/media/urls.py`:

```python
urlpatterns = [
    path("tts/", views.TTSView.as_view(), name="tts"),
    path("pronunciation/check/", views.PronunciationCheckView.as_view(), name="pronunciation-check"),
    path("dictation/start/", views.DictationStartView.as_view(), name="dictation-start"),
    path("dictation/check/", views.DictationCheckView.as_view(), name="dictation-check"),
]
```

### Step 4.3 — Dictation endpoint tests (RED then GREEN)

Add to `backend/apps/media/tests/test_views.py`:

```python
from apps.content.models import Topic, Lesson, Vocabulary


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
```

Run tests:

```bash
pytest backend/apps/media/tests/test_views.py -v
```

### Step 4.4 — Add gTTS to requirements.txt

Add to `backend/requirements.txt`:

```
gTTS>=2.5.0,<3.0
```

### Step 4.5 — Commit

```
git add backend/apps/media/ backend/requirements.txt
git commit -m "feat(media): add dictation start and check endpoints

- GET /api/media/dictation/start/ — random sentence with generated audio
- POST /api/media/dictation/check/ — compare user text to expected, score accuracy
- Awards 15 XP per dictation exercise
- gTTS added to requirements.txt
- Full test coverage for both endpoints"
```

---

## Task 5: Frontend Audio Features

**Goal:** Audio play buttons on vocab cards in LessonDetail, a new `/practice/dictation` page, and a new `/practice/pronunciation` page.

**Why fifth:** The backend is complete; now we wire up the UI.

### Step 5.1 — Frontend API module for media

**File:** `frontend/src/api/media.js`

```javascript
import client from "./client";

export const generateTTS = (text, language = "fr") =>
  client.post("/media/tts/", { text, language });

export const checkPronunciation = (audioBlob, expectedText, vocabularyId = null) => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");
  formData.append("expected_text", expectedText);
  if (vocabularyId) {
    formData.append("vocabulary_id", vocabularyId);
  }
  return client.post("/media/pronunciation/check/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const startDictation = () =>
  client.get("/media/dictation/start/");

export const checkDictation = (audioClipId, userText) =>
  client.post("/media/dictation/check/", {
    audio_clip_id: audioClipId,
    user_text: userText,
  });
```

### Step 5.2 — AudioPlayButton component

**File:** `frontend/src/components/AudioPlayButton.jsx`

```jsx
import { useState } from "react";
import { generateTTS } from "../api/media";

export default function AudioPlayButton({ text, language = "fr", size = "sm" }) {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);

  const handlePlay = async () => {
    try {
      setLoading(true);

      let url = audioUrl;
      if (!url) {
        const res = await generateTTS(text, language);
        url = res.data.audio_url;
        setAudioUrl(url);
      }

      const audio = new Audio(url);
      await audio.play();
    } catch (err) {
      console.error("Failed to play audio:", err);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-12 h-12 text-lg",
  };

  return (
    <button
      onClick={handlePlay}
      disabled={loading}
      className={`${sizeClasses[size]} inline-flex items-center justify-center rounded-full bg-primary-100 text-primary-600 hover:bg-primary-200 transition-colors disabled:opacity-50`}
      title={`Listen to "${text}"`}
      aria-label={`Play audio for ${text}`}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12" cy="12" r="10"
            stroke="currentColor" strokeWidth="4" fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
}
```

### Step 5.3 — Add audio buttons to VocabSection in LessonDetail

Update `VocabSection` in `frontend/src/pages/LessonDetail.jsx`:

Add import at top:

```jsx
import AudioPlayButton from "../components/AudioPlayButton";
```

Update the vocab card JSX — add the AudioPlayButton next to the French word:

```jsx
function VocabSection({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Vocabulary</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((word) => (
          <div key={word.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <AudioPlayButton text={word.french} size="sm" />
                <span className="text-lg font-semibold text-gray-900">
                  {word.french}
                  {word.gender && (
                    <span className="text-xs text-gray-400 ml-1">
                      ({word.gender})
                    </span>
                  )}
                </span>
              </div>
              <span className="text-sm text-primary-600">{word.english}</span>
            </div>
            {word.pronunciation && (
              <p className="text-xs text-gray-400 mb-2">{word.pronunciation}</p>
            )}
            {word.example_sentence && (
              <div className="flex items-start gap-2 border-t pt-2 mt-2">
                <AudioPlayButton text={word.example_sentence} size="sm" />
                <p className="text-sm text-gray-600 italic">
                  {word.example_sentence}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Step 5.4 — Dictation page

**File:** `frontend/src/pages/Dictation.jsx`

```jsx
import { useState } from "react";
import { startDictation, checkDictation } from "../api/media";

export default function Dictation() {
  const [loading, setLoading] = useState(false);
  const [exercise, setExercise] = useState(null);
  const [userText, setUserText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleStart = async () => {
    setLoading(true);
    setResult(null);
    setUserText("");
    setError(null);

    try {
      const res = await startDictation();
      setExercise(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to start dictation.");
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = () => {
    if (!exercise) return;
    const audio = new Audio(exercise.audio_clip.audio_url);
    audio.play();
  };

  const handleCheck = async () => {
    if (!exercise || !userText.trim()) return;

    setLoading(true);
    try {
      const res = await checkDictation(exercise.audio_clip.id, userText);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to check dictation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dictation</h1>
      <p className="text-gray-600 mb-6">
        Listen to the French sentence and type what you hear.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-700">
          {error}
        </div>
      )}

      {!exercise ? (
        <button
          onClick={handleStart}
          disabled={loading}
          className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {loading ? "Loading..." : "Start Dictation"}
        </button>
      ) : (
        <div className="space-y-6">
          {/* Audio controls */}
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <button
              onClick={handlePlay}
              className="w-16 h-16 inline-flex items-center justify-center rounded-full bg-primary-100 text-primary-600 hover:bg-primary-200 transition-colors"
              aria-label="Play dictation audio"
            >
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <p className="text-sm text-gray-500 mt-2">
              Click to listen. You can replay as many times as you need.
            </p>
          </div>

          {/* Text input */}
          <div>
            <label
              htmlFor="dictation-input"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Type what you hear:
            </label>
            <textarea
              id="dictation-input"
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Type the French sentence here..."
              disabled={!!result}
            />
          </div>

          {/* Submit button */}
          {!result && (
            <button
              onClick={handleCheck}
              disabled={loading || !userText.trim()}
              className="w-full px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Checking..." : "Check Answer"}
            </button>
          )}

          {/* Result */}
          {result && (
            <div
              className={`rounded-lg border p-6 ${
                result.correct
                  ? "bg-green-50 border-green-200"
                  : "bg-orange-50 border-orange-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">
                  {result.correct ? "\u2705" : "\u274C"}
                </span>
                <span
                  className={`font-semibold text-lg ${
                    result.correct ? "text-green-800" : "text-orange-800"
                  }`}
                >
                  {result.correct ? "Correct!" : "Not quite right"}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium text-gray-700">Expected: </span>
                  <span className="text-gray-900">{result.expected}</span>
                </p>
                <p>
                  <span className="font-medium text-gray-700">You wrote: </span>
                  <span className="text-gray-900">{result.user_text}</span>
                </p>
                <p>
                  <span className="font-medium text-gray-700">Accuracy: </span>
                  <span className="text-gray-900">
                    {Math.round(result.accuracy * 100)}%
                  </span>
                </p>
                <p className="text-gray-600 mt-2">{result.feedback}</p>
              </div>

              <button
                onClick={handleStart}
                className="mt-4 px-5 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                Next Sentence
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Step 5.5 — Pronunciation page

**File:** `frontend/src/pages/Pronunciation.jsx`

```jsx
import { useState, useRef } from "react";
import { checkPronunciation, generateTTS } from "../api/media";

export default function Pronunciation() {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const handlePlayExample = async () => {
    if (!text.trim()) return;
    try {
      const res = await generateTTS(text);
      const audio = new Audio(res.data.audio_url);
      await audio.play();
    } catch (err) {
      setError("Failed to play example audio.");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        await submitRecording(blob);
      };

      mediaRecorder.start();
      setRecording(true);
      setResult(null);
      setError(null);
    } catch (err) {
      setError(
        "Microphone access is required. Please allow microphone access and try again."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const submitRecording = async (blob) => {
    setLoading(true);
    try {
      const res = await checkPronunciation(blob, text);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to check pronunciation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Pronunciation Practice
      </h1>
      <p className="text-gray-600 mb-6">
        Enter a French word or sentence, listen to the example, then record
        yourself and get feedback.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-700">
          {error}
        </div>
      )}

      {/* Input + Listen */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label
          htmlFor="pronunciation-input"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          French text to practice:
        </label>
        <div className="flex gap-3">
          <input
            id="pronunciation-input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="e.g., Bonjour, comment allez-vous?"
          />
          <button
            onClick={handlePlayExample}
            disabled={!text.trim()}
            className="px-4 py-2 bg-primary-100 text-primary-600 rounded-lg hover:bg-primary-200 transition-colors disabled:opacity-50"
            title="Listen to example"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Record */}
      <div className="bg-white rounded-lg shadow p-6 mb-6 text-center">
        {!recording ? (
          <button
            onClick={startRecording}
            disabled={!text.trim() || loading}
            className="w-20 h-20 inline-flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
            aria-label="Start recording"
          >
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="6" />
            </svg>
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="w-20 h-20 inline-flex items-center justify-center rounded-full bg-red-500 text-white animate-pulse"
            aria-label="Stop recording"
          >
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        )}
        <p className="text-sm text-gray-500 mt-3">
          {loading
            ? "Analyzing your pronunciation..."
            : recording
              ? "Recording... Click to stop."
              : "Click to record your pronunciation."}
        </p>
      </div>

      {/* Result */}
      {result && (
        <div
          className={`rounded-lg border p-6 ${
            result.accuracy_score >= 0.8
              ? "bg-green-50 border-green-200"
              : result.accuracy_score >= 0.5
                ? "bg-yellow-50 border-yellow-200"
                : "bg-orange-50 border-orange-200"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold text-gray-900">
              Score: {Math.round(result.accuracy_score * 100)}%
            </span>
            <div className="w-24 bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${
                  result.accuracy_score >= 0.8
                    ? "bg-green-500"
                    : result.accuracy_score >= 0.5
                      ? "bg-yellow-500"
                      : "bg-orange-500"
                }`}
                style={{ width: `${result.accuracy_score * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium text-gray-700">Expected: </span>
              <span className="text-gray-900">{result.expected_text}</span>
            </p>
            <p>
              <span className="font-medium text-gray-700">Heard: </span>
              <span className="text-gray-900">{result.transcription}</span>
            </p>
            <p className="text-gray-600 mt-2">{result.feedback}</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 5.6 — Register routes in App.jsx

Update `frontend/src/App.jsx` — add imports and routes:

```jsx
import Dictation from "./pages/Dictation";
import Pronunciation from "./pages/Pronunciation";
```

Add inside the protected `<Route>` children:

```jsx
<Route path="practice/dictation" element={<Dictation />} />
<Route path="practice/pronunciation" element={<Pronunciation />} />
```

### Step 5.7 — Commit

```
git add frontend/src/api/media.js frontend/src/components/AudioPlayButton.jsx frontend/src/pages/Dictation.jsx frontend/src/pages/Pronunciation.jsx frontend/src/pages/LessonDetail.jsx frontend/src/App.jsx
git commit -m "feat(frontend): add audio play buttons, dictation page, pronunciation page

- AudioPlayButton component: click-to-play TTS for any French text
- LessonDetail vocab cards now show play buttons for word + example sentence
- /practice/dictation — hear a sentence, type what you hear, get scored
- /practice/pronunciation — enter text, record mic, get accuracy feedback
- New frontend/src/api/media.js API module for all media endpoints
- Routes registered in App.jsx"
```

---

## Task 6: Telegram Audio

**Goal:** `/dictation` command for the bot, and audio playback in the `/word` command.

**Why last:** Builds on all previous tasks — TTS service, dictation logic, and the existing bot handlers.

### Step 6.1 — Dictation handler

**File:** `backend/apps/bot/handlers/dictation.py`

```python
import logging

from telegram import Update
from telegram.ext import (
    ContextTypes,
    CommandHandler,
    ConversationHandler,
    MessageHandler,
    filters,
)

from apps.content.models import Vocabulary
from apps.media.models import AudioClip
from apps.users.models import User
from services.tts.service import get_or_create_audio
from services.stt.scoring import calculate_accuracy, generate_feedback

logger = logging.getLogger(__name__)

# Conversation states
WAITING_FOR_ANSWER = 0


async def dictation_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle /dictation — start a dictation exercise."""
    vocab = Vocabulary.objects.exclude(example_sentence="").order_by("?").first()

    if vocab is None:
        await update.message.reply_text(
            "No sentences available for dictation yet. Check back later!"
        )
        return ConversationHandler.END

    sentence = vocab.example_sentence
    clip = get_or_create_audio(text=sentence, language="fr")

    # Store the clip ID and expected text in context for later comparison
    context.user_data["dictation_clip_id"] = clip.id
    context.user_data["dictation_expected"] = sentence

    # Send audio file
    audio_path = clip.audio_file.path
    await update.message.reply_text(
        "Listen to the following sentence and type what you hear:"
    )
    with open(audio_path, "rb") as audio_file:
        await update.message.reply_audio(audio=audio_file)

    return WAITING_FOR_ANSWER


async def dictation_answer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle the user's typed answer for a dictation exercise."""
    user_text = update.message.text.strip()
    expected = context.user_data.get("dictation_expected", "")

    if not expected:
        await update.message.reply_text("Something went wrong. Try /dictation again.")
        return ConversationHandler.END

    accuracy = calculate_accuracy(expected, user_text)
    feedback = generate_feedback(accuracy, expected, user_text)
    is_correct = accuracy >= 0.9

    emoji = "\u2705" if is_correct else "\u274c"
    parts = [
        f"{emoji} **Accuracy: {int(accuracy * 100)}%**",
        f"Expected: _{expected}_",
        f"You wrote: _{user_text}_",
        "",
        feedback,
    ]

    await update.message.reply_text("\n".join(parts), parse_mode="Markdown")

    # Clean up context
    context.user_data.pop("dictation_clip_id", None)
    context.user_data.pop("dictation_expected", None)

    return ConversationHandler.END


async def dictation_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Cancel the dictation exercise."""
    await update.message.reply_text("Dictation cancelled.")
    context.user_data.pop("dictation_clip_id", None)
    context.user_data.pop("dictation_expected", None)
    return ConversationHandler.END


def dictation_conversation_handler() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CommandHandler("dictation", dictation_command)],
        states={
            WAITING_FOR_ANSWER: [
                MessageHandler(
                    filters.TEXT & ~filters.COMMAND,
                    dictation_answer,
                ),
            ],
        },
        fallbacks=[CommandHandler("cancel", dictation_cancel)],
    )
```

### Step 6.2 — Update /word to send audio

Update `backend/apps/bot/handlers/word.py`:

```python
import logging

from django.conf import settings
from telegram import Update
from telegram.ext import ContextTypes

from apps.content.models import Vocabulary
from services.tts.service import get_or_create_audio

logger = logging.getLogger(__name__)


def get_random_vocabulary():
    """Return a random Vocabulary item, or None if the table is empty."""
    item = Vocabulary.objects.order_by("?").first()
    return item


async def word_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /word command — send a random vocabulary item with audio."""
    vocab = get_random_vocabulary()

    if vocab is None:
        await update.message.reply_text(
            "No vocabulary items available yet. Check back later!"
        )
        return

    parts = [
        f"**{vocab.french}** — {vocab.english}",
    ]
    if vocab.pronunciation:
        parts.append(f"Pronunciation: {vocab.pronunciation}")
    if vocab.part_of_speech:
        parts.append(f"Part of speech: {vocab.part_of_speech}")
    if vocab.gender and vocab.gender != "a":
        gender_map = {"m": "masculine", "f": "feminine", "n": "neutral"}
        parts.append(f"Gender: {gender_map.get(vocab.gender, vocab.gender)}")
    if vocab.example_sentence:
        parts.append(f"\nExample: _{vocab.example_sentence}_")

    message = "\n".join(parts)
    await update.message.reply_text(message, parse_mode="Markdown")

    # Send audio of the French word
    try:
        clip = get_or_create_audio(text=vocab.french, language="fr")
        audio_path = clip.audio_file.path
        with open(audio_path, "rb") as audio_file:
            await update.message.reply_audio(audio=audio_file)
    except Exception as exc:
        logger.warning("Failed to send audio for /word: %s", exc)
```

### Step 6.3 — Register dictation handler in bot.py

Update `backend/apps/bot/bot.py`:

```python
import logging

from django.conf import settings
from telegram.ext import ApplicationBuilder, CommandHandler

from apps.bot.handlers.start import start_command
from apps.bot.handlers.help import help_command
from apps.bot.handlers.word import word_command
from apps.bot.handlers.stats import stats_command
from apps.bot.handlers.quiz import quiz_conversation_handler
from apps.bot.handlers.chat import chat_conversation_handler
from apps.bot.handlers.dictation import dictation_conversation_handler

logger = logging.getLogger(__name__)


def create_bot_application():
    """Build and configure the Telegram bot application."""
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        raise RuntimeError(
            "TELEGRAM_BOT_TOKEN is not set. "
            "Add it to your .env file or environment variables."
        )

    application = ApplicationBuilder().token(token).build()

    # Register command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("word", word_command))
    application.add_handler(CommandHandler("stats", stats_command))
    application.add_handler(quiz_conversation_handler())
    application.add_handler(chat_conversation_handler())
    application.add_handler(dictation_conversation_handler())

    logger.info("Telegram bot application configured successfully.")
    return application
```

### Step 6.4 — Telegram handler tests

**File:** `backend/apps/bot/tests/test_dictation_handler.py`

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from apps.bot.handlers.dictation import (
    dictation_command,
    dictation_answer,
    dictation_cancel,
    WAITING_FOR_ANSWER,
)
from telegram.ext import ConversationHandler


@pytest.fixture
def update():
    mock = AsyncMock()
    mock.message = AsyncMock()
    mock.message.reply_text = AsyncMock()
    mock.message.reply_audio = AsyncMock()
    return mock


@pytest.fixture
def context():
    mock = MagicMock()
    mock.user_data = {}
    return mock


@pytest.mark.django_db
class TestDictationCommand:
    @patch("apps.bot.handlers.dictation.get_or_create_audio")
    @patch("apps.bot.handlers.dictation.Vocabulary")
    async def test_starts_dictation(self, MockVocab, mock_audio, update, context):
        mock_vocab = MagicMock()
        mock_vocab.example_sentence = "Bonjour, comment allez-vous?"
        MockVocab.objects.exclude.return_value.order_by.return_value.first.return_value = mock_vocab

        mock_clip = MagicMock()
        mock_clip.id = 1
        mock_clip.audio_file.path = "/tmp/test.mp3"
        mock_audio.return_value = mock_clip

        with patch("builtins.open", MagicMock()):
            result = await dictation_command(update, context)

        assert result == WAITING_FOR_ANSWER
        assert context.user_data["dictation_expected"] == "Bonjour, comment allez-vous?"
        update.message.reply_text.assert_called()

    @patch("apps.bot.handlers.dictation.Vocabulary")
    async def test_no_sentences_available(self, MockVocab, update, context):
        MockVocab.objects.exclude.return_value.order_by.return_value.first.return_value = None

        result = await dictation_command(update, context)

        assert result == ConversationHandler.END
        update.message.reply_text.assert_called_once()


@pytest.mark.django_db
class TestDictationAnswer:
    async def test_correct_answer(self, update, context):
        context.user_data["dictation_expected"] = "Bonjour"
        update.message.text = "Bonjour"

        result = await dictation_answer(update, context)

        assert result == ConversationHandler.END
        call_args = update.message.reply_text.call_args[0][0]
        assert "100%" in call_args

    async def test_incorrect_answer(self, update, context):
        context.user_data["dictation_expected"] = "Bonjour le monde"
        update.message.text = "Au revoir"

        result = await dictation_answer(update, context)

        assert result == ConversationHandler.END
        call_args = update.message.reply_text.call_args[0][0]
        assert "Expected" in call_args

    async def test_no_expected_text(self, update, context):
        update.message.text = "something"

        result = await dictation_answer(update, context)

        assert result == ConversationHandler.END


class TestDictationCancel:
    async def test_cancel(self, update, context):
        context.user_data["dictation_expected"] = "test"

        result = await dictation_cancel(update, context)

        assert result == ConversationHandler.END
        assert "dictation_expected" not in context.user_data
```

**File:** `backend/apps/bot/tests/test_word_handler.py`

Add a test for the audio sending behavior:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from apps.bot.handlers.word import word_command


@pytest.fixture
def update():
    mock = AsyncMock()
    mock.message = AsyncMock()
    mock.message.reply_text = AsyncMock()
    mock.message.reply_audio = AsyncMock()
    return mock


@pytest.fixture
def context():
    return MagicMock()


@pytest.mark.django_db
class TestWordCommandAudio:
    @patch("apps.bot.handlers.word.get_or_create_audio")
    @patch("apps.bot.handlers.word.get_random_vocabulary")
    async def test_word_sends_audio(self, mock_get_vocab, mock_audio, update, context):
        mock_vocab = MagicMock()
        mock_vocab.french = "Bonjour"
        mock_vocab.english = "Hello"
        mock_vocab.pronunciation = ""
        mock_vocab.part_of_speech = ""
        mock_vocab.gender = "a"
        mock_vocab.example_sentence = ""
        mock_get_vocab.return_value = mock_vocab

        mock_clip = MagicMock()
        mock_clip.audio_file.path = "/tmp/test.mp3"
        mock_audio.return_value = mock_clip

        with patch("builtins.open", MagicMock()):
            await word_command(update, context)

        update.message.reply_text.assert_called_once()
        mock_audio.assert_called_once_with(text="Bonjour", language="fr")

    @patch("apps.bot.handlers.word.get_random_vocabulary")
    async def test_word_no_vocab(self, mock_get_vocab, update, context):
        mock_get_vocab.return_value = None

        await word_command(update, context)

        update.message.reply_text.assert_called_once()
        assert "No vocabulary" in update.message.reply_text.call_args[0][0]
```

Run all bot tests:

```bash
pytest backend/apps/bot/tests/ -v
```

### Step 6.5 — Commit

```
git add backend/apps/bot/ backend/requirements.txt
git commit -m "feat(bot): add /dictation command and audio in /word

- /dictation — bot sends audio, user types answer, gets accuracy scored
- /word now sends an MP3 audio clip of the French word after the text card
- ConversationHandler for dictation with cancel support
- Full test coverage for both handlers"
```

---

## Summary of files created/modified

### New files

| File | Purpose |
|---|---|
| `backend/apps/media/__init__.py` | App init |
| `backend/apps/media/apps.py` | AppConfig |
| `backend/apps/media/models.py` | AudioClip, PronunciationAttempt |
| `backend/apps/media/admin.py` | Admin registration |
| `backend/apps/media/serializers.py` | TTS, pronunciation, dictation serializers |
| `backend/apps/media/views.py` | TTSView, PronunciationCheckView, DictationStartView, DictationCheckView |
| `backend/apps/media/urls.py` | URL routing |
| `backend/apps/media/tests/test_models.py` | Model tests |
| `backend/apps/media/tests/test_serializers.py` | Serializer tests |
| `backend/apps/media/tests/test_views.py` | View tests |
| `backend/services/tts/__init__.py` | Service init |
| `backend/services/tts/base.py` | BaseTTSProvider, TTSResult |
| `backend/services/tts/gtts_provider.py` | GTTSProvider (gTTS wrapper with disk cache) |
| `backend/services/tts/service.py` | get_or_create_audio() facade |
| `backend/services/tts/tests/test_gtts_provider.py` | Provider tests (mocked gTTS) |
| `backend/services/tts/tests/test_service.py` | Service tests (mocked provider) |
| `backend/services/stt/__init__.py` | Service init |
| `backend/services/stt/base.py` | BaseSTTProvider, STTResult |
| `backend/services/stt/groq_whisper.py` | GroqWhisperProvider (Groq Whisper API) |
| `backend/services/stt/scoring.py` | normalize_text, calculate_accuracy, generate_feedback |
| `backend/services/stt/tests/test_groq_whisper.py` | Whisper provider tests (mocked Groq) |
| `backend/services/stt/tests/test_scoring.py` | Scoring unit tests |
| `backend/apps/bot/handlers/dictation.py` | /dictation ConversationHandler |
| `backend/apps/bot/tests/test_dictation_handler.py` | Dictation handler tests |
| `backend/apps/bot/tests/test_word_handler.py` | Updated /word handler tests |
| `frontend/src/api/media.js` | API client for media endpoints |
| `frontend/src/components/AudioPlayButton.jsx` | Click-to-play TTS button |
| `frontend/src/pages/Dictation.jsx` | Dictation exercise page |
| `frontend/src/pages/Pronunciation.jsx` | Pronunciation practice page |

### Modified files

| File | Change |
|---|---|
| `backend/config/settings/base.py` | Add `"apps.media"` to INSTALLED_APPS |
| `backend/config/urls.py` | Add `path("api/media/", include("apps.media.urls"))` |
| `backend/requirements.txt` | Add `gTTS>=2.5.0,<3.0` |
| `backend/apps/bot/bot.py` | Import + register dictation_conversation_handler |
| `backend/apps/bot/handlers/word.py` | Add TTS audio sending after text reply |
| `frontend/src/App.jsx` | Add Dictation + Pronunciation routes |
| `frontend/src/pages/LessonDetail.jsx` | Add AudioPlayButton to VocabSection |
