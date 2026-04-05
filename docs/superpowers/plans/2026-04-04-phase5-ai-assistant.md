# Phase 5: AI Assistant — Implementation Plan

**Date:** 2026-04-04
**Depends on:** Phases 1-4 (User model, Content models, Practice app, Telegram bot)
**Delivers:** LLM-powered chat, writing correction, grammar explanation via API + Telegram + React

---

## Task 1: LLM Service Layer

**Goal:** Create `backend/services/llm/` with abstract base, Gemini provider, Groq provider, and a router that tries Gemini first and falls back to Groq.

**Why first:** Every other task in this phase depends on the LLM service. Nothing calls an API until this exists and is tested.

### Step 1.1 — Add dependencies

**File:** `backend/requirements.txt`

Append:

```
google-generativeai>=0.8.0,<1.0
groq>=0.11.0,<1.0
```

**Commit:** `chore: add google-generativeai and groq dependencies`

### Step 1.2 — Add LLM settings

**File:** `backend/config/settings/base.py`

Add at the bottom:

```python
# LLM Providers
GEMINI_API_KEY = config("GEMINI_API_KEY", default="")
GEMINI_MODEL = config("GEMINI_MODEL", default="gemini-2.0-flash")

GROQ_API_KEY = config("GROQ_API_KEY", default="")
GROQ_MODEL = config("GROQ_MODEL", default="llama-3.3-70b-versatile")
```

No commit yet — bundle with next step.

### Step 1.3 — Write tests for the service layer (RED)

Create test file first. No Django models involved here — these are pure Python service tests.

**File:** `backend/services/__init__.py` (empty)
**File:** `backend/services/llm/__init__.py` (empty)
**File:** `backend/services/llm/tests/__init__.py` (empty)
**File:** `backend/services/llm/tests/test_providers.py`

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.llm.base import BaseProvider, LLMResponse
from services.llm.gemini import GeminiProvider
from services.llm.groq import GroqProvider
from services.llm.router import ProviderRouter


class TestLLMResponse:
    def test_llm_response_fields(self):
        resp = LLMResponse(
            content="Bonjour!",
            provider="gemini",
            tokens_used=42,
        )
        assert resp.content == "Bonjour!"
        assert resp.provider == "gemini"
        assert resp.tokens_used == 42


class TestBaseProvider:
    def test_cannot_instantiate_abstract(self):
        with pytest.raises(TypeError):
            BaseProvider(api_key="key", model="model")


class TestGeminiProvider:
    @patch("services.llm.gemini.genai")
    def test_generate_success(self, mock_genai):
        # Set up the mock chain
        mock_model = MagicMock()
        mock_genai.GenerativeModel.return_value = mock_model

        mock_response = MagicMock()
        mock_response.text = "Bonjour, comment allez-vous?"
        mock_response.usage_metadata.total_token_count = 25
        mock_model.generate_content.return_value = mock_response

        provider = GeminiProvider(api_key="fake-key", model="gemini-2.0-flash")
        result = provider.generate(
            messages=[{"role": "user", "content": "Hello"}],
            system_prompt="You are a French tutor.",
        )

        assert result.content == "Bonjour, comment allez-vous?"
        assert result.provider == "gemini"
        assert result.tokens_used == 25
        mock_genai.configure.assert_called_once_with(api_key="fake-key")

    @patch("services.llm.gemini.genai")
    def test_generate_raises_on_api_error(self, mock_genai):
        mock_model = MagicMock()
        mock_genai.GenerativeModel.return_value = mock_model
        mock_model.generate_content.side_effect = Exception("Rate limit exceeded")

        provider = GeminiProvider(api_key="fake-key", model="gemini-2.0-flash")
        with pytest.raises(Exception, match="Rate limit exceeded"):
            provider.generate(
                messages=[{"role": "user", "content": "Hello"}],
                system_prompt="You are a French tutor.",
            )


class TestGroqProvider:
    @patch("services.llm.groq_provider.Groq")
    def test_generate_success(self, MockGroq):
        mock_client = MagicMock()
        MockGroq.return_value = mock_client

        mock_choice = MagicMock()
        mock_choice.message.content = "Voici la correction."
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage.total_tokens = 30
        mock_client.chat.completions.create.return_value = mock_response

        provider = GroqProvider(api_key="fake-key", model="llama-3.3-70b-versatile")
        result = provider.generate(
            messages=[{"role": "user", "content": "Correct this"}],
            system_prompt="You are a grammar corrector.",
        )

        assert result.content == "Voici la correction."
        assert result.provider == "groq"
        assert result.tokens_used == 30

    @patch("services.llm.groq_provider.Groq")
    def test_generate_raises_on_api_error(self, MockGroq):
        mock_client = MagicMock()
        MockGroq.return_value = mock_client
        mock_client.chat.completions.create.side_effect = Exception("Service unavailable")

        provider = GroqProvider(api_key="fake-key", model="llama-3.3-70b-versatile")
        with pytest.raises(Exception, match="Service unavailable"):
            provider.generate(
                messages=[{"role": "user", "content": "Hello"}],
                system_prompt="Tutor prompt.",
            )


