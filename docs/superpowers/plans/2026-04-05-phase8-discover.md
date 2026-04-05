# Phase 8: Discover — Implementation Plan

**Date:** 2026-04-05
**Depends on:** Phases 1-7 (User, Content, Practice, Telegram, AI Assistant, Gamification, Audio)
**Delivers:** Instagram Explore-style feed with mixed content cards (word of the day, grammar tips, trivia, news), daily generation via Celery, on-demand generation, interaction tracking with XP, Telegram `/news` command, frontend Discover page

---

## Overview

This phase adds a Discover feature — a curated content feed that surfaces interesting French learning content beyond structured lessons:

1. **Discover App** (`backend/apps/discover/`) — DiscoverCard and UserDiscoverHistory models
2. **Card Generation Service** (`backend/apps/discover/services.py`) — generates cards from existing Vocabulary/GrammarRule tables + LLM for trivia/news
3. **Celery Task** — `generate_daily_feed()` scheduled daily + management command for manual runs
4. **API Endpoints** — feed, generate-more, interact (awards 3 XP)
5. **Telegram** — `/news` command sends a random discover card
6. **Frontend** — `/discover` page with card grid, type-specific styling, "Generate More" button

### Card types

| Type | Source | Content |
|---|---|---|
| `word` | Random `Vocabulary` row | french, english, pronunciation, example_sentence |
| `grammar` | Random `GrammarRule` row | title, explanation, formula |
| `trivia` | LLM-generated | Fun fact about French language or culture |
| `news` | LLM-generated (mock) | Simplified French news article at B1-B2 level |

---

## Task 1: Discover Models

**Goal:** Create `backend/apps/discover/` with `DiscoverCard` and `UserDiscoverHistory` models. TDD.

**Why first:** Every other task depends on these models existing.

### Step 1.1 — Create the discover app skeleton

```bash
cd backend
python manage.py startapp discover apps/discover
```

Create the directory structure:

```
backend/apps/discover/
├── __init__.py
├── admin.py
├── apps.py
├── models.py
├── serializers.py
├── services.py
├── views.py
├── urls.py
├── tasks.py
├── management/
│   ├── __init__.py
│   └── commands/
│       ├── __init__.py
│       └── generate_feed.py
├── migrations/
│   └── __init__.py
└── tests/
    ├── __init__.py
    ├── test_models.py
    ├── test_services.py
    ├── test_serializers.py
    └── test_views.py
```

**File:** `backend/apps/discover/apps.py`

```python
from django.apps import AppConfig


class DiscoverConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.discover"
    verbose_name = "Discover"
```

Register in `backend/config/settings/base.py` — add `"apps.discover"` to `INSTALLED_APPS`:

```python
INSTALLED_APPS = [
    # ...existing apps...
    "apps.media",
    "apps.discover",
]
```

### Step 1.2 — DiscoverCard model

**File:** `backend/apps/discover/models.py`

```python
from django.conf import settings
from django.db import models
from django.utils import timezone


class DiscoverCard(models.Model):
    TYPE_CHOICES = [
        ("news", "News"),
        ("word", "Word of the Day"),
        ("grammar", "Grammar Tip"),
        ("trivia", "Trivia"),
    ]

    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    title = models.CharField(max_length=300)
    summary = models.TextField(blank=True, default="")
    content_json = models.JSONField(default=dict)
    source_url = models.URLField(max_length=500, null=True, blank=True)
    image_url = models.URLField(max_length=500, null=True, blank=True)
    generated_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "discover_cards"
        ordering = ["-generated_at"]

    def __str__(self):
        return f"[{self.type}] {self.title}"

    @property
    def is_expired(self):
        if self.expires_at is None:
            return False
        return timezone.now() > self.expires_at


class UserDiscoverHistory(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="discover_history",
    )
    card = models.ForeignKey(
        DiscoverCard,
        on_delete=models.CASCADE,
        related_name="view_history",
    )
    seen_at = models.DateTimeField(auto_now_add=True)
    interacted = models.BooleanField(default=False)

    class Meta:
        db_table = "discover_user_history"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "card"],
                name="unique_user_card_history",
            ),
        ]

    def __str__(self):
        return f"{self.user.username} — {self.card.title}"
```

**File:** `backend/apps/discover/admin.py`

```python
from django.contrib import admin
from .models import DiscoverCard, UserDiscoverHistory


@admin.register(DiscoverCard)
class DiscoverCardAdmin(admin.ModelAdmin):
    list_display = ("id", "type", "title", "generated_at", "expires_at")
    list_filter = ("type",)
    search_fields = ("title", "summary")


@admin.register(UserDiscoverHistory)
class UserDiscoverHistoryAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "card", "seen_at", "interacted")
    list_filter = ("interacted",)
```

Run migration:

```bash
python manage.py makemigrations discover
python manage.py migrate
```

### Step 1.3 — Write model tests (RED)

**File:** `backend/apps/discover/tests/test_models.py`

