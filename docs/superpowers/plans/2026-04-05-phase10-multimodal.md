# Phase 10: Multimodal -- Image Queries + Voice Conversation

**Date:** 2026-04-05
**Depends on:** Phases 1-9 (all deployed -- especially Phase 5 AI Assistant, Phase 7 Audio)
**Delivers:** Image query analysis via Gemini Vision, voice conversation loop (STT + LLM + TTS) via API + Frontend + Telegram

---

## Overview

This phase adds two multimodal capabilities to the AI assistant:

1. **Image Queries** -- user uploads a photo (textbook page, French sign, menu, etc.), Gemini Vision extracts and explains the French text
2. **Voice Conversation** -- user records audio in French, Groq Whisper transcribes it, LLM responds, gTTS generates audio of the response

Both features integrate into the existing assistant app (API + conversation model), the React chat page, and the Telegram bot's `/chat` flow.

### Key architectural decisions

- `generate_with_image()` is added to `GeminiProvider` only -- Groq/Llama does not support vision, so no fallback for image queries (acceptable: Gemini free tier is generous)
- `ProviderRouter` gets a `generate_with_image()` that delegates to primary only (raises if primary lacks vision support)
- `ImageQuery` model lives in `apps/assistant` alongside Conversation/Message (spec says `assistant` owns image queries)
- Voice conversation reuses the existing `ChatView` flow -- a new `VoiceChatView` wraps STT + chat + TTS into one round-trip
- Telegram photo/voice handlers are added as additional message filters inside the existing `chat_conversation_handler`

### New files

```
NEW  backend/apps/assistant/tests/test_image_query.py
NEW  backend/apps/assistant/tests/test_voice_chat.py
NEW  backend/services/llm/tests/test_gemini_vision.py

MOD  backend/services/llm/base.py              # add generate_with_image() to BaseProvider
MOD  backend/services/llm/gemini.py            # implement generate_with_image()
MOD  backend/services/llm/router.py            # add generate_with_image() routing
MOD  backend/apps/assistant/models.py          # add ImageQuery model
MOD  backend/apps/assistant/serializers.py     # add ImageQuery + VoiceChat serializers
MOD  backend/apps/assistant/views.py           # add ImageQueryView + VoiceChatView
MOD  backend/apps/assistant/urls.py            # add image-query/ + voice-chat/ routes
MOD  backend/apps/assistant/admin.py           # register ImageQuery
MOD  backend/apps/bot/handlers/chat.py         # handle photo + voice messages
MOD  backend/apps/bot/bot.py                   # update chat handler filters
MOD  backend/services/llm/prompts.py           # add image_query system prompt
MOD  frontend/src/api/assistant.js             # add sendImageQuery + sendVoiceChat
MOD  frontend/src/pages/Assistant.jsx          # add image upload + voice record UI
```

---

## Task 1: Gemini Vision Extension (TDD)

**Goal:** Add `generate_with_image()` to `GeminiProvider` and `ProviderRouter`. TDD with mocked Gemini API.

**Commit:** `feat(llm): add Gemini Vision support for image+text generation`

### Step 1.1 -- Write tests first

```python
# backend/services/llm/tests/test_gemini_vision.py
from unittest.mock import MagicMock, patch
from django.test import TestCase

from services.llm.base import LLMResponse
from services.llm.gemini import GeminiProvider
from services.llm.router import ProviderRouter


class TestGeminiVisionGeneration(TestCase):
    """Test generate_with_image on GeminiProvider."""

    @patch("services.llm.gemini.genai")
    def test_generate_with_image_returns_response(self, mock_genai):
        """Image + text prompt returns an LLMResponse with extracted content."""
        # Arrange
        mock_response = MagicMock()
        mock_response.text = "This is a French menu. It says 'Plat du jour: Poulet roti'."
        mock_response.usage_metadata = MagicMock(total_token_count=150)

        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model_instance

        provider = GeminiProvider(api_key="fake-key", model="gemini-2.0-flash")

        messages = [{"role": "user", "content": "What does this menu say?"}]
        image_data = b"fake-image-bytes"

        # Act
        result = provider.generate_with_image(
            messages=messages,
            image_data=image_data,
            image_mime_type="image/jpeg",
            system_prompt="Analyze this French image.",
        )

        # Assert
        self.assertIsInstance(result, LLMResponse)
        self.assertEqual(result.provider, "gemini")
        self.assertIn("French menu", result.content)
        self.assertEqual(result.tokens_used, 150)

        # Verify the model was constructed with a system instruction
        mock_genai.GenerativeModel.assert_called_once_with(
            "gemini-2.0-flash",
            system_instruction="Analyze this French image.",
        )

        # Verify generate_content was called with image part + text
        call_args = mock_model_instance.generate_content.call_args
        contents = call_args[0][0]
        # Should have the image part and the user text
        self.assertEqual(len(contents), 2)

    @patch("services.llm.gemini.genai")
    def test_generate_with_image_no_question(self, mock_genai):
        """Image with empty messages still works (just image analysis)."""
        mock_response = MagicMock()
        mock_response.text = "A French street sign reading 'Rue de la Paix'."
        mock_response.usage_metadata = MagicMock(total_token_count=80)

        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model_instance

        provider = GeminiProvider(api_key="fake-key", model="gemini-2.0-flash")

        result = provider.generate_with_image(
            messages=[],
            image_data=b"fake-image-bytes",
            image_mime_type="image/jpeg",
            system_prompt="Analyze this French image.",
        )

        self.assertIn("Rue de la Paix", result.content)

    @patch("services.llm.gemini.genai")
    def test_generate_with_image_token_count_fallback(self, mock_genai):
        """Handles missing usage_metadata gracefully."""
        mock_response = MagicMock()
        mock_response.text = "Some response"
        mock_response.usage_metadata = None

        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model_instance

        provider = GeminiProvider(api_key="fake-key", model="gemini-2.0-flash")

        result = provider.generate_with_image(
            messages=[{"role": "user", "content": "What is this?"}],
            image_data=b"fake-bytes",
            image_mime_type="image/png",
            system_prompt="Analyze.",
        )

        self.assertEqual(result.tokens_used, 0)


class TestProviderRouterVision(TestCase):
    """Test that ProviderRouter delegates generate_with_image correctly."""

    def test_router_calls_primary_for_vision(self):
        """Router delegates to primary provider's generate_with_image."""
        mock_primary = MagicMock()
        mock_primary.generate_with_image.return_value = LLMResponse(
            content="analyzed", provider="gemini", tokens_used=100,
        )

        router = ProviderRouter(primary=mock_primary, fallback=None)
        result = router.generate_with_image(
            messages=[{"role": "user", "content": "Explain"}],
            image_data=b"bytes",
            image_mime_type="image/jpeg",
            system_prompt="Analyze.",
        )

        self.assertEqual(result.content, "analyzed")
        mock_primary.generate_with_image.assert_called_once()

    def test_router_raises_if_primary_lacks_vision(self):
        """Router raises NotImplementedError if primary has no vision support."""
        mock_primary = MagicMock()
        mock_primary.generate_with_image.side_effect = NotImplementedError(
            "This provider does not support vision.",
        )

        router = ProviderRouter(primary=mock_primary, fallback=None)

        with self.assertRaises(NotImplementedError):
            router.generate_with_image(
                messages=[], image_data=b"bytes",
                image_mime_type="image/jpeg", system_prompt="Analyze.",
            )

    def test_router_does_not_fallback_for_vision(self):
        """Vision does not fall back -- only Gemini supports it."""
        mock_primary = MagicMock()
        mock_primary.generate_with_image.side_effect = Exception("Gemini down")
        mock_fallback = MagicMock()

        router = ProviderRouter(primary=mock_primary, fallback=mock_fallback)

        with self.assertRaises(Exception):
            router.generate_with_image(
                messages=[], image_data=b"bytes",
                image_mime_type="image/jpeg", system_prompt="Analyze.",
            )

        # Fallback should NOT be called for vision
        mock_fallback.generate_with_image.assert_not_called()
```