class TestProviderRouter:
    def test_generate_uses_primary(self):
        primary = MagicMock()
        primary.generate.return_value = LLMResponse(
            content="From primary", provider="gemini", tokens_used=10,
        )
        fallback = MagicMock()

        router = ProviderRouter(primary=primary, fallback=fallback)
        result = router.generate(
            messages=[{"role": "user", "content": "Hi"}],
            system_prompt="Prompt.",
        )

        assert result.content == "From primary"
        assert result.provider == "gemini"
        primary.generate.assert_called_once()
        fallback.generate.assert_not_called()

    def test_generate_falls_back_on_primary_error(self):
        primary = MagicMock()
        primary.generate.side_effect = Exception("Rate limit")
        fallback = MagicMock()
        fallback.generate.return_value = LLMResponse(
            content="From fallback", provider="groq", tokens_used=20,
        )

        router = ProviderRouter(primary=primary, fallback=fallback)
        result = router.generate(
            messages=[{"role": "user", "content": "Hi"}],
            system_prompt="Prompt.",
        )

        assert result.content == "From fallback"
        assert result.provider == "groq"
        primary.generate.assert_called_once()
        fallback.generate.assert_called_once()

    def test_generate_raises_when_both_fail(self):
        primary = MagicMock()
        primary.generate.side_effect = Exception("Primary down")
        fallback = MagicMock()
        fallback.generate.side_effect = Exception("Fallback down")

        router = ProviderRouter(primary=primary, fallback=fallback)
        with pytest.raises(Exception, match="Fallback down"):
            router.generate(
                messages=[{"role": "user", "content": "Hi"}],
                system_prompt="Prompt.",
            )

    def test_generate_works_without_fallback(self):
        primary = MagicMock()
        primary.generate.return_value = LLMResponse(
            content="Solo", provider="gemini", tokens_used=5,
        )

        router = ProviderRouter(primary=primary, fallback=None)
        result = router.generate(
            messages=[{"role": "user", "content": "Hi"}],
            system_prompt="Prompt.",
        )

        assert result.content == "Solo"

    def test_raises_when_no_fallback_and_primary_fails(self):
        primary = MagicMock()
        primary.generate.side_effect = Exception("Down")

        router = ProviderRouter(primary=primary, fallback=None)
        with pytest.raises(Exception, match="Down"):
            router.generate(
                messages=[{"role": "user", "content": "Hi"}],
                system_prompt="Prompt.",
            )
```

Run tests — they should all **fail** (modules don't exist yet):

```bash
cd backend && python -m pytest services/llm/tests/test_providers.py -v
```

### Step 1.4 — Implement the service layer (GREEN)

**File:** `backend/services/llm/base.py`

```python
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
```

**File:** `backend/services/llm/gemini.py`

```python
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
```

**File:** `backend/services/llm/groq_provider.py`

```python
import logging

from groq import Groq

from .base import BaseProvider, LLMResponse

logger = logging.getLogger(__name__)


class GroqProvider(BaseProvider):
    """Groq LLM provider (Llama models)."""

    def __init__(self, api_key: str, model: str):
        super().__init__(api_key, model)
        self.client = Groq(api_key=api_key)

    def generate(
        self,
        messages: list[dict],
        system_prompt: str,
    ) -> LLMResponse:
        # Prepend system message
        all_messages = [{"role": "system", "content": system_prompt}]
        all_messages.extend(messages)

        response = self.client.chat.completions.create(
            model=self.model,
            messages=all_messages,
        )

        content = response.choices[0].message.content
        tokens_used = getattr(response.usage, "total_tokens", 0)

        logger.info(
            "Groq response: model=%s, tokens=%d", self.model, tokens_used,
        )

        return LLMResponse(
            content=content,
            provider="groq",
            tokens_used=tokens_used,
        )
```

**File:** `backend/services/llm/router.py`

```python
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
```

**File:** `backend/services/llm/__init__.py`

```python
from .base import BaseProvider, LLMResponse
from .gemini import GeminiProvider
from .groq_provider import GroqProvider
from .router import ProviderRouter

__all__ = [
    "BaseProvider",
    "LLMResponse",
    "GeminiProvider",
    "GroqProvider",
    "ProviderRouter",
]
```

### Step 1.5 — System prompts

**File:** `backend/services/llm/prompts.py`

```python
SYSTEM_PROMPTS = {
    "conversation": (
        "You are a patient French tutor. Respond in French at B1-B2 level. "
        "When the student makes errors, gently correct them and explain. "
        "Keep responses concise (2-4 sentences). Use simple vocabulary."
    ),
    "grammar_correction": (
        "Correct the following French text. List each error, explain why "
        "it's wrong, and provide the corrected version. Format:\n"
        "- Error: [original] -> [corrected] — [explanation]\n"
        "End with the fully corrected text."
    ),
    "grammar_explanation": (
        "Explain the following French grammar concept clearly and simply, "
        "with examples. Target B1-B2 level learners. Use both French "
        "examples and English translations. Keep it under 200 words."
    ),
}
```

### Step 1.6 — Factory function for creating the router from Django settings

**File:** `backend/services/llm/factory.py`

```python
from django.conf import settings

from .gemini import GeminiProvider
from .groq_provider import GroqProvider
from .router import ProviderRouter


def create_llm_router() -> ProviderRouter:
    """Create a ProviderRouter from Django settings.

    Uses Gemini as primary and Groq as fallback.
    If only one API key is configured, that provider is used alone.
    """
    primary = None
    fallback = None

    if settings.GEMINI_API_KEY:
        primary = GeminiProvider(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_MODEL,
        )

    if settings.GROQ_API_KEY:
        fallback = GroqProvider(
            api_key=settings.GROQ_API_KEY,
            model=settings.GROQ_MODEL,
        )

    # If no Gemini key, promote Groq to primary
    if primary is None and fallback is not None:
        primary = fallback
        fallback = None

    if primary is None:
        raise RuntimeError(
            "No LLM API keys configured. Set GEMINI_API_KEY or GROQ_API_KEY."
        )

    return ProviderRouter(primary=primary, fallback=fallback)