```python
import pytest
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.utils import timezone

from apps.discover.models import DiscoverCard, UserDiscoverHistory

User = get_user_model()


@pytest.mark.django_db
class TestDiscoverCard:
    def test_create_word_card(self):
        card = DiscoverCard.objects.create(
            type="word",
            title="Bonjour",
            summary="A common French greeting",
            content_json={
                "french": "bonjour",
                "english": "hello",
                "pronunciation": "/bɔ̃.ʒuʁ/",
                "example": "Bonjour, comment allez-vous?",
            },
        )
        assert card.pk is not None
        assert card.type == "word"
        assert card.content_json["french"] == "bonjour"

    def test_create_grammar_card(self):
        card = DiscoverCard.objects.create(
            type="grammar",
            title="Le passé composé",
            summary="How to form the past tense",
            content_json={
                "explanation": "Use avoir/être + past participle",
                "formula": "sujet + avoir/être + participe passé",
            },
        )
        assert card.type == "grammar"

    def test_create_trivia_card(self):
        card = DiscoverCard.objects.create(
            type="trivia",
            title="French in Africa",
            summary="French is spoken in 29 countries in Africa",
            content_json={"fact": "More people speak French in Africa than in Europe."},
        )
        assert card.type == "trivia"

    def test_create_news_card(self):
        card = DiscoverCard.objects.create(
            type="news",
            title="Les Jeux Olympiques 2028",
            summary="Les prochains JO auront lieu à Los Angeles",
            content_json={
                "article_fr": "Les Jeux Olympiques de 2028...",
                "article_en": "The 2028 Olympic Games...",
                "key_vocabulary": ["jeux", "olympiques"],
            },
            source_url="https://www.france24.com/example",
        )
        assert card.source_url is not None

    def test_str_representation(self):
        card = DiscoverCard.objects.create(
            type="word", title="Bonjour", content_json={},
        )
        assert "[word] Bonjour" in str(card)

    def test_is_expired_false_when_no_expiry(self):
        card = DiscoverCard.objects.create(
            type="trivia", title="Fact", content_json={},
        )
        assert card.is_expired is False

    def test_is_expired_false_when_future(self):
        card = DiscoverCard.objects.create(
            type="trivia", title="Fact", content_json={},
            expires_at=timezone.now() + timedelta(days=1),
        )
        assert card.is_expired is False

    def test_is_expired_true_when_past(self):
        card = DiscoverCard.objects.create(
            type="trivia", title="Fact", content_json={},
            expires_at=timezone.now() - timedelta(hours=1),
        )
        assert card.is_expired is True

    def test_ordering_is_newest_first(self):
        c1 = DiscoverCard.objects.create(
            type="word", title="First", content_json={},
            generated_at=timezone.now() - timedelta(hours=2),
        )
        c2 = DiscoverCard.objects.create(
            type="word", title="Second", content_json={},
            generated_at=timezone.now() - timedelta(hours=1),
        )
        cards = list(DiscoverCard.objects.all())
        assert cards[0].pk == c2.pk
        assert cards[1].pk == c1.pk


@pytest.mark.django_db
class TestUserDiscoverHistory:
    @pytest.fixture
    def user(self):
        return User.objects.create_user(
            username="discover_user", password="testpass123",
        )

    @pytest.fixture
    def card(self):
        return DiscoverCard.objects.create(
            type="word", title="Bonjour", content_json={},
        )

    def test_create_history_entry(self, user, card):
        history = UserDiscoverHistory.objects.create(
            user=user, card=card,
        )
        assert history.pk is not None
        assert history.interacted is False
        assert history.seen_at is not None

    def test_mark_as_interacted(self, user, card):
        history = UserDiscoverHistory.objects.create(
            user=user, card=card,
        )
        history.interacted = True
        history.save()
        history.refresh_from_db()
        assert history.interacted is True

    def test_unique_user_card_constraint(self, user, card):
        UserDiscoverHistory.objects.create(user=user, card=card)
        with pytest.raises(IntegrityError):
            UserDiscoverHistory.objects.create(user=user, card=card)

    def test_str_representation(self, user, card):
        history = UserDiscoverHistory.objects.create(user=user, card=card)
        assert user.username in str(history)
        assert card.title in str(history)
```

### Step 1.4 — Run tests, confirm GREEN

```bash
pytest apps/discover/tests/test_models.py -v
```

### Step 1.5 — Commit

```
git add apps/discover/ config/settings/base.py
git commit -m "feat(discover): add DiscoverCard and UserDiscoverHistory models

Phase 8 Task 1 — creates the discover app with card and history models,
admin registration, and full model test coverage."
```

---

## Task 2: Card Generation Service

**Goal:** Create a service that generates word, grammar, trivia, and news cards. Uses existing Vocabulary/GrammarRule tables for word/grammar cards, LLM for trivia/news. Management command for manual generation. TDD with mocked LLM.

**Why second:** The API and frontend both consume generated cards.

### Step 2.1 — Add LLM system prompts

**File:** `backend/services/llm/prompts.py` — add two new entries to `SYSTEM_PROMPTS`:

```python
SYSTEM_PROMPTS = {
    # ...existing prompts...
    "trivia_generator": (
        "Generate a fun, interesting trivia fact about the French language or "
        "French/Francophone culture. Target B1-B2 level French learners. "
        "Respond in JSON format with keys: title (English, catchy, max 60 chars), "
        "summary (English, 1-2 sentences), fact_fr (the fact in simple French), "
        "fact_en (English translation). Keep it educational and engaging."
    ),
    "news_generator": (
        "Generate a short mock news article about a current or plausible topic, "
        "written in simplified French at B1-B2 level. Include vocabulary help. "
        "Respond in JSON format with keys: title (French headline, max 80 chars), "
        "summary (English, 1-2 sentences), article_fr (French article, 100-150 words), "
        "article_en (English translation), key_vocabulary (list of 5 objects with "
        "'french' and 'english' keys for important words in the article)."
    ),
}
```

### Step 2.2 — Write service tests (RED)

**File:** `backend/apps/discover/tests/test_services.py`