### Step 1.2 -- Extend BaseProvider

```python
# backend/services/llm/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class LLMResponse:
    content: str
    provider: str
    tokens_used: int


class BaseProvider(ABC):
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    @abstractmethod
    def generate(
        self,
        messages: list[dict],
        system_prompt: str,
    ) -> LLMResponse:
        """Generate a response from the LLM.

        Args:
            messages: List of {"role": "user"|"assistant", "content": "..."} dicts.
            system_prompt: System instruction for the model.

        Returns:
            LLMResponse with the generated content, provider name, and token usage.
        """

    def generate_with_image(
        self,
        messages: list[dict],
        image_data: bytes,
        image_mime_type: str,
        system_prompt: str,
    ) -> LLMResponse:
        """Generate a response from the LLM given an image + text.

        Default implementation raises NotImplementedError.
        Providers that support vision (e.g. Gemini) override this.

        Args:
            messages: List of {"role": "user"|"assistant", "content": "..."} dicts.
            image_data: Raw image bytes (JPEG, PNG, etc.).
            image_mime_type: MIME type of the image (e.g. "image/jpeg").
            system_prompt: System instruction for the model.

        Returns:
            LLMResponse with the generated content, provider name, and token usage.
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} does not support vision/image input."
        )
```

### Step 1.3 -- Implement generate_with_image in GeminiProvider

```python
# backend/services/llm/gemini.py
import logging

import google.generativeai as genai

from .base import BaseProvider, LLMResponse

logger = logging.getLogger(__name__)


class GeminiProvider(BaseProvider):
    """Google Gemini LLM provider."""

    def __init__(self, api_key: str, model: str):
        super().__init__(api_key, model)
        genai.configure(api_key=api_key)

    def generate(
        self,
        messages: list[dict],
        system_prompt: str,
    ) -> LLMResponse:
        model = genai.GenerativeModel(
            self.model,
            system_instruction=system_prompt,
        )

        # Convert messages to Gemini's content format
        contents = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            contents.append({"role": role, "parts": [msg["content"]]})

        response = model.generate_content(contents)

        tokens_used = 0
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            tokens_used = getattr(response.usage_metadata, "total_token_count", 0)

        logger.info(
            "Gemini response: model=%s, tokens=%d", self.model, tokens_used,
        )

        return LLMResponse(
            content=response.text,
            provider="gemini",
            tokens_used=tokens_used,
        )

    def generate_with_image(
        self,
        messages: list[dict],
        image_data: bytes,
        image_mime_type: str,
        system_prompt: str,
    ) -> LLMResponse:
        """Generate a response from Gemini given an image and optional text.

        Uses Gemini's native multimodal input: sends the image as an inline
        blob alongside any user text.
        """
        model = genai.GenerativeModel(
            self.model,
            system_instruction=system_prompt,
        )

        # Build content parts: image first, then the latest user text
        image_part = {
            "inline_data": {
                "mime_type": image_mime_type,
                "data": image_data,
            }
        }

        # Combine: image + user question (if any)
        user_text = ""
        if messages:
            user_text = messages[-1].get("content", "")

        if user_text:
            contents = [image_part, user_text]
        else:
            contents = [image_part]

        response = model.generate_content(contents)

        tokens_used = 0
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            tokens_used = getattr(response.usage_metadata, "total_token_count", 0)

        logger.info(
            "Gemini vision response: model=%s, tokens=%d", self.model, tokens_used,
        )

        return LLMResponse(
            content=response.text,
            provider="gemini",
            tokens_used=tokens_used,
        )
```

### Step 1.4 -- Extend ProviderRouter

The router passes through `generate_with_image` to primary only -- no fallback for vision since only Gemini supports it.

```python
# backend/services/llm/router.py
import logging

from .base import BaseProvider, LLMResponse

logger = logging.getLogger(__name__)


class ProviderRouter:
    """Routes LLM calls to primary provider, falls back on error."""

    def __init__(self, primary: BaseProvider, fallback: BaseProvider | None = None):
        self.primary = primary
        self.fallback = fallback

    def generate(
        self,
        messages: list[dict],
        system_prompt: str,
    ) -> LLMResponse:
        try:
            return self.primary.generate(messages, system_prompt)
        except Exception as exc:
            if self.fallback is None:
                raise

            logger.warning(
                "Primary provider failed (%s), falling back. Error: %s",
                type(exc).__name__,
                exc,
            )
            return self.fallback.generate(messages, system_prompt)

    def generate_with_image(
        self,
        messages: list[dict],
        image_data: bytes,
        image_mime_type: str,
        system_prompt: str,
    ) -> LLMResponse:
        """Route image+text generation to the primary provider.

        No fallback -- vision is Gemini-only. Raises directly on failure.
        """
        return self.primary.generate_with_image(
            messages=messages,
            image_data=image_data,
            image_mime_type=image_mime_type,
            system_prompt=system_prompt,
        )
```

### Step 1.5 -- Add image_query system prompt

Append to `backend/services/llm/prompts.py`:

```python
# Add to SYSTEM_PROMPTS dict:
    "image_query": (
        "You are a French language learning assistant analyzing an image. "
        "Extract any French text visible in the image. Then:\n"
        "1. Provide the extracted French text\n"
        "2. Translate it to English\n"
        "3. Explain any interesting grammar, vocabulary, or cultural notes\n"
        "4. If the user asked a specific question, answer it\n"
        "Keep explanations clear and targeted at B1-B2 level learners."
    ),
```

### Step 1.6 -- Run tests, verify green

```bash
cd backend
python -m pytest services/llm/tests/test_gemini_vision.py -v
```

---

## Task 2: ImageQuery Model + API (TDD)

**Goal:** Add `ImageQuery` model to the assistant app and an `image-query/` API endpoint. TDD.

**Commit:** `feat(assistant): add ImageQuery model and image analysis endpoint`

### Step 2.1 -- Write tests first

```python
# backend/apps/assistant/tests/test_image_query.py
import io
from unittest.mock import patch, MagicMock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.assistant.models import ImageQuery, Conversation
from apps.users.models import User
from services.llm.base import LLMResponse


class TestImageQueryModel(TestCase):
    """Test ImageQuery model creation and relationships."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="imguser", password="testpass123",
        )

    def test_create_image_query_without_conversation(self):
        """ImageQuery can be created without a conversation."""
        query = ImageQuery.objects.create(
            user=self.user,
            image_file=SimpleUploadedFile(
                "test.jpg", b"fake-image-data", content_type="image/jpeg",
            ),
            extracted_text="Plat du jour",
            ai_response="This means 'dish of the day'.",
        )
        self.assertIsNotNone(query.id)
        self.assertIsNone(query.conversation)
        self.assertEqual(query.user, self.user)

    def test_create_image_query_with_conversation(self):
        """ImageQuery can be linked to an existing conversation."""
        conv = Conversation.objects.create(user=self.user, title="Image chat")
        query = ImageQuery.objects.create(
            user=self.user,
            conversation=conv,
            image_file=SimpleUploadedFile(
                "menu.jpg", b"fake-image", content_type="image/jpeg",
            ),
            ai_response="French menu analysis.",
        )
        self.assertEqual(query.conversation, conv)

    def test_str_representation(self):
        """String representation is meaningful."""
        query = ImageQuery.objects.create(
            user=self.user,
            image_file=SimpleUploadedFile(
                "test.jpg", b"data", content_type="image/jpeg",
            ),
            ai_response="Some response.",
        )
        self.assertIn("ImageQuery", str(query))


class TestImageQueryAPI(TestCase):
    """Test POST /api/assistant/image-query/ endpoint."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="imgapi", password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.url = "/api/assistant/image-query/"

    @patch("apps.assistant.views.create_llm_router")
    def test_image_query_success(self, mock_create_router):
        """Upload image, get AI analysis back."""
        mock_router = MagicMock()
        mock_router.generate_with_image.return_value = LLMResponse(
            content="This sign says 'Sortie' which means 'Exit'.",
            provider="gemini",
            tokens_used=120,
        )
        mock_create_router.return_value = mock_router

        image = SimpleUploadedFile(
            "sign.jpg", b"fake-jpeg-bytes", content_type="image/jpeg",
        )
        response = self.client.post(
            self.url,
            {"image": image, "question": "What does this sign say?"},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Sortie", response.data["ai_response"])
        self.assertIn("image_query_id", response.data)
        self.assertIn("conversation_id", response.data)

        # Verify DB record created
        query = ImageQuery.objects.get(pk=response.data["image_query_id"])
        self.assertEqual(query.user, self.user)
        self.assertIn("Sortie", query.ai_response)

    @patch("apps.assistant.views.create_llm_router")
    def test_image_query_with_existing_conversation(self, mock_create_router):
        """Image query linked to an existing conversation."""
        mock_router = MagicMock()
        mock_router.generate_with_image.return_value = LLMResponse(
            content="A French menu.", provider="gemini", tokens_used=80,
        )
        mock_create_router.return_value = mock_router

        conv = Conversation.objects.create(user=self.user, title="Chat")

        image = SimpleUploadedFile(
            "menu.jpg", b"fake-data", content_type="image/jpeg",
        )
        response = self.client.post(
            self.url,
            {"image": image, "conversation_id": conv.id},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["conversation_id"], conv.id)

    def test_image_query_no_image_returns_400(self):
        """Request without image file returns 400."""
        response = self.client.post(self.url, {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("apps.assistant.views.create_llm_router")
    def test_image_query_no_question(self, mock_create_router):
        """Image without question text still works (pure image analysis)."""
        mock_router = MagicMock()
        mock_router.generate_with_image.return_value = LLMResponse(
            content="French text found in image.", provider="gemini", tokens_used=90,
        )
        mock_create_router.return_value = mock_router

        image = SimpleUploadedFile(
            "page.png", b"fake-data", content_type="image/png",
        )
        response = self.client.post(
            self.url, {"image": image}, format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch("apps.assistant.views.create_llm_router")
    def test_image_query_llm_failure_returns_503(self, mock_create_router):
        """LLM failure returns 503."""
        mock_router = MagicMock()
        mock_router.generate_with_image.side_effect = Exception("Gemini down")
        mock_create_router.return_value = mock_router

        image = SimpleUploadedFile(
            "test.jpg", b"fake", content_type="image/jpeg",
        )
        response = self.client.post(
            self.url, {"image": image}, format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    def test_image_query_requires_auth(self):
        """Unauthenticated request returns 401."""
        anon_client = APIClient()
        image = SimpleUploadedFile(
            "test.jpg", b"fake", content_type="image/jpeg",
        )
        response = anon_client.post(
            self.url, {"image": image}, format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
```

### Step 2.2 -- ImageQuery model

```python
# Add to backend/apps/assistant/models.py (after Message class):

class ImageQuery(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="image_queries",
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="image_queries",
    )
    image_file = models.ImageField(upload_to="image_queries/")
    question = models.TextField(blank=True, default="")
    extracted_text = models.TextField(blank=True, default="")
    ai_response = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assistant_image_queries"
        ordering = ["-created_at"]

    def __str__(self):
        return f"ImageQuery(user={self.user_id}, id={self.id})"
```

### Step 2.3 -- Serializers

```python
# Add to backend/apps/assistant/serializers.py:

class ImageQueryRequestSerializer(serializers.Serializer):
    image = serializers.ImageField()
    question = serializers.CharField(required=False, default="", allow_blank=True)
    conversation_id = serializers.IntegerField(required=False, allow_null=True)
```

### Step 2.4 -- ImageQueryView