```

### Step 1.7 — Run tests (GREEN)

```bash
cd backend && python -m pytest services/llm/tests/test_providers.py -v
```

All 10 tests should pass.

**Commit:** `feat: add LLM service layer with Gemini/Groq providers and fallback router`

---

## Task 2: Assistant Models

**Goal:** Create `apps/assistant/` Django app with `Conversation` and `Message` models, admin, and TDD.

### Step 2.1 — Scaffold the app

```bash
cd backend && mkdir -p apps/assistant/tests
touch apps/assistant/__init__.py
touch apps/assistant/models.py
touch apps/assistant/admin.py
touch apps/assistant/apps.py
touch apps/assistant/urls.py
touch apps/assistant/views.py
touch apps/assistant/serializers.py
touch apps/assistant/tests/__init__.py
touch apps/assistant/tests/test_models.py
touch apps/assistant/tests/test_serializers.py
touch apps/assistant/tests/test_views.py
```

**File:** `backend/apps/assistant/apps.py`

```python
from django.apps import AppConfig


class AssistantConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.assistant"
    verbose_name = "AI Assistant"
```

Add `"apps.assistant"` to `INSTALLED_APPS` in `backend/config/settings/base.py`.

### Step 2.2 — Write model tests (RED)

**File:** `backend/apps/assistant/tests/test_models.py`

```python
import pytest
from django.contrib.auth import get_user_model
from apps.assistant.models import Conversation, Message

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="aiuser", email="ai@example.com", password="testpass123!",
    )


@pytest.fixture
def conversation(user):
    return Conversation.objects.create(
        user=user,
        title="French practice",
    )


@pytest.mark.django_db
class TestConversation:
    def test_create_conversation(self, user):
        conv = Conversation.objects.create(user=user, title="Test chat")
        assert conv.id is not None
        assert conv.user == user
        assert conv.title == "Test chat"
        assert conv.context is None
        assert conv.created_at is not None

    def test_create_conversation_with_context(self, user):
        conv = Conversation.objects.create(
            user=user, title="Lesson chat", context="lesson:42",
        )
        assert conv.context == "lesson:42"

    def test_conversation_str(self, conversation):
        assert str(conversation) == "French practice"

    def test_conversation_ordering(self, user):
        c1 = Conversation.objects.create(user=user, title="First")
        c2 = Conversation.objects.create(user=user, title="Second")
        convos = list(Conversation.objects.filter(user=user))
        # Most recent first
        assert convos[0] == c2
        assert convos[1] == c1

    def test_conversation_user_cascade(self, user, conversation):
        user.delete()
        assert Conversation.objects.count() == 0


@pytest.mark.django_db
class TestMessage:
    def test_create_user_message(self, conversation):
        msg = Message.objects.create(
            conversation=conversation,
            role="user",
            content="Bonjour!",
        )
        assert msg.id is not None
        assert msg.role == "user"
        assert msg.content == "Bonjour!"
        assert msg.provider is None
        assert msg.tokens_used == 0
        assert msg.created_at is not None

    def test_create_assistant_message(self, conversation):
        msg = Message.objects.create(
            conversation=conversation,
            role="assistant",
            content="Bonjour! Comment allez-vous?",
            provider="gemini",
            tokens_used=25,
        )
        assert msg.role == "assistant"
        assert msg.provider == "gemini"
        assert msg.tokens_used == 25

    def test_message_str(self, conversation):
        msg = Message.objects.create(
            conversation=conversation, role="user", content="Salut!",
        )
        assert "user" in str(msg)

    def test_message_ordering(self, conversation):
        m1 = Message.objects.create(
            conversation=conversation, role="user", content="First",
        )
        m2 = Message.objects.create(
            conversation=conversation, role="assistant", content="Second",
        )
        msgs = list(Message.objects.filter(conversation=conversation))
        # Chronological order (oldest first)
        assert msgs[0] == m1
        assert msgs[1] == m2

    def test_message_conversation_cascade(self, conversation):
        Message.objects.create(
            conversation=conversation, role="user", content="Test",
        )
        conversation.delete()
        assert Message.objects.count() == 0

    def test_role_choices_enforced(self, conversation):
        # Valid roles should work
        for role in ("user", "assistant"):
            msg = Message.objects.create(
                conversation=conversation, role=role, content="test",
            )
            assert msg.role == role
```

Run tests — should **fail**:

```bash
cd backend && python -m pytest apps/assistant/tests/test_models.py -v
```

### Step 2.3 — Implement models (GREEN)

**File:** `backend/apps/assistant/models.py`

```python
from django.conf import settings
from django.db import models