```python
import json
import pytest
from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.content.models import GrammarRule, Lesson, Topic, Vocabulary
from apps.discover.models import DiscoverCard
from apps.discover.services import (
    generate_grammar_card,
    generate_news_card,
    generate_trivia_card,
    generate_word_card,
    generate_daily_cards,
)

User = get_user_model()


@pytest.fixture
def content_data(db):
    """Create a topic, lesson, vocabulary item, and grammar rule."""
    topic = Topic.objects.create(
        name_fr="Les bases", name_en="Basics",
        description="Basic French", icon="book", order=1, difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic, type="vocab", title="Greetings",
        content={}, order=1, difficulty=1,
    )
    vocab = Vocabulary.objects.create(
        lesson=lesson, french="bonjour", english="hello",
        pronunciation="/bɔ̃.ʒuʁ/",
        example_sentence="Bonjour, comment allez-vous?",
        gender="a", part_of_speech="interjection",
    )
    grammar_lesson = Lesson.objects.create(
        topic=topic, type="grammar", title="Articles",
        content={}, order=2, difficulty=1,
    )
    grammar = GrammarRule.objects.create(
        lesson=grammar_lesson, title="Les articles définis",
        explanation="Le, la, les are definite articles.",
        formula="le (m) / la (f) / les (pl)",
        examples=["le chat", "la maison", "les enfants"],
        exceptions=["l'homme (before vowel)"],
    )
    return {"topic": topic, "lesson": lesson, "vocab": vocab, "grammar": grammar}


@pytest.mark.django_db
class TestGenerateWordCard:
    def test_creates_word_card_from_vocabulary(self, content_data):
        card = generate_word_card()
        assert card is not None
        assert card.type == "word"
        assert card.title == "bonjour"
        assert card.content_json["french"] == "bonjour"
        assert card.content_json["english"] == "hello"
        assert card.content_json["pronunciation"] == "/bɔ̃.ʒuʁ/"
        assert card.content_json["example"] == "Bonjour, comment allez-vous?"

    def test_returns_none_when_no_vocabulary(self, db):
        card = generate_word_card()
        assert card is None

    def test_sets_expiry_to_24_hours(self, content_data):
        card = generate_word_card()
        assert card.expires_at is not None
        diff = card.expires_at - card.generated_at
        assert timedelta(hours=23) < diff < timedelta(hours=25)


@pytest.mark.django_db
class TestGenerateGrammarCard:
    def test_creates_grammar_card(self, content_data):
        card = generate_grammar_card()
        assert card is not None
        assert card.type == "grammar"
        assert card.title == "Les articles définis"
        assert card.content_json["explanation"] == "Le, la, les are definite articles."
        assert card.content_json["formula"] == "le (m) / la (f) / les (pl)"

    def test_returns_none_when_no_grammar_rules(self, db):
        card = generate_grammar_card()
        assert card is None

    def test_sets_expiry_to_24_hours(self, content_data):
        card = generate_grammar_card()
        assert card.expires_at is not None


@pytest.mark.django_db
class TestGenerateTriviaCard:
    @patch("apps.discover.services.create_llm_router")
    def test_creates_trivia_card_from_llm(self, mock_create_router):
        mock_router = MagicMock()
        mock_router.generate.return_value = MagicMock(
            content=json.dumps({
                "title": "French in Africa",
                "summary": "More people speak French in Africa than in Europe.",
                "fact_fr": "Plus de gens parlent français en Afrique qu'en Europe.",
                "fact_en": "More people speak French in Africa than in Europe.",
            })
        )
        mock_create_router.return_value = mock_router

        card = generate_trivia_card()
        assert card is not None
        assert card.type == "trivia"
        assert card.title == "French in Africa"
        assert card.content_json["fact_fr"] is not None

    @patch("apps.discover.services.create_llm_router")
    def test_returns_none_on_llm_error(self, mock_create_router):
        mock_create_router.side_effect = RuntimeError("No API key")
        card = generate_trivia_card()
        assert card is None

    @patch("apps.discover.services.create_llm_router")
    def test_returns_none_on_invalid_json(self, mock_create_router):
        mock_router = MagicMock()
        mock_router.generate.return_value = MagicMock(content="not json")
        mock_create_router.return_value = mock_router

        card = generate_trivia_card()
        assert card is None


@pytest.mark.django_db
class TestGenerateNewsCard:
    @patch("apps.discover.services.create_llm_router")
    def test_creates_news_card_from_llm(self, mock_create_router):
        mock_router = MagicMock()
        mock_router.generate.return_value = MagicMock(
            content=json.dumps({
                "title": "La France gagne la Coupe du Monde",
                "summary": "France wins the World Cup in a thrilling final.",
                "article_fr": "La France a remporté la Coupe du Monde...",
                "article_en": "France has won the World Cup...",
                "key_vocabulary": [
                    {"french": "gagner", "english": "to win"},
                    {"french": "la coupe", "english": "the cup"},
                ],
            })
        )
        mock_create_router.return_value = mock_router

        card = generate_news_card()
        assert card is not None
        assert card.type == "news"
        assert card.content_json["article_fr"] is not None
        assert len(card.content_json["key_vocabulary"]) == 2

    @patch("apps.discover.services.create_llm_router")
    def test_returns_none_on_llm_error(self, mock_create_router):
        mock_create_router.side_effect = RuntimeError("No API key")
        card = generate_news_card()
        assert card is None


@pytest.mark.django_db
class TestGenerateDailyCards:
    @patch("apps.discover.services.generate_news_card")
    @patch("apps.discover.services.generate_trivia_card")
    @patch("apps.discover.services.generate_grammar_card")
    @patch("apps.discover.services.generate_word_card")
    def test_generates_all_card_types(
        self, mock_word, mock_grammar, mock_trivia, mock_news,
    ):
        mock_word.return_value = DiscoverCard(pk=1, type="word", title="w")
        mock_grammar.return_value = DiscoverCard(pk=2, type="grammar", title="g")
        mock_trivia.return_value = DiscoverCard(pk=3, type="trivia", title="t")
        mock_news.return_value = DiscoverCard(pk=4, type="news", title="n")

        cards = generate_daily_cards()
        assert len(cards) == 4
        mock_word.assert_called_once()
        mock_grammar.assert_called_once()
        mock_trivia.assert_called_once()
        mock_news.assert_called_once()

    @patch("apps.discover.services.generate_news_card")
    @patch("apps.discover.services.generate_trivia_card")
    @patch("apps.discover.services.generate_grammar_card")
    @patch("apps.discover.services.generate_word_card")
    def test_skips_none_results(
        self, mock_word, mock_grammar, mock_trivia, mock_news,
    ):
        mock_word.return_value = DiscoverCard(pk=1, type="word", title="w")
        mock_grammar.return_value = None  # no grammar rules in DB
        mock_trivia.return_value = None  # LLM error
        mock_news.return_value = DiscoverCard(pk=4, type="news", title="n")

        cards = generate_daily_cards()
        assert len(cards) == 2
```

### Step 2.3 — Implement the service (GREEN)

**File:** `backend/apps/discover/services.py`

```python
"""Discover card generation service."""

import json
import logging
from datetime import timedelta
from typing import Optional

from django.utils import timezone

from apps.content.models import GrammarRule, Vocabulary
from apps.discover.models import DiscoverCard
from services.llm.factory import create_llm_router
from services.llm.prompts import SYSTEM_PROMPTS

logger = logging.getLogger(__name__)

CARD_EXPIRY_HOURS = 24


def generate_word_card() -> Optional[DiscoverCard]:
    """Generate a Word of the Day card from a random Vocabulary entry."""
    vocab = Vocabulary.objects.order_by("?").first()
    if vocab is None:
        logger.warning("No vocabulary items available for word card generation.")
        return None

    now = timezone.now()
    card = DiscoverCard.objects.create(
        type="word",
        title=vocab.french,
        summary=f"{vocab.french} — {vocab.english}",
        content_json={
            "french": vocab.french,
            "english": vocab.english,
            "pronunciation": vocab.pronunciation,
            "example": vocab.example_sentence,
            "gender": vocab.gender,
            "part_of_speech": vocab.part_of_speech,
        },
        generated_at=now,
        expires_at=now + timedelta(hours=CARD_EXPIRY_HOURS),
    )
    return card


def generate_grammar_card() -> Optional[DiscoverCard]:
    """Generate a Grammar Tip card from a random GrammarRule entry."""
    rule = GrammarRule.objects.order_by("?").first()
    if rule is None:
        logger.warning("No grammar rules available for grammar card generation.")
        return None

    now = timezone.now()
    card = DiscoverCard.objects.create(
        type="grammar",
        title=rule.title,
        summary=rule.explanation[:200],
        content_json={
            "explanation": rule.explanation,
            "formula": rule.formula,
            "examples": rule.examples,
            "exceptions": rule.exceptions,
        },
        generated_at=now,
        expires_at=now + timedelta(hours=CARD_EXPIRY_HOURS),
    )
    return card


def generate_trivia_card() -> Optional[DiscoverCard]:
    """Generate a trivia card using the LLM."""
    try:
        router = create_llm_router()
        response = router.generate(
            messages=[{"role": "user", "content": "Generate a French trivia fact."}],
            system_prompt=SYSTEM_PROMPTS["trivia_generator"],
        )
        data = json.loads(response.content)
    except (RuntimeError, json.JSONDecodeError, KeyError) as exc:
        logger.warning("Failed to generate trivia card: %s", exc)
        return None

    now = timezone.now()
    card = DiscoverCard.objects.create(
        type="trivia",
        title=data.get("title", "French Trivia"),
        summary=data.get("summary", ""),
        content_json={
            "fact_fr": data.get("fact_fr", ""),
            "fact_en": data.get("fact_en", ""),
        },
        generated_at=now,
        expires_at=now + timedelta(hours=CARD_EXPIRY_HOURS),
    )
    return card


def generate_news_card() -> Optional[DiscoverCard]:
    """Generate a mock news article card using the LLM."""
    try:
        router = create_llm_router()
        response = router.generate(
            messages=[{
                "role": "user",
                "content": "Generate a simplified French news article for B1-B2 learners.",
            }],
            system_prompt=SYSTEM_PROMPTS["news_generator"],
        )
        data = json.loads(response.content)
    except (RuntimeError, json.JSONDecodeError, KeyError) as exc:
        logger.warning("Failed to generate news card: %s", exc)
        return None

    now = timezone.now()
    card = DiscoverCard.objects.create(
        type="news",
        title=data.get("title", "Actualités"),
        summary=data.get("summary", ""),
        content_json={
            "article_fr": data.get("article_fr", ""),
            "article_en": data.get("article_en", ""),
            "key_vocabulary": data.get("key_vocabulary", []),
        },
        generated_at=now,
        expires_at=now + timedelta(hours=CARD_EXPIRY_HOURS),
    )
    return card


def generate_daily_cards() -> list[DiscoverCard]:
    """Generate one card of each type for the daily feed.

    Returns a list of successfully created cards (skips any that failed).
    """
    generators = [
        generate_word_card,
        generate_grammar_card,
        generate_trivia_card,
        generate_news_card,
    ]

    cards = []
    for gen_fn in generators:
        card = gen_fn()
        if card is not None:
            cards.append(card)

    logger.info("Daily feed generated: %d cards created.", len(cards))
    return cards
```