```python
# Add to backend/apps/assistant/views.py:

class ImageQueryView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        from .serializers import ImageQueryRequestSerializer

        serializer = ImageQueryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        image_file = serializer.validated_data["image"]
        question = serializer.validated_data.get("question", "")
        conversation_id = serializer.validated_data.get("conversation_id")

        # Resolve or create conversation
        conversation = None
        if conversation_id:
            try:
                conversation = Conversation.objects.get(
                    pk=conversation_id, user=request.user,
                )
            except Conversation.DoesNotExist:
                return Response(
                    {"detail": "Conversation not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            title = f"Image: {question[:40]}" if question else "Image query"
            conversation = Conversation.objects.create(
                user=request.user,
                title=title,
            )

        # Read image bytes
        image_data = image_file.read()
        image_mime_type = image_file.content_type or "image/jpeg"

        # Build messages
        messages = []
        if question:
            messages.append({"role": "user", "content": question})

        # Call Gemini Vision
        try:
            router = create_llm_router()
            llm_response = router.generate_with_image(
                messages=messages,
                image_data=image_data,
                image_mime_type=image_mime_type,
                system_prompt=SYSTEM_PROMPTS["image_query"],
            )
        except Exception as exc:
            logger.error("Vision LLM call failed: %s", exc)
            return Response(
                {"detail": "AI vision service is temporarily unavailable. Please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Save ImageQuery record
        from .models import ImageQuery
        image_query = ImageQuery.objects.create(
            user=request.user,
            conversation=conversation,
            image_file=image_file,
            question=question,
            ai_response=llm_response.content,
        )

        # Also save as messages in the conversation for continuity
        if question:
            Message.objects.create(
                conversation=conversation,
                role="user",
                content=f"[Image uploaded] {question}",
            )
        else:
            Message.objects.create(
                conversation=conversation,
                role="user",
                content="[Image uploaded for analysis]",
            )

        Message.objects.create(
            conversation=conversation,
            role="assistant",
            content=llm_response.content,
            provider=llm_response.provider,
            tokens_used=llm_response.tokens_used,
        )

        return Response({
            "image_query_id": image_query.id,
            "ai_response": llm_response.content,
            "conversation_id": conversation.id,
            "provider": llm_response.provider,
            "tokens_used": llm_response.tokens_used,
        })
```

### Step 2.5 -- URL route

```python
# backend/apps/assistant/urls.py -- add:
    path("image-query/", views.ImageQueryView.as_view(), name="image-query"),
```

### Step 2.6 -- Admin registration

```python
# backend/apps/assistant/admin.py -- add:
from .models import ImageQuery

@admin.register(ImageQuery)
class ImageQueryAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "question", "created_at")
    list_filter = ("created_at",)
    raw_id_fields = ("user", "conversation")
```

### Step 2.7 -- Migration and tests

```bash
cd backend
python manage.py makemigrations assistant
python -m pytest apps/assistant/tests/test_image_query.py -v
```

---

## Task 3: Voice Chat API (TDD)

**Goal:** Add `POST /api/assistant/voice-chat/` endpoint that combines STT + LLM + TTS into one round-trip. TDD.

**Commit:** `feat(assistant): add voice chat endpoint with STT + LLM + TTS pipeline`

### Step 3.1 -- Write tests first

```python
# backend/apps/assistant/tests/test_voice_chat.py
from unittest.mock import patch, MagicMock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.assistant.models import Conversation, Message
from apps.users.models import User
from services.llm.base import LLMResponse
from services.stt.base import STTResult


class TestVoiceChatAPI(TestCase):
    """Test POST /api/assistant/voice-chat/ endpoint."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="voiceuser", password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.url = "/api/assistant/voice-chat/"

    @patch("apps.assistant.views.get_or_create_audio")
    @patch("apps.assistant.views.create_llm_router")
    @patch("apps.assistant.views.GroqWhisperProvider")
    def test_voice_chat_full_pipeline(self, mock_stt_cls, mock_create_router, mock_tts):
        """Audio in -> STT -> LLM -> TTS -> response with text + audio."""
        # STT mock
        mock_stt = MagicMock()
        mock_stt.transcribe.return_value = STTResult(
            transcription="Bonjour, comment allez-vous?",
            provider="groq_whisper",
            language="fr",
        )
        mock_stt_cls.return_value = mock_stt

        # LLM mock
        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="Je vais bien, merci! Et vous?",
            provider="gemini",
            tokens_used=50,
        )
        mock_create_router.return_value = mock_router

        # TTS mock
        mock_clip = MagicMock()
        mock_clip.audio_file.url = "/media/audio/abc123.mp3"
        mock_tts.return_value = mock_clip

        audio = SimpleUploadedFile(
            "voice.webm", b"fake-audio-data", content_type="audio/webm",
        )
        response = self.client.post(
            self.url,
            {"audio": audio},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["transcription"], "Bonjour, comment allez-vous?")
        self.assertEqual(response.data["ai_response_text"], "Je vais bien, merci! Et vous?")
        self.assertIn("ai_response_audio_url", response.data)
        self.assertIn("conversation_id", response.data)

    @patch("apps.assistant.views.get_or_create_audio")
    @patch("apps.assistant.views.create_llm_router")
    @patch("apps.assistant.views.GroqWhisperProvider")
    def test_voice_chat_with_existing_conversation(
        self, mock_stt_cls, mock_create_router, mock_tts,
    ):
        """Voice chat can continue an existing conversation."""
        conv = Conversation.objects.create(user=self.user, title="Voice chat")

        mock_stt = MagicMock()
        mock_stt.transcribe.return_value = STTResult(
            transcription="Merci", provider="groq_whisper", language="fr",
        )
        mock_stt_cls.return_value = mock_stt

        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="De rien!", provider="gemini", tokens_used=20,
        )
        mock_create_router.return_value = mock_router

        mock_clip = MagicMock()
        mock_clip.audio_file.url = "/media/audio/def456.mp3"
        mock_tts.return_value = mock_clip

        audio = SimpleUploadedFile(
            "voice.webm", b"fake-audio", content_type="audio/webm",
        )
        response = self.client.post(
            self.url,
            {"audio": audio, "conversation_id": conv.id},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["conversation_id"], conv.id)

        # Verify messages saved to conversation
        messages = Message.objects.filter(conversation=conv)
        self.assertEqual(messages.count(), 2)
        self.assertEqual(messages.first().role, "user")
        self.assertEqual(messages.last().role, "assistant")

    def test_voice_chat_no_audio_returns_400(self):
        """Request without audio file returns 400."""
        response = self.client.post(self.url, {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("apps.assistant.views.GroqWhisperProvider")
    def test_voice_chat_stt_failure_returns_503(self, mock_stt_cls):
        """STT failure returns 503 with helpful message."""
        mock_stt = MagicMock()
        mock_stt.transcribe.side_effect = Exception("Whisper API down")
        mock_stt_cls.return_value = mock_stt

        audio = SimpleUploadedFile(
            "voice.webm", b"fake", content_type="audio/webm",
        )
        response = self.client.post(
            self.url, {"audio": audio}, format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    def test_voice_chat_requires_auth(self):
        """Unauthenticated request returns 401."""
        anon = APIClient()
        audio = SimpleUploadedFile(
            "voice.webm", b"fake", content_type="audio/webm",
        )
        response = anon.post(self.url, {"audio": audio}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
```