class Conversation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations",
    )
    title = models.CharField(max_length=300)
    context = models.CharField(max_length=200, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assistant_conversations"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Message(models.Model):
    ROLE_CHOICES = [
        ("user", "User"),
        ("assistant", "Assistant"),
    ]

    PROVIDER_CHOICES = [
        ("gemini", "Google Gemini"),
        ("groq", "Groq"),
    ]

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    provider = models.CharField(
        max_length=10, choices=PROVIDER_CHOICES, null=True, blank=True,
    )
    tokens_used = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assistant_messages"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"
```

### Step 2.4 — Create migration and run tests

```bash
cd backend && python manage.py makemigrations assistant
cd backend && python -m pytest apps/assistant/tests/test_models.py -v
```

All model tests should pass.

### Step 2.5 — Admin

**File:** `backend/apps/assistant/admin.py`

```python
from django.contrib import admin
from .models import Conversation, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ("role", "content", "provider", "tokens_used", "created_at")


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "context", "created_at")
    list_filter = ("created_at",)
    search_fields = ("title", "user__username")
    inlines = [MessageInline]
    readonly_fields = ("created_at",)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("conversation", "role", "provider", "tokens_used", "created_at")
    list_filter = ("role", "provider")
    search_fields = ("content",)
    readonly_fields = ("created_at",)
```

**Commit:** `feat: add Conversation and Message models for AI assistant`

---

## Task 3: Assistant Serializers & Views

**Goal:** Chat endpoint, conversation list, conversation detail. TDD with mocked LLM.

### Step 3.1 — Write serializer tests (RED)

**File:** `backend/apps/assistant/tests/test_serializers.py`

```python
import pytest
from django.contrib.auth import get_user_model
from apps.assistant.models import Conversation, Message
from apps.assistant.serializers import (
    ChatRequestSerializer,
    MessageSerializer,
    ConversationListSerializer,
    ConversationDetailSerializer,
)

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="seruser", email="ser@example.com", password="testpass123!",
    )


@pytest.fixture
def conversation(user):
    return Conversation.objects.create(user=user, title="Test")


@pytest.mark.django_db
class TestChatRequestSerializer:
    def test_valid_conversation_mode(self):
        data = {"message": "Bonjour!", "mode": "conversation"}
        ser = ChatRequestSerializer(data=data)
        assert ser.is_valid(), ser.errors

    def test_valid_grammar_correction_mode(self):
        data = {"message": "Je suis alle au magasin", "mode": "grammar_correction"}
        ser = ChatRequestSerializer(data=data)
        assert ser.is_valid(), ser.errors

    def test_valid_grammar_explanation_mode(self):
        data = {"message": "Explain passe compose", "mode": "grammar_explanation"}
        ser = ChatRequestSerializer(data=data)
        assert ser.is_valid(), ser.errors

    def test_with_conversation_id(self, conversation):
        data = {
            "message": "Continue",
            "mode": "conversation",
            "conversation_id": conversation.id,
        }
        ser = ChatRequestSerializer(data=data)
        assert ser.is_valid(), ser.errors

    def test_invalid_mode(self):
        data = {"message": "Hi", "mode": "invalid"}
        ser = ChatRequestSerializer(data=data)
        assert not ser.is_valid()

    def test_empty_message(self):
        data = {"message": "", "mode": "conversation"}
        ser = ChatRequestSerializer(data=data)
        assert not ser.is_valid()

    def test_missing_message(self):
        data = {"mode": "conversation"}
        ser = ChatRequestSerializer(data=data)
        assert not ser.is_valid()

    def test_default_mode_is_conversation(self):
        data = {"message": "Bonjour!"}
        ser = ChatRequestSerializer(data=data)
        assert ser.is_valid(), ser.errors
        assert ser.validated_data["mode"] == "conversation"


@pytest.mark.django_db
class TestMessageSerializer:
    def test_serializes_message(self, conversation):
        msg = Message.objects.create(
            conversation=conversation, role="assistant",
            content="Bonjour!", provider="gemini", tokens_used=10,
        )
        data = MessageSerializer(msg).data
        assert data["role"] == "assistant"
        assert data["content"] == "Bonjour!"
        assert data["provider"] == "gemini"
        assert data["tokens_used"] == 10
        assert "created_at" in data
        assert "id" in data


@pytest.mark.django_db
class TestConversationListSerializer:
    def test_serializes_list(self, conversation):
        data = ConversationListSerializer(conversation).data
        assert data["id"] == conversation.id
        assert data["title"] == "Test"
        assert "created_at" in data
        assert "message_count" in data
        assert data["message_count"] == 0

    def test_message_count(self, conversation):
        Message.objects.create(
            conversation=conversation, role="user", content="Hi",
        )
        Message.objects.create(
            conversation=conversation, role="assistant", content="Hello",
        )
        # Must annotate for message_count — test via view or manual annotation
        from django.db.models import Count
        conv = Conversation.objects.annotate(
            message_count=Count("messages"),
        ).get(pk=conversation.pk)
        data = ConversationListSerializer(conv).data
        assert data["message_count"] == 2


@pytest.mark.django_db
class TestConversationDetailSerializer:
    def test_includes_messages(self, conversation):
        Message.objects.create(
            conversation=conversation, role="user", content="Bonjour",
        )
        Message.objects.create(
            conversation=conversation, role="assistant", content="Salut!",
            provider="gemini", tokens_used=15,
        )
        data = ConversationDetailSerializer(conversation).data
        assert data["id"] == conversation.id
        assert data["title"] == "Test"
        assert len(data["messages"]) == 2
        assert data["messages"][0]["role"] == "user"
        assert data["messages"][1]["role"] == "assistant"
```

### Step 3.2 — Implement serializers (GREEN)

**File:** `backend/apps/assistant/serializers.py`

```python
from rest_framework import serializers
from .models import Conversation, Message