### Step 2.4 — Celery task

**File:** `backend/apps/discover/tasks.py`

```python
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="discover.generate_daily_feed")
def generate_daily_feed():
    """Celery task to generate the daily discover feed."""
    from apps.discover.services import generate_daily_cards

    cards = generate_daily_cards()
    logger.info("generate_daily_feed task complete: %d cards.", len(cards))
    return len(cards)
```

### Step 2.5 — Register Celery Beat schedule

**File:** `backend/config/settings/base.py` — add at the bottom:

```python
# Celery Beat schedule
CELERY_BEAT_SCHEDULE = {
    "generate-daily-discover-feed": {
        "task": "discover.generate_daily_feed",
        "schedule": 86400.0,  # every 24 hours (in seconds)
    },
}
```

### Step 2.6 — Management command

**File:** `backend/apps/discover/management/commands/generate_feed.py`

```python
from django.core.management.base import BaseCommand

from apps.discover.services import generate_daily_cards


class Command(BaseCommand):
    help = "Generate discover feed cards (word, grammar, trivia, news)"

    def handle(self, *args, **options):
        cards = generate_daily_cards()
        self.stdout.write(
            self.style.SUCCESS(
                f"Generated {len(cards)} discover cards: "
                f"{[c.type for c in cards]}"
            )
        )
```

### Step 2.7 — Run tests, confirm GREEN

```bash
pytest apps/discover/tests/test_services.py -v
```

### Step 2.8 — Commit

```
git add apps/discover/services.py apps/discover/tasks.py \
       apps/discover/management/ apps/discover/tests/test_services.py \
       services/llm/prompts.py config/settings/base.py
git commit -m "feat(discover): add card generation service, Celery task, and management command

Phase 8 Task 2 — generates word/grammar cards from existing content DB,
trivia/news cards via LLM, daily Celery beat schedule, and generate_feed
management command. Tests mock the LLM."
```

---

## Task 3: Discover API

**Goal:** Three endpoints — feed (paginated, unseen first), generate-more (on-demand), interact (awards 3 XP). TDD.

**Why third:** Frontend and Telegram both consume these endpoints.

### Step 3.1 — Write serializers

**File:** `backend/apps/discover/serializers.py`

```python
from rest_framework import serializers

from .models import DiscoverCard, UserDiscoverHistory


class DiscoverCardSerializer(serializers.ModelSerializer):
    seen = serializers.BooleanField(read_only=True, default=False)
    interacted = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = DiscoverCard
        fields = (
            "id", "type", "title", "summary", "content_json",
            "source_url", "image_url", "generated_at", "expires_at",
            "seen", "interacted",
        )


class InteractSerializer(serializers.Serializer):
    """Empty serializer — interaction is just a POST to the card's URL."""
    pass
```

### Step 3.2 — Write API tests (RED)

**File:** `backend/apps/discover/tests/test_views.py`