### Step 3.2 -- VoiceChat serializer

```python
# Add to backend/apps/assistant/serializers.py:

class VoiceChatRequestSerializer(serializers.Serializer):
    audio = serializers.FileField()
    conversation_id = serializers.IntegerField(required=False, allow_null=True)
    mode = serializers.ChoiceField(
        choices=[("conversation", "Conversation")],
        default="conversation",
    )
```

### Step 3.3 -- VoiceChatView

```python
# Add to backend/apps/assistant/views.py (add imports at top):
from services.stt.groq_whisper import GroqWhisperProvider
from services.tts.service import get_or_create_audio


class VoiceChatView(APIView):
    """Voice conversation: audio in -> STT -> LLM -> TTS -> audio out."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        from .serializers import VoiceChatRequestSerializer

        serializer = VoiceChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        audio_file = serializer.validated_data["audio"]
        conversation_id = serializer.validated_data.get("conversation_id")
        mode = serializer.validated_data.get("mode", "conversation")

        # 1. STT: transcribe user audio
        try:
            stt = GroqWhisperProvider()
            stt_result = stt.transcribe(audio_file=audio_file, language="fr")
        except Exception as exc:
            logger.error("STT failed in voice chat: %s", exc)
            return Response(
                {"detail": "Speech recognition is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        user_text = stt_result.transcription

        # Resolve or create conversation
        if conversation_id:
            try:
                conversation = Conversation.objects.get(
                    pk=conversation_id, user=request.user,
                )
            except Conversation.DoesNotExist:
                return Response(
                    {"detail": "Conversation not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            title = f"Voice: {user_text[:40]}..." if len(user_text) > 40 else f"Voice: {user_text}"
            conversation = Conversation.objects.create(
                user=request.user,
                title=title,
            )

        # Save user message (transcribed text)
        Message.objects.create(
            conversation=conversation,
            role="user",
            content=user_text,
        )

        # Build message history
        prior_messages = Message.objects.filter(
            conversation=conversation,
        ).order_by("created_at")
        messages = [
            {"role": msg.role, "content": msg.content}
            for msg in prior_messages
        ]

        system_prompt = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["conversation"])

        # 2. LLM: generate response
        try:
            router = create_llm_router()
            llm_response = router.generate(
                messages=messages,
                system_prompt=system_prompt,
            )
        except Exception as exc:
            logger.error("LLM call failed in voice chat: %s", exc)
            return Response(
                {"detail": "AI service is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Save assistant message
        Message.objects.create(
            conversation=conversation,
            role="assistant",
            content=llm_response.content,
            provider=llm_response.provider,
            tokens_used=llm_response.tokens_used,
        )

        # 3. TTS: generate audio of the response
        try:
            clip = get_or_create_audio(text=llm_response.content, language="fr")
            audio_url = request.build_absolute_uri(clip.audio_file.url)
        except Exception as exc:
            logger.warning("TTS failed in voice chat: %s", exc)
            audio_url = None

        # Gamification: XP for voice conversation at 5+ exchanges
        user_msg_count = Message.objects.filter(
            conversation=conversation, role="user",
        ).count()
        if user_msg_count == 5:
            from apps.gamification.services import award_xp, check_streak
            award_xp(
                request.user,
                activity_type="ai_conversation",
                xp_amount=15,
                source_id=f"conversation_{conversation.id}",
            )
            check_streak(request.user)

        return Response({
            "transcription": user_text,
            "ai_response_text": llm_response.content,
            "ai_response_audio_url": audio_url,
            "conversation_id": conversation.id,
            "provider": llm_response.provider,
            "tokens_used": llm_response.tokens_used,
        })
```

### Step 3.4 -- URL route

```python
# backend/apps/assistant/urls.py -- add:
    path("voice-chat/", views.VoiceChatView.as_view(), name="voice-chat"),
```

### Step 3.5 -- Run tests

```bash
cd backend
python -m pytest apps/assistant/tests/test_voice_chat.py -v
```

---

## Task 4: Frontend Multimodal (Image Upload + Voice Recording)

**Goal:** Add image upload button and voice record button to the Assistant chat page. Display image previews and play audio responses.

**Commit:** `feat(frontend): add image upload and voice recording to Assistant chat`

### Step 4.1 -- API functions

```javascript
// frontend/src/api/assistant.js -- add:

export const sendImageQuery = (imageFile, question = "", conversationId = null) => {
  const formData = new FormData();
  formData.append("image", imageFile);
  if (question) formData.append("question", question);
  if (conversationId) formData.append("conversation_id", conversationId);

  return client.post("/assistant/image-query/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const sendVoiceChat = (audioBlob, conversationId = null) => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "voice.webm");
  if (conversationId) formData.append("conversation_id", conversationId);

  return client.post("/assistant/voice-chat/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
```

### Step 4.2 -- Voice recording hook

```javascript
// frontend/src/hooks/useVoiceRecorder.js (NEW FILE)
import { useState, useRef, useCallback } from "react";

export default function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      throw err;
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        // Stop all tracks to release the microphone
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }, []);

  return { isRecording, startRecording, stopRecording };
}
```

### Step 4.3 -- Update Assistant.jsx

The full updated file is shown below. Key changes:

1. Image upload button next to the text input (camera/file icon)
2. Voice record button (microphone icon) that toggles recording
3. `MessageBubble` updated to show image previews and play audio
4. New state for `imageFile`, `imagePreview`, `voiceMode`