class ChatRequestSerializer(serializers.Serializer):
    MODE_CHOICES = [
        ("conversation", "Conversation"),
        ("grammar_correction", "Grammar Correction"),
        ("grammar_explanation", "Grammar Explanation"),
    ]

    message = serializers.CharField(min_length=1)
    mode = serializers.ChoiceField(choices=MODE_CHOICES, default="conversation")
    conversation_id = serializers.IntegerField(required=False, allow_null=True)


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ("id", "role", "content", "provider", "tokens_used", "created_at")


class ConversationListSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Conversation
        fields = ("id", "title", "context", "created_at", "message_count")


class ConversationDetailSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ("id", "title", "context", "created_at", "messages")
```

Run serializer tests:

```bash
cd backend && python -m pytest apps/assistant/tests/test_serializers.py -v
```

### Step 3.3 — Write view tests (RED)

**File:** `backend/apps/assistant/tests/test_views.py`

```python
import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.assistant.models import Conversation, Message
from services.llm.base import LLMResponse

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="chatuser", email="chat@example.com", password="testpass123!",
    )


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def conversation(user):
    return Conversation.objects.create(user=user, title="Existing chat")


@pytest.fixture
def mock_llm_response():
    return LLMResponse(
        content="Bonjour! Comment allez-vous?",
        provider="gemini",
        tokens_used=25,
    )