```python
import pytest
from datetime import timedelta
from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.discover.models import DiscoverCard, UserDiscoverHistory
from apps.gamification.models import UserStats

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="testuser", email="test@example.com", password="testpass123",
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def sample_cards(db):
    now = timezone.now()
    cards = []
    for i, card_type in enumerate(["word", "grammar", "trivia", "news"]):
        card = DiscoverCard.objects.create(
            type=card_type,
            title=f"Card {i}",
            summary=f"Summary {i}",
            content_json={"data": f"content_{i}"},
            generated_at=now - timedelta(hours=i),
            expires_at=now + timedelta(hours=24),
        )
        cards.append(card)
    return cards


@pytest.mark.django_db
class TestFeedEndpoint:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.get("/api/discover/feed/")
        assert resp.status_code == 401

    def test_returns_cards(self, auth_client, sample_cards):
        resp = auth_client.get("/api/discover/feed/")
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert len(data["results"]) == 4

    def test_unseen_cards_come_first(self, auth_client, user, sample_cards):
        # Mark the newest card (index 0) as seen
        UserDiscoverHistory.objects.create(user=user, card=sample_cards[0])

        resp = auth_client.get("/api/discover/feed/")
        data = resp.json()
        results = data["results"]

        # The first 3 results should be unseen cards
        seen_ids = {sample_cards[0].pk}
        unseen_results = [r for r in results if r["id"] not in seen_ids]
        seen_results = [r for r in results if r["id"] in seen_ids]

        # Unseen cards appear before seen cards
        if unseen_results and seen_results:
            first_unseen_idx = next(
                i for i, r in enumerate(results) if r["id"] not in seen_ids
            )
            last_seen_idx = max(
                i for i, r in enumerate(results) if r["id"] in seen_ids
            )
            assert first_unseen_idx < last_seen_idx

    def test_excludes_expired_cards(self, auth_client, db):
        now = timezone.now()
        DiscoverCard.objects.create(
            type="word", title="Expired", content_json={},
            generated_at=now - timedelta(hours=48),
            expires_at=now - timedelta(hours=1),
        )
        DiscoverCard.objects.create(
            type="word", title="Active", content_json={},
            generated_at=now,
            expires_at=now + timedelta(hours=24),
        )

        resp = auth_client.get("/api/discover/feed/")
        data = resp.json()
        titles = [r["title"] for r in data["results"]]
        assert "Active" in titles
        assert "Expired" not in titles

    def test_includes_cards_with_no_expiry(self, auth_client, db):
        DiscoverCard.objects.create(
            type="trivia", title="No Expiry", content_json={},
            expires_at=None,
        )
        resp = auth_client.get("/api/discover/feed/")
        data = resp.json()
        assert len(data["results"]) == 1

    def test_marks_seen_and_interacted_fields(self, auth_client, user, sample_cards):
        UserDiscoverHistory.objects.create(
            user=user, card=sample_cards[0], interacted=False,
        )
        UserDiscoverHistory.objects.create(
            user=user, card=sample_cards[1], interacted=True,
        )

        resp = auth_client.get("/api/discover/feed/")
        data = resp.json()
        results_by_id = {r["id"]: r for r in data["results"]}

        assert results_by_id[sample_cards[0].pk]["seen"] is True
        assert results_by_id[sample_cards[0].pk]["interacted"] is False
        assert results_by_id[sample_cards[1].pk]["seen"] is True
        assert results_by_id[sample_cards[1].pk]["interacted"] is True
        assert results_by_id[sample_cards[2].pk]["seen"] is False


@pytest.mark.django_db
class TestGenerateMoreEndpoint:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.post("/api/discover/generate-more/")
        assert resp.status_code == 401

    @patch("apps.discover.views.generate_daily_cards")
    def test_generates_and_returns_cards(self, mock_generate, auth_client, db):
        now = timezone.now()
        mock_cards = [
            DiscoverCard.objects.create(
                type="word", title="New Word", content_json={},
                generated_at=now,
            ),
            DiscoverCard.objects.create(
                type="trivia", title="New Trivia", content_json={},
                generated_at=now,
            ),
        ]
        mock_generate.return_value = mock_cards

        resp = auth_client.post("/api/discover/generate-more/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["generated"] == 2
        assert len(data["cards"]) == 2
        mock_generate.assert_called_once()

    @patch("apps.discover.views.generate_daily_cards")
    def test_returns_empty_when_generation_fails(self, mock_generate, auth_client):
        mock_generate.return_value = []

        resp = auth_client.post("/api/discover/generate-more/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["generated"] == 0
        assert data["cards"] == []


@pytest.mark.django_db
class TestInteractEndpoint:
    def test_unauthenticated_returns_401(self, api_client, sample_cards):
        resp = api_client.post(f"/api/discover/cards/{sample_cards[0].pk}/interact/")
        assert resp.status_code == 401

    def test_interact_creates_history_and_awards_xp(self, auth_client, user, sample_cards):
        resp = auth_client.post(f"/api/discover/cards/{sample_cards[0].pk}/interact/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["xp_awarded"] == 3

        # History created
        history = UserDiscoverHistory.objects.get(user=user, card=sample_cards[0])
        assert history.interacted is True

    def test_interact_idempotent_no_double_xp(self, auth_client, user, sample_cards):
        url = f"/api/discover/cards/{sample_cards[0].pk}/interact/"
        resp1 = auth_client.post(url)
        assert resp1.json()["xp_awarded"] == 3

        resp2 = auth_client.post(url)
        assert resp2.json()["xp_awarded"] == 0
        assert resp2.json()["already_interacted"] is True

    def test_interact_nonexistent_card_returns_404(self, auth_client):
        resp = auth_client.post("/api/discover/cards/99999/interact/")
        assert resp.status_code == 404

    def test_interact_also_marks_seen(self, auth_client, user, sample_cards):
        auth_client.post(f"/api/discover/cards/{sample_cards[0].pk}/interact/")
        history = UserDiscoverHistory.objects.get(user=user, card=sample_cards[0])
        assert history.seen_at is not None
        assert history.interacted is True
```

### Step 3.3 — Write serializer tests

**File:** `backend/apps/discover/tests/test_serializers.py`

```python
import pytest
from django.utils import timezone

from apps.discover.models import DiscoverCard
from apps.discover.serializers import DiscoverCardSerializer


@pytest.mark.django_db
class TestDiscoverCardSerializer:
    def test_serializes_all_fields(self):
        card = DiscoverCard.objects.create(
            type="word",
            title="Bonjour",
            summary="Hello",
            content_json={"french": "bonjour", "english": "hello"},
            generated_at=timezone.now(),
        )
        data = DiscoverCardSerializer(card).data
        assert data["id"] == card.pk
        assert data["type"] == "word"
        assert data["title"] == "Bonjour"
        assert data["content_json"]["french"] == "bonjour"
        assert "generated_at" in data

    def test_seen_and_interacted_default_false(self):
        card = DiscoverCard.objects.create(
            type="trivia", title="Fact", content_json={},
        )
        data = DiscoverCardSerializer(card).data
        assert data["seen"] is False
        assert data["interacted"] is False
```

### Step 3.4 — Implement views (GREEN)

**File:** `backend/apps/discover/views.py`

```python
from django.db.models import BooleanField, Case, Exists, OuterRef, Subquery, Value, When
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.gamification.services import award_xp

from .models import DiscoverCard, UserDiscoverHistory
from .serializers import DiscoverCardSerializer
from .services import generate_daily_cards


class FeedPagination(PageNumberPagination):
    page_size = 20


class FeedView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        now = timezone.now()

        # Base queryset: non-expired cards
        qs = DiscoverCard.objects.filter(
            models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now)
        )

        # Annotate with seen/interacted from user's history
        user_history = UserDiscoverHistory.objects.filter(
            user=request.user, card=OuterRef("pk"),
        )
        qs = qs.annotate(
            seen=Exists(user_history),
            interacted=Case(
                When(
                    Exists(user_history.filter(interacted=True)),
                    then=Value(True),
                ),
                default=Value(False),
                output_field=BooleanField(),
            ),
        )

        # Order: unseen first, then by generated_at descending
        qs = qs.order_by("seen", "-generated_at")

        paginator = FeedPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = DiscoverCardSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class GenerateMoreView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        cards = generate_daily_cards()
        serializer = DiscoverCardSerializer(cards, many=True)
        return Response({
            "generated": len(cards),
            "cards": serializer.data,
        })


class InteractView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, card_id):
        card = get_object_or_404(DiscoverCard, pk=card_id)

        history, created = UserDiscoverHistory.objects.get_or_create(
            user=request.user,
            card=card,
            defaults={"interacted": True},
        )

        if not created and history.interacted:
            return Response({
                "already_interacted": True,
                "xp_awarded": 0,
            })

        if not history.interacted:
            history.interacted = True
            history.save()

        # Award 3 XP for interacting with a discover card
        stats, txn, new_badges = award_xp(
            user=request.user,
            activity_type="discover_interact",
            xp_amount=3,
            source_id=str(card.pk),
        )

        return Response({
            "already_interacted": False,
            "xp_awarded": 3,
            "total_xp": stats.total_xp,
        })
```