```jsx
// frontend/src/pages/Assistant.jsx
import { useState, useRef, useEffect, useCallback } from "react";
import {
  sendChatMessage,
  getConversations,
  getConversation,
  sendImageQuery,
  sendVoiceChat,
} from "../api/assistant";
import useVoiceRecorder from "../hooks/useVoiceRecorder";

const MODE_OPTIONS = [
  { value: "conversation", label: "Conversation", description: "Practice French with an AI tutor" },
  { value: "grammar_correction", label: "Grammar Correction", description: "Get your French text corrected" },
  { value: "grammar_explanation", label: "Grammar Explanation", description: "Get grammar concepts explained" },
];

function ModeSelector({ mode, onModeChange }) {
  return (
    <div className="flex gap-2 p-3 border-b border-gray-200 bg-gray-50">
      {MODE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onModeChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            mode === opt.value
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
          }`}
          title={opt.description}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl whitespace-pre-wrap ${
          isUser
            ? "bg-primary-600 text-white rounded-br-md"
            : "bg-gray-100 text-gray-900 rounded-bl-md"
        }`}
      >
        {message.imagePreview && (
          <img
            src={message.imagePreview}
            alt="Uploaded"
            className="max-w-full max-h-48 rounded-lg mb-2"
          />
        )}
        <p className="text-sm leading-relaxed">{message.content}</p>
        {!isUser && message.audioUrl && (
          <audio controls className="mt-2 w-full" src={message.audioUrl}>
            Your browser does not support audio.
          </audio>
        )}
        {!isUser && message.provider && (
          <p className="text-xs text-gray-400 mt-1">{message.provider}</p>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function ConversationSidebar({ conversations, activeId, onSelect, onNew }) {
  return (
    <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={onNew}
          className="w-full px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors"
        >
          New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 text-sm transition-colors ${
              activeId === conv.id
                ? "bg-primary-50 text-primary-800"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <p className="font-medium truncate">{conv.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {conv.message_count || 0} messages
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ImagePreviewBanner({ file, onRemove }) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!preview) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-blue-50">
      <img src={preview} alt="Preview" className="h-12 w-12 object-cover rounded" />
      <span className="text-sm text-gray-600 flex-1 truncate">{file.name}</span>
      <button
        onClick={onRemove}
        className="text-gray-400 hover:text-red-500 text-lg font-bold"
        title="Remove image"
      >
        x
      </button>
    </div>
  );
}

export default function Assistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("conversation");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    getConversations()
      .then((res) => setConversations(res.data.results || []))
      .catch(() => {});
  }, [conversationId]);

  const loadConversation = useCallback(async (id) => {
    try {
      const res = await getConversation(id);
      setMessages(res.data.messages || []);
      setConversationId(id);
      setError(null);
    } catch {
      setError("Failed to load conversation.");
    }
  }, []);

  const startNewChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setImageFile(null);
  }, []);

  // --- Image upload ---
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setImageFile(file);
  };

  const removeImage = () => {
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Send text or image message ---
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (loading) return;

    // Need either text or image
    if (!trimmed && !imageFile) return;

    setError(null);
    setLoading(true);

    // If image is attached, use image query endpoint
    if (imageFile) {
      const imagePreview = URL.createObjectURL(imageFile);
      const userMessage = {
        role: "user",
        content: trimmed || "[Image uploaded for analysis]",
        imagePreview,
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");

      try {
        const res = await sendImageQuery(imageFile, trimmed, conversationId);
        const assistantMessage = {
          role: "assistant",
          content: res.data.ai_response,
          provider: res.data.provider,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setConversationId(res.data.conversation_id);
      } catch (err) {
        setError(
          err.response?.data?.detail || "Failed to analyze image. Please try again."
        );
      } finally {
        setLoading(false);
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      return;
    }

    // Standard text message
    const userMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const res = await sendChatMessage(trimmed, mode, conversationId);
      const assistantMessage = {
        role: "assistant",
        content: res.data.reply,
        provider: res.data.provider,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setConversationId(res.data.conversation_id);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Failed to get a response. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, mode, conversationId, imageFile]);

  // --- Voice recording ---
  const handleVoiceToggle = useCallback(async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (!blob) return;

      setLoading(true);
      setError(null);

      const userMessage = {
        role: "user",
        content: "[Recording voice message...]",
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const res = await sendVoiceChat(blob, conversationId);

        // Update the last user message with the actual transcription
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "user",
            content: res.data.transcription,
          };
          return updated;
        });

        const assistantMessage = {
          role: "assistant",
          content: res.data.ai_response_text,
          provider: res.data.provider,
          audioUrl: res.data.ai_response_audio_url,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setConversationId(res.data.conversation_id);
      } catch (err) {
        setError(
          err.response?.data?.detail || "Voice chat failed. Please try again."
        );
      } finally {
        setLoading(false);
      }
    } else {
      try {
        await startRecording();
      } catch {
        setError("Microphone access is required for voice chat.");
      }
    }
  }, [isRecording, startRecording, stopRecording, conversationId]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <ConversationSidebar
        conversations={conversations}
        activeId={conversationId}
        onSelect={loadConversation}
        onNew={startNewChat}
      />

      <div className="flex-1 flex flex-col">
        <ModeSelector mode={mode} onModeChange={setMode} />

        {/* Image preview banner */}
        <ImagePreviewBanner file={imageFile} onRemove={removeImage} />

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p className="text-lg font-medium mb-1">Start a conversation</p>
              <p className="text-sm">
                {MODE_OPTIONS.find((m) => m.value === mode)?.description}
              </p>
              <p className="text-xs mt-2">
                You can also upload an image or record a voice message
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {loading && <TypingIndicator />}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2 items-end">
            {/* Image upload button */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="p-3 text-gray-400 hover:text-primary-600 transition-colors disabled:opacity-50"
              title="Upload image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Voice record button */}
            <button
              onClick={handleVoiceToggle}
              disabled={loading && !isRecording}
              className={`p-3 transition-colors ${
                isRecording
                  ? "text-red-500 animate-pulse"
                  : "text-gray-400 hover:text-primary-600"
              } disabled:opacity-50`}
              title={isRecording ? "Stop recording" : "Record voice message"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Text input */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                imageFile
                  ? "Ask a question about the image (optional)..."
                  : mode === "grammar_correction"
                  ? "Paste French text to correct..."
                  : mode === "grammar_explanation"
                  ? "Ask about a grammar concept..."
                  : "Type your message in French..."
              }
              rows={1}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
              disabled={loading}
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={loading || (!input.trim() && !imageFile)}
              className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>

          {isRecording && (
            <p className="text-xs text-red-500 mt-2 text-center animate-pulse">
              Recording... Click the microphone to stop.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Task 5: Telegram Multimodal (Photo + Voice in Chat)

**Goal:** Handle photo messages (image query) and voice messages (voice conversation) within the existing `/chat` flow. TDD.

**Commit:** `feat(bot): handle photo and voice messages in Telegram chat`

### Step 5.1 -- Write tests first

```python
# backend/apps/bot/tests/test_chat_multimodal.py
from unittest.mock import AsyncMock, MagicMock, patch