@pytest.mark.django_db
class TestChatView:
    @patch("apps.assistant.views.create_llm_router")
    def test_chat_creates_new_conversation(
        self, mock_factory, authenticated_client, mock_llm_response,
    ):
        mock_router = MagicMock()
        mock_router.generate.return_value = mock_llm_response
        mock_factory.return_value = mock_router

        response = authenticated_client.post(
            "/api/assistant/chat/",
            {"message": "Bonjour!", "mode": "conversation"},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["reply"] == "Bonjour! Comment allez-vous?"
        assert response.data["provider"] == "gemini"
        assert response.data["tokens_used"] == 25
        assert "conversation_id" in response.data
        assert Conversation.objects.count() == 1
        assert Message.objects.count() == 2  # user + assistant

    @patch("apps.assistant.views.create_llm_router")
    def test_chat_continues_existing_conversation(
        self, mock_factory, authenticated_client, conversation, mock_llm_response,
    ):
        # Add prior messages
        Message.objects.create(
            conversation=conversation, role="user", content="Salut!",
        )
        Message.objects.create(
            conversation=conversation, role="assistant", content="Salut!",
            provider="gemini", tokens_used=10,
        )

        mock_router = MagicMock()
        mock_router.generate.return_value = mock_llm_response
        mock_factory.return_value = mock_router

        response = authenticated_client.post(
            "/api/assistant/chat/",
            {
                "message": "Comment vas-tu?",
                "mode": "conversation",
                "conversation_id": conversation.id,
            },
            format="json",
        )

        assert response.status_code == 200
        assert response.data["conversation_id"] == conversation.id
        # 2 prior + 2 new = 4 messages
        assert Message.objects.filter(conversation=conversation).count() == 4
        # Should pass prior messages to the LLM
        call_args = mock_router.generate.call_args
        messages = call_args[1]["messages"] if "messages" in call_args[1] else call_args[0][0]
        assert len(messages) == 3  # 2 prior + 1 new user message

    @patch("apps.assistant.views.create_llm_router")
    def test_chat_grammar_correction_mode(
        self, mock_factory, authenticated_client,
    ):
        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="Corrected text here.", provider="groq", tokens_used=30,
        )
        mock_factory.return_value = mock_router

        response = authenticated_client.post(
            "/api/assistant/chat/",
            {"message": "Je suis alle au magasin", "mode": "grammar_correction"},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["reply"] == "Corrected text here."
        # Should use grammar_correction system prompt
        call_args = mock_router.generate.call_args
        system_prompt = call_args[1]["system_prompt"] if "system_prompt" in call_args[1] else call_args[0][1]
        assert "correct" in system_prompt.lower() or "Correct" in system_prompt

    @patch("apps.assistant.views.create_llm_router")
    def test_chat_llm_error_returns_503(
        self, mock_factory, authenticated_client,
    ):
        mock_router = MagicMock()
        mock_router.generate.side_effect = Exception("All providers failed")
        mock_factory.return_value = mock_router

        response = authenticated_client.post(
            "/api/assistant/chat/",
            {"message": "Bonjour!", "mode": "conversation"},
            format="json",
        )

        assert response.status_code == 503
        assert "error" in response.data or "detail" in response.data

    def test_chat_unauthenticated(self, api_client):
        response = api_client.post(
            "/api/assistant/chat/",
            {"message": "Bonjour!", "mode": "conversation"},
            format="json",
        )
        assert response.status_code == 401

    @patch("apps.assistant.views.create_llm_router")
    def test_chat_invalid_conversation_id(
        self, mock_factory, authenticated_client,
    ):
        response = authenticated_client.post(
            "/api/assistant/chat/",
            {
                "message": "Hi",
                "mode": "conversation",
                "conversation_id": 99999,
            },
            format="json",
        )
        assert response.status_code == 404

    @patch("apps.assistant.views.create_llm_router")
    def test_chat_other_users_conversation(
        self, mock_factory, authenticated_client,
    ):
        other_user = User.objects.create_user(
            username="other", email="other@example.com", password="testpass123!",
        )
        other_conv = Conversation.objects.create(
            user=other_user, title="Private",
        )
        response = authenticated_client.post(
            "/api/assistant/chat/",
            {
                "message": "Hi",
                "mode": "conversation",
                "conversation_id": other_conv.id,
            },
            format="json",
        )
        assert response.status_code == 404


@pytest.mark.django_db
class TestConversationListView:
    def test_list_conversations(self, authenticated_client, user):
        Conversation.objects.create(user=user, title="Chat 1")
        Conversation.objects.create(user=user, title="Chat 2")

        response = authenticated_client.get("/api/assistant/conversations/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 2

    def test_list_only_own_conversations(self, authenticated_client, user):
        Conversation.objects.create(user=user, title="My chat")
        other_user = User.objects.create_user(
            username="other2", email="other2@example.com", password="testpass123!",
        )
        Conversation.objects.create(user=other_user, title="Their chat")

        response = authenticated_client.get("/api/assistant/conversations/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["title"] == "My chat"

    def test_list_unauthenticated(self, api_client):
        response = api_client.get("/api/assistant/conversations/")
        assert response.status_code == 401


@pytest.mark.django_db
class TestConversationDetailView:
    def test_get_conversation_with_messages(self, authenticated_client, conversation):
        Message.objects.create(
            conversation=conversation, role="user", content="Bonjour",
        )
        Message.objects.create(
            conversation=conversation, role="assistant", content="Salut!",
            provider="gemini", tokens_used=10,
        )

        response = authenticated_client.get(
            f"/api/assistant/conversations/{conversation.id}/",
        )
        assert response.status_code == 200
        assert response.data["title"] == "Existing chat"
        assert len(response.data["messages"]) == 2

    def test_get_other_users_conversation(self, authenticated_client):
        other_user = User.objects.create_user(
            username="other3", email="other3@example.com", password="testpass123!",
        )
        other_conv = Conversation.objects.create(
            user=other_user, title="Secret",
        )
        response = authenticated_client.get(
            f"/api/assistant/conversations/{other_conv.id}/",
        )
        assert response.status_code == 404

    def test_get_nonexistent_conversation(self, authenticated_client):
        response = authenticated_client.get(
            "/api/assistant/conversations/99999/",
        )
        assert response.status_code == 404
```

### Step 3.4 — Implement views (GREEN)

**File:** `backend/apps/assistant/views.py`

```python
import logging

from django.db.models import Count
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from services.llm.factory import create_llm_router
from services.llm.prompts import SYSTEM_PROMPTS

from .models import Conversation, Message
from .serializers import (
    ChatRequestSerializer,
    MessageSerializer,
    ConversationListSerializer,
    ConversationDetailSerializer,
)

logger = logging.getLogger(__name__)


class ChatView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_message = serializer.validated_data["message"]
        mode = serializer.validated_data["mode"]
        conversation_id = serializer.validated_data.get("conversation_id")

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
            # Auto-generate title from first message
            title = user_message[:50] + ("..." if len(user_message) > 50 else "")
            conversation = Conversation.objects.create(
                user=request.user,
                title=title,
            )

        # Save user message
        Message.objects.create(
            conversation=conversation,
            role="user",
            content=user_message,
        )

        # Build message history for the LLM
        prior_messages = Message.objects.filter(
            conversation=conversation,
        ).order_by("created_at")
        messages = [
            {"role": msg.role, "content": msg.content}
            for msg in prior_messages
        ]

        # Get system prompt for the mode
        system_prompt = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["conversation"])

        # Call LLM
        try:
            router = create_llm_router()
            llm_response = router.generate(
                messages=messages,
                system_prompt=system_prompt,
            )
        except Exception as exc:
            logger.error("LLM call failed: %s", exc)
            return Response(
                {"detail": "AI service is temporarily unavailable. Please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Save assistant response
        Message.objects.create(
            conversation=conversation,
            role="assistant",
            content=llm_response.content,
            provider=llm_response.provider,
            tokens_used=llm_response.tokens_used,
        )

        return Response({
            "reply": llm_response.content,
            "conversation_id": conversation.id,
            "provider": llm_response.provider,
            "tokens_used": llm_response.tokens_used,
        })


class ConversationListView(generics.ListAPIView):
    serializer_class = ConversationListSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Conversation.objects.filter(
            user=self.request.user,
        ).annotate(message_count=Count("messages"))


class ConversationDetailView(generics.RetrieveAPIView):
    serializer_class = ConversationDetailSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Conversation.objects.filter(
            user=self.request.user,
        ).prefetch_related("messages")
```

### Step 3.5 — URLs

**File:** `backend/apps/assistant/urls.py`

```python
from django.urls import path
from . import views

app_name = "assistant"

urlpatterns = [
    path("chat/", views.ChatView.as_view(), name="chat"),
    path("conversations/", views.ConversationListView.as_view(), name="conversation-list"),
    path("conversations/<int:pk>/", views.ConversationDetailView.as_view(), name="conversation-detail"),
]
```

Add to `backend/config/urls.py`:

```python
path("api/assistant/", include("apps.assistant.urls")),
```

### Step 3.6 — Run all assistant tests (GREEN)

```bash
cd backend && python -m pytest apps/assistant/tests/ -v
```

**Commit:** `feat: add assistant API with chat, conversation list, and detail endpoints`

---

## Task 4: Telegram /chat Command

**Goal:** Add a `/chat` command to the Telegram bot that uses the LLM service for AI conversation. Uses `ConversationHandler` pattern (like `/quiz`).

### Step 4.1 — Write tests (RED)

**File:** `backend/apps/bot/tests/test_chat.py`

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from telegram import Update, User as TGUser, Message as TGMessage, Chat

from apps.bot.handlers.chat import (
    chat_start,
    chat_message,
    chat_end,
    CHATTING,
)
from services.llm.base import LLMResponse


def make_update(text, user_id=123, first_name="Test", username="testuser"):
    """Create a mock Telegram Update."""
    update = MagicMock(spec=Update)
    update.effective_user = MagicMock(spec=TGUser)
    update.effective_user.id = user_id
    update.effective_user.first_name = first_name
    update.effective_user.username = username
    update.message = MagicMock(spec=TGMessage)
    update.message.text = text
    update.message.reply_text = AsyncMock()
    return update


def make_context():
    """Create a mock context with user_data dict."""
    context = MagicMock()
    context.user_data = {}
    context.args = []
    return context


@pytest.mark.django_db
class TestChatStart:
    @pytest.mark.asyncio
    async def test_chat_start_sends_welcome(self):
        update = make_update("/chat")
        context = make_context()

        result = await chat_start(update, context)

        assert result == CHATTING
        update.message.reply_text.assert_called_once()
        call_text = update.message.reply_text.call_args[0][0]
        assert "conversation" in call_text.lower() or "chat" in call_text.lower()
        assert "conversation_id" in context.user_data


@pytest.mark.django_db
class TestChatMessage:
    @pytest.mark.asyncio
    @patch("apps.bot.handlers.chat.create_llm_router")
    async def test_chat_message_gets_ai_response(self, mock_factory):
        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="Bonjour! Comment allez-vous?",
            provider="gemini",
            tokens_used=20,
        )
        mock_factory.return_value = mock_router

        update = make_update("/chat")
        context = make_context()
        # Start chat first to set up context
        await chat_start(update, context)

        # Now send a message
        update2 = make_update("Bonjour!")
        result = await chat_message(update2, context)

        assert result == CHATTING
        update2.message.reply_text.assert_called_once()
        call_text = update2.message.reply_text.call_args[0][0]
        assert "Bonjour" in call_text

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.chat.create_llm_router")
    async def test_chat_message_handles_llm_error(self, mock_factory):
        mock_router = MagicMock()
        mock_router.generate.side_effect = Exception("API down")
        mock_factory.return_value = mock_router

        update = make_update("/chat")
        context = make_context()
        await chat_start(update, context)

        update2 = make_update("Bonjour!")
        result = await chat_message(update2, context)

        assert result == CHATTING
        call_text = update2.message.reply_text.call_args[0][0]
        assert "sorry" in call_text.lower() or "unavailable" in call_text.lower()


@pytest.mark.django_db
class TestChatEnd:
    @pytest.mark.asyncio
    async def test_chat_end_cleans_up(self):
        update = make_update("/chat")
        context = make_context()
        await chat_start(update, context)

        update2 = make_update("/endchat")
        from telegram.ext import ConversationHandler

        result = await chat_end(update2, context)

        assert result == ConversationHandler.END
        assert "conversation_id" not in context.user_data
```

### Step 4.2 — Implement handler (GREEN)

**File:** `backend/apps/bot/handlers/chat.py`

```python
import logging

from telegram import Update
from telegram.ext import (
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from apps.bot.handlers.start import get_or_create_telegram_user
from apps.assistant.models import Conversation, Message
from services.llm.factory import create_llm_router
from services.llm.prompts import SYSTEM_PROMPTS

logger = logging.getLogger(__name__)

# Conversation states
CHATTING = 0


async def chat_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle /chat — start an AI conversation."""
    tg_user = update.effective_user
    user, _ = get_or_create_telegram_user(
        telegram_id=tg_user.id,
        first_name=tg_user.first_name or "",
        username=tg_user.username,
    )

    conversation = Conversation.objects.create(
        user=user,
        title=f"Telegram chat",
        context="telegram",
    )

    context.user_data["conversation_id"] = conversation.id

    await update.message.reply_text(
        "AI chat started! Send me messages in French and I'll help you practice.\n"
        "Use /endchat to end the conversation."
    )

    return CHATTING


async def chat_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle a user message during an AI chat session."""
    user_text = update.message.text
    conversation_id = context.user_data.get("conversation_id")

    if not conversation_id:
        await update.message.reply_text(
            "No active chat. Use /chat to start one."
        )
        return ConversationHandler.END

    try:
        conversation = Conversation.objects.get(pk=conversation_id)
    except Conversation.DoesNotExist:
        await update.message.reply_text("Chat session lost. Use /chat to start a new one.")
        return ConversationHandler.END

    # Save user message
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

    # Call LLM
    try:
        router = create_llm_router()
        llm_response = router.generate(
            messages=messages,
            system_prompt=SYSTEM_PROMPTS["conversation"],
        )
    except Exception as exc:
        logger.error("LLM call failed in Telegram chat: %s", exc)
        await update.message.reply_text(
            "Sorry, the AI assistant is temporarily unavailable. "
            "Please try again in a moment."
        )
        return CHATTING

    # Save assistant message
    Message.objects.create(
        conversation=conversation,
        role="assistant",
        content=llm_response.content,
        provider=llm_response.provider,
        tokens_used=llm_response.tokens_used,
    )

    await update.message.reply_text(llm_response.content)
    return CHATTING


async def chat_end(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle /endchat — end the AI conversation."""
    context.user_data.pop("conversation_id", None)
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
            ],
        },
        fallbacks=[CommandHandler("endchat", chat_end)],
    )
```

### Step 4.3 — Register in bot.py

**File:** `backend/apps/bot/bot.py`

Add import:

```python
from apps.bot.handlers.chat import chat_conversation_handler
```

Add handler registration (after the quiz handler):

```python
application.add_handler(chat_conversation_handler())
```

### Step 4.4 — Run tests

```bash
cd backend && python -m pytest apps/bot/tests/test_chat.py -v
```

**Commit:** `feat: add /chat Telegram command for AI conversation`

---

## Task 5: Frontend Chat Page

**Goal:** React chat interface at `/assistant` with message bubbles, mode selector, and typing indicator.

### Step 5.1 — API client functions

**File:** `frontend/src/api/assistant.js`

```javascript
import client from "./client";

export const sendChatMessage = (message, mode = "conversation", conversationId = null) =>
  client.post("/assistant/chat/", {
    message,
    mode,
    conversation_id: conversationId,
  });

export const getConversations = () =>
  client.get("/assistant/conversations/");

export const getConversation = (id) =>
  client.get(`/assistant/conversations/${id}/`);
```

### Step 5.2 — Chat page component

**File:** `frontend/src/pages/Assistant.jsx`

```jsx
import { useState, useRef, useEffect, useCallback } from "react";
import { sendChatMessage, getConversations, getConversation } from "../api/assistant";

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
        <p className="text-sm leading-relaxed">{message.content}</p>
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

export default function Assistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("conversation");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load conversation list
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
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setLoading(true);

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
  }, [input, loading, mode, conversationId]);

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

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p className="text-lg font-medium mb-1">Start a conversation</p>
              <p className="text-sm">
                {MODE_OPTIONS.find((m) => m.value === mode)?.description}
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
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "grammar_correction"
                  ? "Paste French text to correct..."
                  : mode === "grammar_explanation"
                  ? "Ask about a grammar concept..."
                  : "Type your message in French..."
              }
              rows={1}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Step 5.3 — Add route

**File:** `frontend/src/App.jsx`

Add import at the top:

```javascript
import Assistant from "./pages/Assistant";
```

Add route inside the `<ProtectedRoute>` `<Layout />` block, after the quiz route:

```jsx
<Route path="assistant" element={<Assistant />} />
```

### Step 5.4 — Verify it renders

Open `http://localhost:5173/assistant` in the browser. Check that:
- The sidebar renders with "New Chat" button
- Mode selector shows three buttons
- Empty state message appears
- Input area is visible and accepts text

**Commit:** `feat: add frontend chat interface for AI assistant`

---

## Verification Checklist

After all tasks are complete, run the full test suite:

```bash
cd backend && python -m pytest -v
```

### Manual smoke test sequence:

1. **LLM Service:** Temporarily add real API keys to `.env`, open Django shell:
   ```python
   from services.llm.factory import create_llm_router
   router = create_llm_router()
   response = router.generate(
       messages=[{"role": "user", "content": "Bonjour!"}],
       system_prompt="You are a French tutor. Respond briefly.",
   )
   print(response.content, response.provider, response.tokens_used)
   ```

2. **API:** Use httpie or curl:
   ```bash
   # Get token
   TOKEN=$(http POST :8000/api/users/token/ username=testuser password=testpass123! | jq -r .access)

   # Send chat message
   http POST :8000/api/assistant/chat/ Authorization:"Bearer $TOKEN" message="Bonjour!" mode="conversation"

   # List conversations
   http GET :8000/api/assistant/conversations/ Authorization:"Bearer $TOKEN"
   ```

3. **Telegram:** Send `/chat` to the bot, exchange a few messages, then `/endchat`.

4. **Frontend:** Open `/assistant`, send messages in all three modes, switch between conversations.

---

## Summary of Commits

| # | Commit Message | Files Changed |
|---|---|---|
| 1 | `chore: add google-generativeai and groq dependencies` | `requirements.txt` |
| 2 | `feat: add LLM service layer with Gemini/Groq providers and fallback router` | `services/llm/*`, `config/settings/base.py` |
| 3 | `feat: add Conversation and Message models for AI assistant` | `apps/assistant/models.py`, `admin.py`, `apps.py`, migration, `settings/base.py` |
| 4 | `feat: add assistant API with chat, conversation list, and detail endpoints` | `apps/assistant/views.py`, `serializers.py`, `urls.py`, `config/urls.py` |
| 5 | `feat: add /chat Telegram command for AI conversation` | `apps/bot/handlers/chat.py`, `apps/bot/bot.py` |
| 6 | `feat: add frontend chat interface for AI assistant` | `frontend/src/pages/Assistant.jsx`, `frontend/src/api/assistant.js`, `frontend/src/App.jsx` |

---

## Dependencies Between Tasks

```
Task 1 (LLM Service) ─────► Task 3 (Views) ─────► Task 4 (Telegram)
                                  ▲
Task 2 (Models) ──────────────────┘                 Task 5 (Frontend)
                                                         ▲
                                  Task 3 ────────────────┘
```

Tasks 1 and 2 can be done in parallel. Task 3 depends on both. Tasks 4 and 5 depend on Task 3 and can be done in parallel with each other.