**Important fix:** The `FeedView` uses `models.Q` — add the import at the top:

```python
from django.db import models
```

So the full imports at the top of `views.py` are:

```python
from django.db import models
from django.db.models import BooleanField, Case, Exists, OuterRef, Subquery, Value, When
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.gamification.services import award_xp

from .models import DiscoverCard, UserDiscoverHistory
from .serializers import DiscoverCardSerializer
from .services import generate_daily_cards
```

### Step 3.5 — URL configuration

**File:** `backend/apps/discover/urls.py`

```python
from django.urls import path

from . import views

app_name = "discover"

urlpatterns = [
    path("feed/", views.FeedView.as_view(), name="feed"),
    path("generate-more/", views.GenerateMoreView.as_view(), name="generate-more"),
    path(
        "cards/<int:card_id>/interact/",
        views.InteractView.as_view(),
        name="interact",
    ),
]
```

**File:** `backend/config/urls.py` — add the discover URL:

```python
urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", include("apps.users.urls")),
    path("api/content/", include("apps.content.urls")),
    path("api/practice/", include("apps.practice.urls")),
    path("api/assistant/", include("apps.assistant.urls")),
    path("api/gamification/", include("apps.gamification.urls")),
    path("api/media/", include("apps.media.urls")),
    path("api/discover/", include("apps.discover.urls")),
]
```

### Step 3.6 — Run tests, confirm GREEN

```bash
pytest apps/discover/tests/test_views.py apps/discover/tests/test_serializers.py -v
```

### Step 3.7 — Commit

```
git add apps/discover/views.py apps/discover/serializers.py \
       apps/discover/urls.py apps/discover/tests/test_views.py \
       apps/discover/tests/test_serializers.py config/urls.py
git commit -m "feat(discover): add feed, generate-more, and interact API endpoints

Phase 8 Task 3 — feed endpoint returns cards with unseen-first ordering,
generate-more creates fresh cards on demand, interact awards 3 XP
idempotently. Full test coverage for all three endpoints."
```

---

## Task 4: Frontend Discover Page

**Goal:** `/discover` page with a card grid, type-specific styling, "Generate More" button, and interaction tracking.

**Why fourth:** API is ready; this is the web interface.

### Step 4.1 — API client module

**File:** `frontend/src/api/discover.js`

```javascript
import client from "./client";

export const getFeed = (page = 1) =>
  client.get("/discover/feed/", { params: { page } });

export const generateMore = () =>
  client.post("/discover/generate-more/");

export const interactWithCard = (cardId) =>
  client.post(`/discover/cards/${cardId}/interact/`);
```

### Step 4.2 — DiscoverCard component

**File:** `frontend/src/components/DiscoverCard.jsx`

```jsx
import { useState } from "react";
import { interactWithCard } from "../api/discover";

const TYPE_STYLES = {
  word: {
    border: "border-blue-300",
    bg: "bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
    icon: "Aa",
    label: "Word of the Day",
  },
  grammar: {
    border: "border-purple-300",
    bg: "bg-purple-50",
    badge: "bg-purple-100 text-purple-700",
    icon: "Gr",
    label: "Grammar Tip",
  },
  trivia: {
    border: "border-amber-300",
    bg: "bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
    icon: "?!",
    label: "Trivia",
  },
  news: {
    border: "border-green-300",
    bg: "bg-green-50",
    badge: "bg-green-100 text-green-700",
    icon: "N",
    label: "News",
  },
};

function WordContent({ content }) {
  return (
    <div className="space-y-2">
      <p className="text-2xl font-bold text-gray-900">{content.french}</p>
      <p className="text-lg text-gray-600">{content.english}</p>
      {content.pronunciation && (
        <p className="text-sm text-gray-400 font-mono">{content.pronunciation}</p>
      )}
      {content.example && (
        <p className="text-sm text-gray-500 italic mt-2">{content.example}</p>
      )}
      {content.part_of_speech && (
        <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
          {content.part_of_speech}
        </span>
      )}
    </div>
  );
}

function GrammarContent({ content }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-700">{content.explanation}</p>
      {content.formula && (
        <p className="text-sm font-mono bg-purple-100 text-purple-800 px-2 py-1 rounded">
          {content.formula}
        </p>
      )}
      {content.examples && content.examples.length > 0 && (
        <ul className="text-sm text-gray-600 list-disc list-inside">
          {content.examples.slice(0, 3).map((ex, i) => (
            <li key={i}>{ex}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TriviaContent({ content }) {
  return (
    <div className="space-y-2">
      {content.fact_fr && (
        <p className="text-sm text-gray-800 font-medium">{content.fact_fr}</p>
      )}
      {content.fact_en && (
        <p className="text-sm text-gray-500">{content.fact_en}</p>
      )}
    </div>
  );
}

function NewsContent({ content }) {
  return (
    <div className="space-y-3">
      {content.article_fr && (
        <p className="text-sm text-gray-800 leading-relaxed">
          {content.article_fr.length > 200
            ? content.article_fr.slice(0, 200) + "..."
            : content.article_fr}
        </p>
      )}
      {content.key_vocabulary && content.key_vocabulary.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {content.key_vocabulary.map((v, i) => (
            <span
              key={i}
              className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded"
              title={v.english}
            >
              {v.french}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const CONTENT_RENDERERS = {
  word: WordContent,
  grammar: GrammarContent,
  trivia: TriviaContent,
  news: NewsContent,
};

export default function DiscoverCard({ card, onInteracted }) {
  const [interacted, setInteracted] = useState(card.interacted);
  const [loading, setLoading] = useState(false);

  const style = TYPE_STYLES[card.type] || TYPE_STYLES.trivia;
  const ContentRenderer = CONTENT_RENDERERS[card.type];

  const handleInteract = async () => {
    if (interacted || loading) return;
    setLoading(true);
    try {
      const resp = await interactWithCard(card.id);
      setInteracted(true);
      if (onInteracted) onInteracted(card.id, resp.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-xl border-2 ${style.border} ${style.bg} p-5 flex flex-col gap-3 transition-shadow hover:shadow-md`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded ${style.badge}`}
        >
          {style.icon} {style.label}
        </span>
        {card.seen && (
          <span className="text-xs text-gray-400">Seen</span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900">{card.title}</h3>

      {/* Summary */}
      {card.summary && !ContentRenderer && (
        <p className="text-sm text-gray-600">{card.summary}</p>
      )}

      {/* Type-specific content */}
      {ContentRenderer && <ContentRenderer content={card.content_json} />}

      {/* Interact button */}
      <div className="mt-auto pt-2">
        <button
          onClick={handleInteract}
          disabled={interacted || loading}
          className={`w-full text-sm py-1.5 px-3 rounded-lg font-medium transition-colors ${
            interacted
              ? "bg-gray-200 text-gray-400 cursor-default"
              : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          {interacted ? "+3 XP Earned" : loading ? "..." : "Mark as Reviewed (+3 XP)"}
        </button>
      </div>
    </div>
  );
}
```

### Step 4.3 — Discover page

**File:** `frontend/src/pages/Discover.jsx`

```jsx
import { useState, useEffect } from "react";
import { getFeed, generateMore } from "../api/discover";
import DiscoverCard from "../components/DiscoverCard";