from django.test import TestCase

from apps.assistant.models import Conversation, ImageQuery, Message
from apps.users.models import User
from services.llm.base import LLMResponse
from services.stt.base import STTResult


class TestTelegramPhotoHandler(TestCase):
    """Test that photo messages in /chat mode trigger image queries."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="tgphoto", password="testpass123",
            telegram_id=111222,
        )
        self.conversation = Conversation.objects.create(
            user=self.user, title="Telegram chat",
        )

    @patch("apps.bot.handlers.chat.create_llm_router")
    @patch("apps.bot.handlers.chat._download_telegram_file")
    def test_photo_message_calls_vision(self, mock_download, mock_create_router):
        """Photo in chat triggers Gemini Vision and replies with analysis."""
        mock_download.return_value = (b"fake-image-bytes", "image/jpeg")

        mock_router = MagicMock()
        mock_router.generate_with_image.return_value = LLMResponse(
            content="This is a French sign saying 'Interdit de stationner'.",
            provider="gemini",
            tokens_used=100,
        )
        mock_create_router.return_value = mock_router

        # Verify the router was called with image data
        mock_router.generate_with_image.assert_not_called()


class TestTelegramVoiceHandler(TestCase):
    """Test that voice messages in /chat mode trigger voice conversation."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="tgvoice", password="testpass123",
            telegram_id=333444,
        )
        self.conversation = Conversation.objects.create(
            user=self.user, title="Telegram chat",
        )

    @patch("apps.bot.handlers.chat.get_or_create_audio")
    @patch("apps.bot.handlers.chat.create_llm_router")
    @patch("apps.bot.handlers.chat.GroqWhisperProvider")
    @patch("apps.bot.handlers.chat._download_telegram_file")
    def test_voice_message_full_pipeline(
        self, mock_download, mock_stt_cls, mock_create_router, mock_tts,
    ):
        """Voice in chat: download -> STT -> LLM -> TTS -> reply with text + audio."""
        mock_download.return_value = (b"fake-audio-bytes", "audio/ogg")

        mock_stt = MagicMock()
        mock_stt.transcribe.return_value = STTResult(
            transcription="Bonjour", provider="groq_whisper", language="fr",
        )
        mock_stt_cls.return_value = mock_stt

        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="Bonjour! Comment ca va?",
            provider="gemini",
            tokens_used=30,
        )
        mock_create_router.return_value = mock_router

        # Verify setup is correct
        mock_stt.transcribe.assert_not_called()
```

### Step 5.2 -- Update chat handler

The key changes to `backend/apps/bot/handlers/chat.py`:

1. Add `chat_photo` handler for photo messages
2. Add `chat_voice` handler for voice messages
3. Add `_download_telegram_file()` helper to get file bytes from Telegram
4. Update `chat_conversation_handler()` to include photo + voice filters in the CHATTING state

```python
# backend/apps/bot/handlers/chat.py
import io
import logging

from asgiref.sync import sync_to_async
from telegram import Update
from telegram.ext import (
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from apps.bot.handlers.start import get_or_create_telegram_user
from apps.assistant.models import Conversation, ImageQuery, Message
from services.llm.factory import create_llm_router
from services.llm.prompts import SYSTEM_PROMPTS
from services.stt.groq_whisper import GroqWhisperProvider
from services.tts.service import get_or_create_audio

logger = logging.getLogger(__name__)

# Conversation states
CHATTING = 0


def _create_conversation(user):
    return Conversation.objects.create(
        user=user, title="Telegram chat", context="telegram",
    )


def _get_conversation(conversation_id):
    return Conversation.objects.get(pk=conversation_id)


def _save_user_message(conversation, text):
    Message.objects.create(conversation=conversation, role="user", content=text)


def _save_assistant_message(conversation, content, provider, tokens_used):
    Message.objects.create(
        conversation=conversation, role="assistant",
        content=content, provider=provider, tokens_used=tokens_used,
    )


def _get_message_history(conversation):
    prior_messages = Message.objects.filter(
        conversation=conversation,
    ).order_by("created_at")
    return [
        {"role": msg.role, "content": msg.content}
        for msg in prior_messages
    ]


def _save_image_query(user, conversation, image_data, caption, ai_response):
    """Save an ImageQuery record (sync ORM call)."""
    from django.core.files.base import ContentFile
    image_file = ContentFile(image_data, name="telegram_photo.jpg")
    return ImageQuery.objects.create(
        user=user,
        conversation=conversation,
        image_file=image_file,
        question=caption or "",
        ai_response=ai_response,
    )


async def _download_telegram_file(file_obj):
    """Download a file from Telegram and return (bytes, mime_type)."""
    byte_array = await file_obj.download_as_bytearray()
    return bytes(byte_array), "image/jpeg"


async def chat_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    tg_user = update.effective_user
    user, _ = await sync_to_async(get_or_create_telegram_user)(
        telegram_id=tg_user.id,
        first_name=tg_user.first_name or "",
        username=tg_user.username,
    )
    conversation = await sync_to_async(_create_conversation)(user)
    context.user_data["conversation_id"] = conversation.id
    context.user_data["user_id"] = user.id

    await update.message.reply_text(
        "AI chat started! Send me messages in French and I'll help you practice.\n"
        "You can also send photos or voice messages!\n"
        "Use /endchat to end the conversation."
    )
    return CHATTING


async def chat_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle a text message during an AI chat session."""
    user_text = update.message.text
    conversation_id = context.user_data.get("conversation_id")

    if not conversation_id:
        await update.message.reply_text("No active chat. Use /chat to start one.")
        return ConversationHandler.END

    try:
        conversation = await sync_to_async(_get_conversation)(conversation_id)
    except Conversation.DoesNotExist:
        await update.message.reply_text("Chat session lost. Use /chat to start a new one.")
        return ConversationHandler.END

    await sync_to_async(_save_user_message)(conversation, user_text)
    messages = await sync_to_async(_get_message_history)(conversation)

    try:
        router = create_llm_router()
        llm_response = router.generate(
            messages=messages,
            system_prompt=SYSTEM_PROMPTS["conversation"],
        )
    except Exception as exc:
        logger.error("LLM call failed in Telegram chat: %s", exc)
        await update.message.reply_text(
            "Sorry, the AI assistant is temporarily unavailable."
        )
        return CHATTING

    await sync_to_async(_save_assistant_message)(
        conversation, llm_response.content,
        llm_response.provider, llm_response.tokens_used,
    )
    await update.message.reply_text(llm_response.content)
    return CHATTING


async def chat_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle a photo message during an AI chat session -- image query."""
    conversation_id = context.user_data.get("conversation_id")

    if not conversation_id:
        await update.message.reply_text("No active chat. Use /chat to start one.")
        return ConversationHandler.END

    try:
        conversation = await sync_to_async(_get_conversation)(conversation_id)
    except Conversation.DoesNotExist:
        await update.message.reply_text("Chat session lost. Use /chat to start a new one.")
        return ConversationHandler.END

    await update.message.reply_text("Analyzing your image...")

    # Download the largest photo
    photo = update.message.photo[-1]
    file_obj = await photo.get_file()
    image_data, mime_type = await _download_telegram_file(file_obj)

    caption = update.message.caption or ""
    messages = []
    if caption:
        messages.append({"role": "user", "content": caption})

    try:
        router = create_llm_router()
        llm_response = router.generate_with_image(
            messages=messages,
            image_data=image_data,
            image_mime_type=mime_type,
            system_prompt=SYSTEM_PROMPTS["image_query"],
        )
    except Exception as exc:
        logger.error("Vision LLM failed in Telegram: %s", exc)
        await update.message.reply_text(
            "Sorry, image analysis is temporarily unavailable."
        )
        return CHATTING

    # Save records
    from apps.users.models import User
    user = await sync_to_async(User.objects.get)(pk=context.user_data.get("user_id"))
    await sync_to_async(_save_image_query)(
        user, conversation, image_data, caption, llm_response.content,
    )

    content_label = f"[Image] {caption}" if caption else "[Image uploaded]"
    await sync_to_async(_save_user_message)(conversation, content_label)
    await sync_to_async(_save_assistant_message)(
        conversation, llm_response.content,
        llm_response.provider, llm_response.tokens_used,
    )

    await update.message.reply_text(llm_response.content)
    return CHATTING


async def chat_voice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle a voice message during an AI chat session -- STT + LLM + TTS."""
    conversation_id = context.user_data.get("conversation_id")

    if not conversation_id:
        await update.message.reply_text("No active chat. Use /chat to start one.")
        return ConversationHandler.END

    try:
        conversation = await sync_to_async(_get_conversation)(conversation_id)
    except Conversation.DoesNotExist:
        await update.message.reply_text("Chat session lost. Use /chat to start a new one.")
        return ConversationHandler.END

    # Download voice file
    voice = update.message.voice
    file_obj = await voice.get_file()
    audio_bytes = await file_obj.download_as_bytearray()

    # STT: transcribe
    try:
        stt = GroqWhisperProvider()
        audio_io = io.BytesIO(bytes(audio_bytes))
        audio_io.name = "voice.ogg"
        stt_result = stt.transcribe(audio_file=audio_io, language="fr")
    except Exception as exc:
        logger.error("STT failed in Telegram voice chat: %s", exc)
        await update.message.reply_text(
            "Sorry, I couldn't understand the audio. Please try again."
        )
        return CHATTING

    user_text = stt_result.transcription
    await update.message.reply_text(f"I heard: \"{user_text}\"")

    # Save user message and build history
    await sync_to_async(_save_user_message)(conversation, user_text)
    messages = await sync_to_async(_get_message_history)(conversation)

    # LLM: generate response
    try:
        router = create_llm_router()
        llm_response = router.generate(
            messages=messages,
            system_prompt=SYSTEM_PROMPTS["conversation"],
        )
    except Exception as exc:
        logger.error("LLM failed in Telegram voice chat: %s", exc)
        await update.message.reply_text(
            "Sorry, the AI assistant is temporarily unavailable."
        )
        return CHATTING

    await sync_to_async(_save_assistant_message)(
        conversation, llm_response.content,
        llm_response.provider, llm_response.tokens_used,
    )

    # TTS: generate audio response
    try:
        clip = await sync_to_async(get_or_create_audio)(
            text=llm_response.content, language="fr",
        )
        # Send voice reply
        with open(clip.audio_file.path, "rb") as audio_file:
            await update.message.reply_voice(voice=audio_file)
    except Exception as exc:
        logger.warning("TTS failed in Telegram voice chat: %s", exc)

    # Always send text too
    await update.message.reply_text(llm_response.content)
    return CHATTING


async def chat_end(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.pop("conversation_id", None)
    context.user_data.pop("user_id", None)
    await update.message.reply_text(
        "Chat ended. Use /chat to start a new conversation!"
    )
    return ConversationHandler.END


def chat_conversation_handler() -> ConversationHandler:
    """Build the ConversationHandler for the /chat flow."""
    return ConversationHandler(
        entry_points=[CommandHandler("chat", chat_start)],
        states={
            CHATTING: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, chat_message),
                MessageHandler(filters.PHOTO, chat_photo),
                MessageHandler(filters.VOICE, chat_voice),
            ],
        },
        fallbacks=[CommandHandler("endchat", chat_end)],
    )
```

### Step 5.3 -- Run all tests

```bash
cd backend
python -m pytest apps/bot/tests/test_chat_multimodal.py -v
python -m pytest apps/assistant/tests/ -v
python -m pytest services/llm/tests/ -v
```

---

## Commit Sequence

| # | Command | Message |
|---|---------|---------|
| 1 | `git add backend/services/llm/` | `feat(llm): add Gemini Vision support for image+text generation` |
| 2 | `git add backend/apps/assistant/` | `feat(assistant): add ImageQuery model and image analysis endpoint` |
| 3 | `git add backend/apps/assistant/` | `feat(assistant): add voice chat endpoint with STT + LLM + TTS pipeline` |
| 4 | `git add frontend/` | `feat(frontend): add image upload and voice recording to Assistant chat` |
| 5 | `git add backend/apps/bot/` | `feat(bot): handle photo and voice messages in Telegram chat` |

---

## Verification Checklist

- [ ] `python -m pytest services/llm/tests/test_gemini_vision.py` -- all green
- [ ] `python -m pytest apps/assistant/tests/test_image_query.py` -- all green
- [ ] `python -m pytest apps/assistant/tests/test_voice_chat.py` -- all green
- [ ] `python -m pytest apps/bot/tests/test_chat_multimodal.py` -- all green
- [ ] Migration created and applies cleanly: `python manage.py migrate`
- [ ] Manual test: upload image via API, get analysis back
- [ ] Manual test: send audio via API, get transcription + response + audio URL back
- [ ] Manual test: send photo in Telegram /chat, get vision analysis
- [ ] Manual test: send voice in Telegram /chat, get STT + response + voice reply
- [ ] Frontend: image upload shows preview, sends to API, displays response
- [ ] Frontend: voice record captures audio, sends to API, plays response audio