export default function Discover() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const loadFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getFeed();
      setCards(resp.data.results || []);
    } catch {
      setError("Failed to load discover feed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const handleGenerateMore = async () => {
    setGenerating(true);
    try {
      await generateMore();
      await loadFeed(); // reload the full feed
    } catch {
      setError("Failed to generate new cards.");
    } finally {
      setGenerating(false);
    }
  };

  const handleInteracted = (cardId, data) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, interacted: true } : c
      )
    );
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Discover</h1>
        <button
          onClick={handleGenerateMore}
          disabled={generating}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {generating ? "Generating..." : "Generate More"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">
            No discover cards yet. Generate some to get started!
          </p>
          <button
            onClick={handleGenerateMore}
            disabled={generating}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Cards"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <DiscoverCard
              key={card.id}
              card={card}
              onInteracted={handleInteracted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 4.4 — Register the route

**File:** `frontend/src/App.jsx` — add the import and route:

Add import at the top:

```javascript
import Discover from "./pages/Discover";
```

Add route inside the protected `<Route>` block, after the `progress` route:

```jsx
<Route path="discover" element={<Discover />} />
```

Full updated `App.jsx`:

```jsx
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Topics from "./pages/Topics";
import TopicDetail from "./pages/TopicDetail";
import LessonDetail from "./pages/LessonDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Quiz from "./pages/Quiz";
import Dictation from "./pages/Dictation";
import Pronunciation from "./pages/Pronunciation";
import Assistant from "./pages/Assistant";
import Progress from "./pages/Progress";
import Discover from "./pages/Discover";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="topics" element={<Topics />} />
          <Route path="topics/:id" element={<TopicDetail />} />
          <Route path="lesson/:id" element={<LessonDetail />} />
          <Route path="practice/quiz/:lessonId" element={<Quiz />} />
          <Route path="practice/dictation" element={<Dictation />} />
          <Route path="practice/pronunciation" element={<Pronunciation />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="progress" element={<Progress />} />
          <Route path="discover" element={<Discover />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
```

### Step 4.5 — Verify manually

```bash
cd frontend && npm run dev
# Navigate to /discover — should see empty state with "Generate Cards" button
```

### Step 4.6 — Commit

```
git add frontend/src/api/discover.js \
       frontend/src/components/DiscoverCard.jsx \
       frontend/src/pages/Discover.jsx \
       frontend/src/App.jsx
git commit -m "feat(discover): add frontend Discover page with card grid and interactions

Phase 8 Task 4 — card grid with type-specific styling (word, grammar,
trivia, news), Generate More button, interaction tracking with XP display,
and route registration."
```

---

## Task 5: Telegram /news Command

**Goal:** Add a `/news` bot command that sends a random discover card (news or trivia type).

**Why last:** All infrastructure is in place; this is an additional interface.

### Step 5.1 — Write tests (RED)

**File:** `backend/apps/bot/tests/test_news.py`

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.discover.models import DiscoverCard
from apps.bot.handlers.news import get_random_discover_card, news_command

User = get_user_model()


@pytest.fixture
def discover_cards(db):
    now = timezone.now()
    news = DiscoverCard.objects.create(
        type="news",
        title="Les Jeux Olympiques",
        summary="Big sports event in French",
        content_json={
            "article_fr": "Les Jeux Olympiques de 2028 auront lieu a Los Angeles.",
            "article_en": "The 2028 Olympics will take place in Los Angeles.",
            "key_vocabulary": [{"french": "les jeux", "english": "the games"}],
        },
        generated_at=now,
    )
    trivia = DiscoverCard.objects.create(
        type="trivia",
        title="French Tongue Twister",
        summary="A fun fact about French",
        content_json={
            "fact_fr": "Les chaussettes de l'archiduchesse sont-elles seches?",
            "fact_en": "Are the archduchess's socks dry? — a famous French tongue twister.",
        },
        generated_at=now,
    )
    word = DiscoverCard.objects.create(
        type="word",
        title="Bonjour",
        content_json={"french": "bonjour", "english": "hello"},
        generated_at=now,
    )
    return {"news": news, "trivia": trivia, "word": word}


@pytest.mark.django_db
class TestGetRandomDiscoverCard:
    def test_returns_news_or_trivia(self, discover_cards):
        card = get_random_discover_card()
        assert card is not None
        assert card.type in ("news", "trivia")

    def test_returns_none_when_no_matching_cards(self, db):
        # Only word cards exist
        DiscoverCard.objects.create(
            type="word", title="Bonjour", content_json={},
        )
        card = get_random_discover_card()
        assert card is None

    def test_returns_none_when_empty(self, db):
        card = get_random_discover_card()
        assert card is None


@pytest.fixture
def tg_update():
    mock = AsyncMock()
    mock.message = AsyncMock()
    mock.message.reply_text = AsyncMock()
    return mock


@pytest.fixture
def tg_context():
    return MagicMock()


@pytest.mark.django_db
class TestNewsCommand:
    @pytest.mark.asyncio
    @patch("apps.bot.handlers.news.get_random_discover_card")
    async def test_sends_news_card(self, mock_get_card, tg_update, tg_context):
        mock_card = MagicMock()
        mock_card.type = "news"
        mock_card.title = "Les Jeux Olympiques"
        mock_card.summary = "Big sports event"
        mock_card.content_json = {
            "article_fr": "Les Jeux Olympiques de 2028...",
            "article_en": "The 2028 Olympics...",
            "key_vocabulary": [{"french": "les jeux", "english": "the games"}],
        }
        mock_get_card.return_value = mock_card

        await news_command(tg_update, tg_context)

        tg_update.message.reply_text.assert_called_once()
        text = tg_update.message.reply_text.call_args[0][0]
        assert "Les Jeux Olympiques" in text
        assert "Les Jeux Olympiques de 2028" in text

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.news.get_random_discover_card")
    async def test_sends_trivia_card(self, mock_get_card, tg_update, tg_context):
        mock_card = MagicMock()
        mock_card.type = "trivia"
        mock_card.title = "French Fun Fact"
        mock_card.summary = "Interesting fact"
        mock_card.content_json = {
            "fact_fr": "Le francais est parle dans 29 pays.",
            "fact_en": "French is spoken in 29 countries.",
        }
        mock_get_card.return_value = mock_card

        await news_command(tg_update, tg_context)

        tg_update.message.reply_text.assert_called_once()
        text = tg_update.message.reply_text.call_args[0][0]
        assert "French Fun Fact" in text

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.news.get_random_discover_card")
    async def test_handles_no_cards(self, mock_get_card, tg_update, tg_context):
        mock_get_card.return_value = None

        await news_command(tg_update, tg_context)

        tg_update.message.reply_text.assert_called_once()
        text = tg_update.message.reply_text.call_args[0][0]
        assert "No news" in text or "no discover" in text.lower() or "not available" in text.lower()
```

### Step 5.2 — Implement the handler (GREEN)

**File:** `backend/apps/bot/handlers/news.py`

```python
import logging

from telegram import Update
from telegram.ext import ContextTypes

from apps.discover.models import DiscoverCard

logger = logging.getLogger(__name__)


def get_random_discover_card():
    """Return a random news or trivia DiscoverCard, or None."""
    card = DiscoverCard.objects.filter(
        type__in=["news", "trivia"],
    ).order_by("?").first()
    return card


def _format_news_card(card) -> str:
    """Format a news-type card for Telegram."""
    content = card.content_json
    parts = [f"*{card.title}*"]

    if content.get("article_fr"):
        parts.append(f"\n{content['article_fr']}")
    if content.get("article_en"):
        parts.append(f"\n_{content['article_en']}_")
    if content.get("key_vocabulary"):
        vocab_lines = [
            f"  {v['french']} — {v['english']}"
            for v in content["key_vocabulary"][:5]
        ]
        parts.append("\nVocabulary:\n" + "\n".join(vocab_lines))

    return "\n".join(parts)


def _format_trivia_card(card) -> str:
    """Format a trivia-type card for Telegram."""
    content = card.content_json
    parts = [f"*{card.title}*"]

    if content.get("fact_fr"):
        parts.append(f"\n{content['fact_fr']}")
    if content.get("fact_en"):
        parts.append(f"\n_{content['fact_en']}_")

    return "\n".join(parts)


async def news_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /news command — send a random news or trivia card."""
    card = get_random_discover_card()

    if card is None:
        await update.message.reply_text(
            "No news or trivia cards available yet. "
            "Try again after the daily feed has been generated!"
        )
        return

    if card.type == "news":
        text = _format_news_card(card)
    else:
        text = _format_trivia_card(card)

    await update.message.reply_text(text, parse_mode="Markdown")
```

### Step 5.3 — Register the command in the bot

**File:** `backend/apps/bot/bot.py` — add the import and handler registration:

```python
import logging

from django.conf import settings
from telegram.ext import ApplicationBuilder, CommandHandler

from apps.bot.handlers.start import start_command
from apps.bot.handlers.help import help_command
from apps.bot.handlers.word import word_command
from apps.bot.handlers.stats import stats_command
from apps.bot.handlers.news import news_command
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
    application.add_handler(CommandHandler("news", news_command))
    application.add_handler(CommandHandler("stats", stats_command))
    application.add_handler(quiz_conversation_handler())
    application.add_handler(chat_conversation_handler())
    application.add_handler(dictation_conversation_handler())

    logger.info("Telegram bot application configured successfully.")
    return application
```

### Step 5.4 — Run tests, confirm GREEN

```bash
pytest apps/bot/tests/test_news.py -v
```

### Step 5.5 — Commit

```
git add apps/bot/handlers/news.py apps/bot/tests/test_news.py apps/bot/bot.py
git commit -m "feat(discover): add Telegram /news command for news and trivia cards

Phase 8 Task 5 — /news sends a random news or trivia discover card via
Telegram with type-specific formatting. Registered in bot setup."
```

---

## File Inventory

### New files created

| File | Purpose |
|---|---|
| `backend/apps/discover/__init__.py` | App package |
| `backend/apps/discover/apps.py` | App config |
| `backend/apps/discover/models.py` | DiscoverCard, UserDiscoverHistory |
| `backend/apps/discover/admin.py` | Admin registration |
| `backend/apps/discover/services.py` | Card generation (word, grammar, trivia, news) |
| `backend/apps/discover/serializers.py` | DRF serializers |
| `backend/apps/discover/views.py` | Feed, GenerateMore, Interact views |
| `backend/apps/discover/urls.py` | URL config |
| `backend/apps/discover/tasks.py` | Celery task |
| `backend/apps/discover/migrations/__init__.py` | Migrations package |
| `backend/apps/discover/management/__init__.py` | Management package |
| `backend/apps/discover/management/commands/__init__.py` | Commands package |
| `backend/apps/discover/management/commands/generate_feed.py` | Management command |
| `backend/apps/discover/tests/__init__.py` | Tests package |
| `backend/apps/discover/tests/test_models.py` | Model tests |
| `backend/apps/discover/tests/test_services.py` | Service tests (mocked LLM) |
| `backend/apps/discover/tests/test_serializers.py` | Serializer tests |
| `backend/apps/discover/tests/test_views.py` | API endpoint tests |
| `backend/apps/bot/handlers/news.py` | Telegram /news handler |
| `backend/apps/bot/tests/test_news.py` | /news handler tests |
| `frontend/src/api/discover.js` | API client |
| `frontend/src/components/DiscoverCard.jsx` | Card component |
| `frontend/src/pages/Discover.jsx` | Discover page |

### Modified files

| File | Change |
|---|---|
| `backend/config/settings/base.py` | Add `"apps.discover"` to INSTALLED_APPS, add CELERY_BEAT_SCHEDULE |
| `backend/config/urls.py` | Add `api/discover/` URL include |
| `backend/services/llm/prompts.py` | Add `trivia_generator` and `news_generator` system prompts |
| `backend/apps/bot/bot.py` | Import and register `/news` command handler |
| `frontend/src/App.jsx` | Import Discover page, add `/discover` route |

---

## Verification Checklist

After completing all tasks, run:

```bash
# All discover tests
pytest apps/discover/ -v

# Bot news tests
pytest apps/bot/tests/test_news.py -v

# Full test suite (ensure nothing is broken)
pytest --tb=short

# Manual smoke test
python manage.py generate_feed
python manage.py shell -c "from apps.discover.models import DiscoverCard; print(DiscoverCard.objects.count(), 'cards')"
```

Frontend: navigate to `/discover`, verify cards render, click "Generate More", click "Mark as Reviewed" on a card.
