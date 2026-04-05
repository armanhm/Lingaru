# Phase 9 — Advanced Practice: SRS, Mistake Journal, Conjugation Drills

**Date:** 2026-04-05
**Status:** Ready
**Depends on:** Phases 1-8 (all deployed)

## Overview

Add three interconnected features to the `apps/progress` app (new Django app):

1. **SRS (Spaced Repetition)** — SM-2 algorithm applied to vocabulary cards, with due-card review flow
2. **Mistake Journal** — auto-records wrong answers from quizzes, browsable/filterable list
3. **Conjugation Drills** — dedicated verb conjugation practice with tense selection

Frontend adds three new pages. Telegram gets a `/daily` command that sends due SRS cards.

## Architecture Decisions

- New `apps/progress` app owns SRSCard, MistakeEntry (spec says `apps/progress` holds UserProgress, SRS, QuizAttempts, MistakeJournal)
- SRS service is a pure function layer (no Django ORM in the SM-2 math) for easy testing
- Mistake recording hooks into the existing `QuizAnswerView` via a service call (not signals — explicit is better)
- Conjugation drills reuse `content.Question` (type=`conjugation`) but add a dedicated endpoint that filters by verb/tense

## File Map (what gets created/modified)

```
NEW  backend/apps/progress/__init__.py
NEW  backend/apps/progress/apps.py
NEW  backend/apps/progress/models.py          # SRSCard, MistakeEntry
NEW  backend/apps/progress/admin.py
NEW  backend/apps/progress/services.py         # SM-2 logic, mistake recording
NEW  backend/apps/progress/serializers.py
NEW  backend/apps/progress/views.py
NEW  backend/apps/progress/urls.py
NEW  backend/apps/progress/migrations/0001_initial.py  (auto-generated)
NEW  backend/apps/progress/tests/__init__.py
NEW  backend/apps/progress/tests/test_srs_service.py
NEW  backend/apps/progress/tests/test_srs_api.py
NEW  backend/apps/progress/tests/test_mistakes.py
NEW  backend/apps/progress/tests/test_conjugation.py

MOD  backend/config/settings/base.py           # add "apps.progress" to INSTALLED_APPS
MOD  backend/config/urls.py                    # add progress URL include
MOD  backend/apps/practice/views.py            # call record_mistake() on wrong answers
MOD  backend/apps/bot/bot.py                   # register /daily handler
NEW  backend/apps/bot/handlers/daily.py
NEW  backend/apps/bot/tests/test_daily.py

NEW  frontend/src/api/progress.js
NEW  frontend/src/pages/SRSReview.jsx
NEW  frontend/src/pages/MistakeJournal.jsx
NEW  frontend/src/pages/ConjugationDrill.jsx
MOD  frontend/src/App.jsx                      # add 3 routes
```

---

## Task 1 — SRS Model + SM-2 Service (TDD)

**Commit:** `feat(progress): add SRSCard model and SM-2 service with tests`

### 1a. Create the `apps/progress` app scaffold

```python
# backend/apps/progress/__init__.py
# (empty)
```

```python
# backend/apps/progress/apps.py
from django.apps import AppConfig


class ProgressConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.progress"
    verbose_name = "Progress & SRS"
```

### 1b. SRSCard model

```python
# backend/apps/progress/models.py
from django.conf import settings
from django.db import models
from django.utils import timezone


class SRSCard(models.Model):
    """A spaced-repetition card linking a user to a vocabulary item.

    Uses the SM-2 algorithm fields: ease_factor, interval_days,
    repetitions, next_review_at, last_quality.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="srs_cards",
    )
    vocabulary = models.ForeignKey(
        "content.Vocabulary",
        on_delete=models.CASCADE,
        related_name="srs_cards",
    )
    ease_factor = models.FloatField(default=2.5)
    interval_days = models.PositiveIntegerField(default=0)
    next_review_at = models.DateTimeField(default=timezone.now)
    repetitions = models.PositiveIntegerField(default=0)
    last_quality = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "progress_srs_cards"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "vocabulary"],
                name="unique_srs_card_per_user_vocab",
            ),
        ]
        ordering = ["next_review_at"]

    def __str__(self):
        return f"SRS: {self.user.username} — {self.vocabulary.french}"


class MistakeEntry(models.Model):
    """Records a single mistake made by a user during practice."""

    MISTAKE_TYPE_CHOICES = [
        ("gender", "Gender"),
        ("conjugation", "Conjugation"),
        ("preposition", "Preposition"),
        ("spelling", "Spelling"),
        ("other", "Other"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mistakes",
    )
    question = models.ForeignKey(
        "content.Question",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mistakes",
    )
    user_answer = models.TextField()
    correct_answer = models.TextField()
    mistake_type = models.CharField(
        max_length=15,
        choices=MISTAKE_TYPE_CHOICES,
        default="other",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed = models.BooleanField(default=False)

    class Meta:
        db_table = "progress_mistakes"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Mistake: {self.user_answer} (correct: {self.correct_answer})"
```

### 1c. SM-2 service (pure logic + Django wrapper)

```python
# backend/apps/progress/services.py
"""SM-2 spaced repetition service and mistake recording."""

from datetime import timedelta
from typing import Optional

from django.utils import timezone

from apps.content.models import Question
from .models import MistakeEntry, SRSCard


# ---------------------------------------------------------------------------
# SM-2 pure algorithm (no ORM — easy to unit-test)
# ---------------------------------------------------------------------------

def sm2_update(
    quality: int,
    repetitions: int,
    ease_factor: float,
    interval_days: int,
) -> tuple[int, float, int]:
    """Apply one SM-2 review step.

    Args:
        quality: User self-rating 0-5 (0=blackout, 5=perfect).
        repetitions: Current repetition count.
        ease_factor: Current ease factor (>= 1.3).
        interval_days: Current interval in days.

    Returns:
        (new_repetitions, new_ease_factor, new_interval_days)
    """
    if quality < 0 or quality > 5:
        raise ValueError("quality must be 0-5")

    # Update ease factor
    new_ef = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(new_ef, 1.3)

    if quality < 3:
        # Failed — reset
        new_reps = 0
        new_interval = 1
    else:
        new_reps = repetitions + 1
        if new_reps == 1:
            new_interval = 1
        elif new_reps == 2:
            new_interval = 6
        else:
            new_interval = round(interval_days * new_ef)

    return new_reps, new_ef, new_interval


# ---------------------------------------------------------------------------
# Django-level helpers
# ---------------------------------------------------------------------------

def get_due_cards(user, limit: int = 20):
    """Return SRSCards due for review, oldest first."""
    now = timezone.now()
    return (
        SRSCard.objects
        .filter(user=user, next_review_at__lte=now)
        .select_related("vocabulary")[:limit]
    )


def review_card(card: SRSCard, quality: int) -> SRSCard:
    """Apply an SM-2 review to a card and save it."""
    new_reps, new_ef, new_interval = sm2_update(
        quality=quality,
        repetitions=card.repetitions,
        ease_factor=card.ease_factor,
        interval_days=card.interval_days,
    )
    card.repetitions = new_reps
    card.ease_factor = new_ef
    card.interval_days = new_interval
    card.last_quality = quality
    card.next_review_at = timezone.now() + timedelta(days=new_interval)
    card.save()
    return card


def get_or_create_card(user, vocabulary) -> SRSCard:
    """Get or create an SRS card for the user + vocabulary pair."""
    card, _ = SRSCard.objects.get_or_create(
        user=user,
        vocabulary=vocabulary,
        defaults={
            "ease_factor": 2.5,
            "interval_days": 0,
            "repetitions": 0,
            "next_review_at": timezone.now(),
        },
    )
    return card


# ---------------------------------------------------------------------------
# Mistake recording
# ---------------------------------------------------------------------------

def classify_mistake(question: Optional[Question]) -> str:
    """Infer mistake_type from the question type."""
    if question is None:
        return "other"
    mapping = {
        "conjugation": "conjugation",
    }
    return mapping.get(question.type, "other")


def record_mistake(
    user,
    question: Optional[Question],
    user_answer: str,
    correct_answer: str,
    mistake_type: Optional[str] = None,
) -> MistakeEntry:
    """Create a MistakeEntry. Auto-classifies if mistake_type is not given."""
    if mistake_type is None:
        mistake_type = classify_mistake(question)

    return MistakeEntry.objects.create(
        user=user,
        question=question,
        user_answer=user_answer,
        correct_answer=correct_answer,
        mistake_type=mistake_type,
    )
```

### 1d. Tests for SM-2 pure logic

```python
# backend/apps/progress/tests/__init__.py
# (empty)
```

```python
# backend/apps/progress/tests/test_srs_service.py
import pytest
from apps.progress.services import sm2_update


class TestSM2Update:
    """Unit tests for the pure SM-2 algorithm."""

    def test_perfect_first_review(self):
        reps, ef, interval = sm2_update(
            quality=5, repetitions=0, ease_factor=2.5, interval_days=0,
        )
        assert reps == 1
        assert interval == 1
        assert ef == pytest.approx(2.6, abs=0.01)

    def test_perfect_second_review(self):
        reps, ef, interval = sm2_update(
            quality=5, repetitions=1, ease_factor=2.6, interval_days=1,
        )
        assert reps == 2
        assert interval == 6
        assert ef >= 2.6

    def test_perfect_third_review(self):
        reps, ef, interval = sm2_update(
            quality=5, repetitions=2, ease_factor=2.6, interval_days=6,
        )
        assert reps == 3
        assert interval == round(6 * ef)

    def test_failed_review_resets(self):
        reps, ef, interval = sm2_update(
            quality=1, repetitions=5, ease_factor=2.5, interval_days=30,
        )
        assert reps == 0
        assert interval == 1

    def test_quality_3_passes(self):
        reps, ef, interval = sm2_update(
            quality=3, repetitions=0, ease_factor=2.5, interval_days=0,
        )
        assert reps == 1
        assert interval == 1

    def test_ease_factor_never_below_1_3(self):
        reps, ef, interval = sm2_update(
            quality=0, repetitions=3, ease_factor=1.3, interval_days=10,
        )
        assert ef >= 1.3

    def test_invalid_quality_raises(self):
        with pytest.raises(ValueError):
            sm2_update(quality=6, repetitions=0, ease_factor=2.5, interval_days=0)

        with pytest.raises(ValueError):
            sm2_update(quality=-1, repetitions=0, ease_factor=2.5, interval_days=0)

    def test_interval_increases_with_repetitions(self):
        """Multiple perfect reviews should yield increasing intervals."""
        reps, ef, interval = 0, 2.5, 0
        intervals = []
        for _ in range(5):
            reps, ef, interval = sm2_update(
                quality=5, repetitions=reps, ease_factor=ef, interval_days=interval,
            )
            intervals.append(interval)
        # Intervals: 1, 6, ~16, ~42, ~110 — strictly increasing
        assert intervals == sorted(intervals)
        assert intervals[-1] > 30  # should be well over a month after 5 perfect reviews
```

### 1e. Register app

Add `"apps.progress"` to `INSTALLED_APPS` in `backend/config/settings/base.py` (after `"apps.discover"`).

### 1f. Generate migration

```bash
cd backend && python manage.py makemigrations progress
```

### 1g. Run tests

```bash
cd backend && pytest apps/progress/tests/test_srs_service.py -v
```

All 8 tests must pass before committing.

---

## Task 2 — SRS API + Mistake Journal API (TDD)

**Commit:** `feat(progress): add SRS review and mistake journal API endpoints`

### 2a. Serializers

```python
# backend/apps/progress/serializers.py
from rest_framework import serializers
from .models import MistakeEntry, SRSCard


class SRSCardSerializer(serializers.ModelSerializer):
    french = serializers.CharField(source="vocabulary.french", read_only=True)
    english = serializers.CharField(source="vocabulary.english", read_only=True)
    pronunciation = serializers.CharField(source="vocabulary.pronunciation", read_only=True)
    example_sentence = serializers.CharField(source="vocabulary.example_sentence", read_only=True)

    class Meta:
        model = SRSCard
        fields = (
            "id", "french", "english", "pronunciation", "example_sentence",
            "ease_factor", "interval_days", "next_review_at",
            "repetitions", "last_quality",
        )
        read_only_fields = fields


class SRSReviewSerializer(serializers.Serializer):
    card_id = serializers.IntegerField()
    quality = serializers.IntegerField(min_value=0, max_value=5)


class MistakeEntrySerializer(serializers.ModelSerializer):
    question_prompt = serializers.CharField(
        source="question.prompt", read_only=True, default=None,
    )

    class Meta:
        model = MistakeEntry
        fields = (
            "id", "question_prompt", "user_answer", "correct_answer",
            "mistake_type", "created_at", "reviewed",
        )
        read_only_fields = fields


class MistakeMarkReviewedSerializer(serializers.Serializer):
    mistake_ids = serializers.ListField(
        child=serializers.IntegerField(), min_length=1, max_length=100,
    )
```

### 2b. Views

```python
# backend/apps/progress/views.py
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.gamification.services import award_xp, check_streak
from .models import MistakeEntry, SRSCard
from .serializers import (
    MistakeEntrySerializer,
    MistakeMarkReviewedSerializer,
    SRSCardSerializer,
    SRSReviewSerializer,
)
from .services import get_due_cards, review_card


class SRSDueCardsView(APIView):
    """GET /api/progress/srs/due/ — return cards due for review."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        limit = int(request.query_params.get("limit", 20))
        cards = get_due_cards(request.user, limit=min(limit, 50))
        serializer = SRSCardSerializer(cards, many=True)
        return Response({"cards": serializer.data, "count": len(serializer.data)})


class SRSReviewView(APIView):
    """POST /api/progress/srs/review/ — submit review result for one card."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = SRSReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        card_id = serializer.validated_data["card_id"]
        quality = serializer.validated_data["quality"]

        try:
            card = SRSCard.objects.get(pk=card_id, user=request.user)
        except SRSCard.DoesNotExist:
            return Response(
                {"detail": "Card not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        updated_card = review_card(card, quality)

        # Award XP for SRS review session (10 XP per session, deduplicated per card)
        award_xp(
            request.user,
            activity_type="srs_review",
            xp_amount=10,
            source_id=f"srs_card_{card.id}_{card.repetitions}",
        )
        check_streak(request.user)

        return Response(SRSCardSerializer(updated_card).data)


class MistakeListView(generics.ListAPIView):
    """GET /api/progress/mistakes/ — paginated mistake journal with filtering."""

    serializer_class = MistakeEntrySerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        qs = MistakeEntry.objects.filter(
            user=self.request.user,
        ).select_related("question")

        # Optional filters
        mistake_type = self.request.query_params.get("type")
        if mistake_type:
            qs = qs.filter(mistake_type=mistake_type)

        reviewed = self.request.query_params.get("reviewed")
        if reviewed is not None:
            qs = qs.filter(reviewed=reviewed.lower() == "true")

        return qs


class MistakeMarkReviewedView(APIView):
    """POST /api/progress/mistakes/reviewed/ — mark mistakes as reviewed."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = MistakeMarkReviewedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ids = serializer.validated_data["mistake_ids"]
        updated = MistakeEntry.objects.filter(
            user=request.user, id__in=ids,
        ).update(reviewed=True)

        return Response({"updated": updated})
```

### 2c. URLs

```python
# backend/apps/progress/urls.py
from django.urls import path
from . import views

app_name = "progress"

urlpatterns = [
    path("srs/due/", views.SRSDueCardsView.as_view(), name="srs-due"),
    path("srs/review/", views.SRSReviewView.as_view(), name="srs-review"),
    path("mistakes/", views.MistakeListView.as_view(), name="mistake-list"),
    path("mistakes/reviewed/", views.MistakeMarkReviewedView.as_view(), name="mistake-mark-reviewed"),
]
```

### 2d. Register URL in config/urls.py

Add to `urlpatterns`:
```python
path("api/progress/", include("apps.progress.urls")),
```

### 2e. Admin

```python
# backend/apps/progress/admin.py
from django.contrib import admin
from .models import MistakeEntry, SRSCard


@admin.register(SRSCard)
class SRSCardAdmin(admin.ModelAdmin):
    list_display = ("user", "vocabulary", "ease_factor", "interval_days", "next_review_at", "repetitions")
    list_filter = ("user",)
    raw_id_fields = ("user", "vocabulary")


@admin.register(MistakeEntry)
class MistakeEntryAdmin(admin.ModelAdmin):
    list_display = ("user", "user_answer", "correct_answer", "mistake_type", "created_at", "reviewed")
    list_filter = ("mistake_type", "reviewed")
    raw_id_fields = ("user", "question")
```

### 2f. Hook mistake recording into QuizAnswerView

Modify `backend/apps/practice/views.py` — in `QuizAnswerView.post`, after `QuizAnswer.objects.create(...)`:

```python
# --- after line: answer = QuizAnswer.objects.create(...) ---
# Record mistake if wrong
if not is_correct:
    from apps.progress.services import record_mistake
    record_mistake(
        user=request.user,
        question=question,
        user_answer=user_answer,
        correct_answer=question.correct_answer,
    )
```

### 2g. Tests for SRS API

```python
# backend/apps/progress/tests/test_srs_api.py
import pytest
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from apps.content.models import Topic, Lesson, Vocabulary
from apps.progress.models import SRSCard

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="srsuser", email="srs@example.com", password="testpass123!",
    )


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def vocab_item(db):
    topic = Topic.objects.create(
        name_fr="Nourriture", name_en="Food",
        description="Food vocab", icon="fork", order=1, difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic, type="vocab", title="Fruits",
        content={}, order=1, difficulty=1,
    )
    return Vocabulary.objects.create(
        lesson=lesson, french="pomme", english="apple",
        pronunciation="/pɔm/", example_sentence="Je mange une pomme.",
        gender="f", part_of_speech="noun",
    )


@pytest.fixture
def due_card(user, vocab_item):
    return SRSCard.objects.create(
        user=user,
        vocabulary=vocab_item,
        ease_factor=2.5,
        interval_days=0,
        repetitions=0,
        next_review_at=timezone.now() - timedelta(hours=1),
    )


@pytest.mark.django_db
class TestSRSDueCards:
    def test_returns_due_cards(self, authenticated_client, due_card):
        response = authenticated_client.get("/api/progress/srs/due/")
        assert response.status_code == 200
        assert response.data["count"] == 1
        assert response.data["cards"][0]["french"] == "pomme"

    def test_excludes_future_cards(self, authenticated_client, user, vocab_item):
        SRSCard.objects.create(
            user=user, vocabulary=vocab_item,
            next_review_at=timezone.now() + timedelta(days=5),
        )
        response = authenticated_client.get("/api/progress/srs/due/")
        assert response.data["count"] == 0

    def test_unauthenticated_rejected(self, api_client):
        response = api_client.get("/api/progress/srs/due/")
        assert response.status_code == 401


@pytest.mark.django_db
class TestSRSReview:
    def test_review_updates_card(self, authenticated_client, due_card):
        response = authenticated_client.post(
            "/api/progress/srs/review/",
            {"card_id": due_card.id, "quality": 5},
            format="json",
        )
        assert response.status_code == 200
        due_card.refresh_from_db()
        assert due_card.repetitions == 1
        assert due_card.interval_days == 1
        assert due_card.last_quality == 5

    def test_review_invalid_quality(self, authenticated_client, due_card):
        response = authenticated_client.post(
            "/api/progress/srs/review/",
            {"card_id": due_card.id, "quality": 7},
            format="json",
        )
        assert response.status_code == 400

    def test_review_card_not_found(self, authenticated_client):
        response = authenticated_client.post(
            "/api/progress/srs/review/",
            {"card_id": 9999, "quality": 4},
            format="json",
        )
        assert response.status_code == 404
```

### 2h. Tests for Mistake Journal API

```python
# backend/apps/progress/tests/test_mistakes.py
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.content.models import Topic, Lesson, Question
from apps.progress.models import MistakeEntry

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="mistakeuser", email="mistakes@example.com", password="testpass123!",
    )


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def sample_mistakes(user, db):
    topic = Topic.objects.create(
        name_fr="Grammaire", name_en="Grammar",
        description="", icon="book", order=1, difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic, type="grammar", title="Les articles",
        content={}, order=1, difficulty=1,
    )
    q = Question.objects.create(
        lesson=lesson, type="fill_blank", prompt="__ chat est noir.",
        correct_answer="Le", wrong_answers=[], explanation="Le = masculine article.",
        difficulty=1,
    )
    m1 = MistakeEntry.objects.create(
        user=user, question=q, user_answer="La",
        correct_answer="Le", mistake_type="gender",
    )
    m2 = MistakeEntry.objects.create(
        user=user, question=q, user_answer="Les",
        correct_answer="Le", mistake_type="gender",
    )
    m3 = MistakeEntry.objects.create(
        user=user, question=None, user_answer="mangez",
        correct_answer="mange", mistake_type="conjugation",
    )
    return [m1, m2, m3]


@pytest.mark.django_db
class TestMistakeList:
    def test_lists_all_mistakes(self, authenticated_client, sample_mistakes):
        response = authenticated_client.get("/api/progress/mistakes/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 3

    def test_filter_by_type(self, authenticated_client, sample_mistakes):
        response = authenticated_client.get("/api/progress/mistakes/?type=conjugation")
        assert len(response.data["results"]) == 1

    def test_filter_by_reviewed(self, authenticated_client, sample_mistakes):
        response = authenticated_client.get("/api/progress/mistakes/?reviewed=false")
        assert len(response.data["results"]) == 3


@pytest.mark.django_db
class TestMistakeMarkReviewed:
    def test_mark_reviewed(self, authenticated_client, sample_mistakes):
        ids = [m.id for m in sample_mistakes[:2]]
        response = authenticated_client.post(
            "/api/progress/mistakes/reviewed/",
            {"mistake_ids": ids},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["updated"] == 2
        assert MistakeEntry.objects.filter(reviewed=True).count() == 2


@pytest.mark.django_db
class TestMistakeAutoRecording:
    """Verify that wrong quiz answers create MistakeEntry records."""

    def test_wrong_answer_creates_mistake(self, authenticated_client, user):
        topic = Topic.objects.create(
            name_fr="Test", name_en="Test",
            description="", icon="t", order=1, difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic, type="vocab", title="Test Lesson",
            content={}, order=1, difficulty=1,
        )
        question = Question.objects.create(
            lesson=lesson, type="mcq", prompt="What is bonjour?",
            correct_answer="hello", wrong_answers=["bye", "thanks", "please"],
            explanation="Bonjour = hello.", difficulty=1,
        )
        # Start quiz
        resp = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": lesson.id},
            format="json",
        )
        session_id = resp.data["session_id"]

        # Submit wrong answer
        authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": question.id, "answer": "bye"},
            format="json",
        )

        assert MistakeEntry.objects.filter(user=user).count() == 1
        mistake = MistakeEntry.objects.first()
        assert mistake.user_answer == "bye"
        assert mistake.correct_answer == "hello"
        assert mistake.question == question
```

### 2i. Run all tests

```bash
cd backend && pytest apps/progress/tests/ -v
```

All tests must pass before committing.

---

## Task 3 — Conjugation Drills (TDD)

**Commit:** `feat(progress): add conjugation drill endpoint and seed data`

### 3a. Conjugation check view

Add to `backend/apps/progress/views.py`:

```python
class ConjugationCheckView(APIView):
    """POST /api/progress/conjugation/check/ — check a conjugation answer.

    Request body: { "verb": "manger", "tense": "present", "subject": "je", "answer": "mange" }
    """

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        verb = request.data.get("verb", "").strip()
        tense = request.data.get("tense", "").strip()
        subject = request.data.get("subject", "").strip()
        answer = request.data.get("answer", "").strip()

        if not all([verb, tense, subject, answer]):
            return Response(
                {"detail": "verb, tense, subject, and answer are all required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Look up the correct conjugation from Question records (type=conjugation)
        # Prompt format: "Conjugate {verb} ({tense}, {subject})"
        question = Question.objects.filter(
            type="conjugation",
            prompt__icontains=verb,
            prompt__icontains=tense,
            prompt__icontains=subject,
        ).first()

        if question is None:
            return Response(
                {"detail": "No conjugation data found for this combination."},
                status=status.HTTP_404_NOT_FOUND,
            )

        is_correct = answer.lower() == question.correct_answer.strip().lower()

        if not is_correct:
            from apps.progress.services import record_mistake
            record_mistake(
                user=request.user,
                question=question,
                user_answer=answer,
                correct_answer=question.correct_answer,
                mistake_type="conjugation",
            )

        # Award XP for conjugation drill
        if is_correct:
            award_xp(
                request.user,
                activity_type="conjugation_drill",
                xp_amount=10,
                source_id=f"conjugation_{question.id}",
            )
            check_streak(request.user)

        return Response({
            "is_correct": is_correct,
            "correct_answer": question.correct_answer,
            "explanation": question.explanation,
        })


class ConjugationListView(APIView):
    """GET /api/progress/conjugation/verbs/ — available verbs and tenses."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        from apps.content.models import Question
        from django.db.models import Count

        questions = Question.objects.filter(type="conjugation")

        # Extract unique verbs from prompts (format: "Conjugate {verb} (...)")
        # Return a structured list
        verbs = set()
        tenses = set()
        for q in questions.values_list("prompt", flat=True):
            # Expected prompt format: "Conjugate manger (present, je)"
            parts = q.split("(")
            if len(parts) >= 2:
                verb_part = parts[0].replace("Conjugate", "").strip()
                tense_part = parts[1].split(",")[0].strip().rstrip(")")
                verbs.add(verb_part)
                tenses.add(tense_part)

        return Response({
            "verbs": sorted(verbs),
            "tenses": sorted(tenses),
        })
```

### 3b. Add URL routes

Add to `backend/apps/progress/urls.py`:
```python
path("conjugation/check/", views.ConjugationCheckView.as_view(), name="conjugation-check"),
path("conjugation/verbs/", views.ConjugationListView.as_view(), name="conjugation-verbs"),
```

Add import at top of views.py:
```python
from apps.content.models import Question
```

### 3c. Seed data management command

```python
# backend/apps/progress/management/__init__.py
# (empty)

# backend/apps/progress/management/commands/__init__.py
# (empty)

# backend/apps/progress/management/commands/seed_conjugations.py
"""Seed conjugation questions for common French verbs."""

from django.core.management.base import BaseCommand
from apps.content.models import Lesson, Question, Topic


CONJUGATIONS = {
    "avoir": {
        "present": {
            "j'": "ai", "tu": "as", "il/elle": "a",
            "nous": "avons", "vous": "avez", "ils/elles": "ont",
        },
        "passe_compose": {
            "j'": "ai eu", "tu": "as eu", "il/elle": "a eu",
            "nous": "avons eu", "vous": "avez eu", "ils/elles": "ont eu",
        },
        "imparfait": {
            "j'": "avais", "tu": "avais", "il/elle": "avait",
            "nous": "avions", "vous": "aviez", "ils/elles": "avaient",
        },
    },
    "etre": {
        "present": {
            "je": "suis", "tu": "es", "il/elle": "est",
            "nous": "sommes", "vous": "etes", "ils/elles": "sont",
        },
        "passe_compose": {
            "j'": "ai ete", "tu": "as ete", "il/elle": "a ete",
            "nous": "avons ete", "vous": "avez ete", "ils/elles": "ont ete",
        },
        "imparfait": {
            "j'": "etais", "tu": "etais", "il/elle": "etait",
            "nous": "etions", "vous": "etiez", "ils/elles": "etaient",
        },
    },
    "manger": {
        "present": {
            "je": "mange", "tu": "manges", "il/elle": "mange",
            "nous": "mangeons", "vous": "mangez", "ils/elles": "mangent",
        },
        "passe_compose": {
            "j'": "ai mange", "tu": "as mange", "il/elle": "a mange",
            "nous": "avons mange", "vous": "avez mange", "ils/elles": "ont mange",
        },
        "imparfait": {
            "je": "mangeais", "tu": "mangeais", "il/elle": "mangeait",
            "nous": "mangions", "vous": "mangiez", "ils/elles": "mangeaient",
        },
    },
    "faire": {
        "present": {
            "je": "fais", "tu": "fais", "il/elle": "fait",
            "nous": "faisons", "vous": "faites", "ils/elles": "font",
        },
        "passe_compose": {
            "j'": "ai fait", "tu": "as fait", "il/elle": "a fait",
            "nous": "avons fait", "vous": "avez fait", "ils/elles": "ont fait",
        },
        "imparfait": {
            "je": "faisais", "tu": "faisais", "il/elle": "faisait",
            "nous": "faisions", "vous": "faisiez", "ils/elles": "faisaient",
        },
    },
    "aller": {
        "present": {
            "je": "vais", "tu": "vas", "il/elle": "va",
            "nous": "allons", "vous": "allez", "ils/elles": "vont",
        },
        "passe_compose": {
            "je": "suis alle", "tu": "es alle", "il/elle": "est alle",
            "nous": "sommes alles", "vous": "etes alles", "ils/elles": "sont alles",
        },
        "imparfait": {
            "j'": "allais", "tu": "allais", "il/elle": "allait",
            "nous": "allions", "vous": "alliez", "ils/elles": "allaient",
        },
    },
}


class Command(BaseCommand):
    help = "Seed conjugation drill questions for common French verbs."

    def handle(self, *args, **options):
        topic, _ = Topic.objects.get_or_create(
            name_fr="Conjugaison",
            defaults={
                "name_en": "Conjugation",
                "description": "French verb conjugation drills",
                "icon": "pen",
                "order": 100,
                "difficulty_level": 2,
            },
        )
        lesson, _ = Lesson.objects.get_or_create(
            topic=topic,
            title="Verb Conjugation Drills",
            defaults={"type": "grammar", "content": {}, "order": 1, "difficulty": 2},
        )

        created = 0
        for verb, tenses in CONJUGATIONS.items():
            for tense, subjects in tenses.items():
                for subject, answer in subjects.items():
                    prompt = f"Conjugate {verb} ({tense}, {subject})"
                    _, is_new = Question.objects.get_or_create(
                        lesson=lesson,
                        type="conjugation",
                        prompt=prompt,
                        defaults={
                            "correct_answer": answer,
                            "wrong_answers": [],
                            "explanation": f"{subject} {answer} ({verb}, {tense})",
                            "difficulty": 2,
                        },
                    )
                    if is_new:
                        created += 1

        self.stdout.write(self.style.SUCCESS(f"Created {created} conjugation questions."))
```

### 3d. Tests for conjugation drill

```python
# backend/apps/progress/tests/test_conjugation.py
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.content.models import Topic, Lesson, Question
from apps.progress.models import MistakeEntry

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="conjuser", email="conj@example.com", password="testpass123!",
    )


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def conjugation_questions(db):
    topic = Topic.objects.create(
        name_fr="Conjugaison", name_en="Conjugation",
        description="", icon="pen", order=1, difficulty_level=2,
    )
    lesson = Lesson.objects.create(
        topic=topic, type="grammar", title="Verb Drills",
        content={}, order=1, difficulty=2,
    )
    q1 = Question.objects.create(
        lesson=lesson, type="conjugation",
        prompt="Conjugate manger (present, je)",
        correct_answer="mange", wrong_answers=[],
        explanation="je mange (manger, present)", difficulty=2,
    )
    q2 = Question.objects.create(
        lesson=lesson, type="conjugation",
        prompt="Conjugate avoir (present, nous)",
        correct_answer="avons", wrong_answers=[],
        explanation="nous avons (avoir, present)", difficulty=2,
    )
    return [q1, q2]


@pytest.mark.django_db
class TestConjugationCheck:
    def test_correct_answer(self, authenticated_client, conjugation_questions):
        response = authenticated_client.post(
            "/api/progress/conjugation/check/",
            {"verb": "manger", "tense": "present", "subject": "je", "answer": "mange"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["is_correct"] is True

    def test_wrong_answer(self, authenticated_client, conjugation_questions, user):
        response = authenticated_client.post(
            "/api/progress/conjugation/check/",
            {"verb": "manger", "tense": "present", "subject": "je", "answer": "mangez"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["is_correct"] is False
        assert response.data["correct_answer"] == "mange"
        # Should auto-record mistake
        assert MistakeEntry.objects.filter(user=user, mistake_type="conjugation").count() == 1

    def test_missing_fields(self, authenticated_client, conjugation_questions):
        response = authenticated_client.post(
            "/api/progress/conjugation/check/",
            {"verb": "manger"},
            format="json",
        )
        assert response.status_code == 400

    def test_unknown_verb(self, authenticated_client, conjugation_questions):
        response = authenticated_client.post(
            "/api/progress/conjugation/check/",
            {"verb": "dormir", "tense": "present", "subject": "je", "answer": "dors"},
            format="json",
        )
        assert response.status_code == 404


@pytest.mark.django_db
class TestConjugationList:
    def test_returns_verbs_and_tenses(self, authenticated_client, conjugation_questions):
        response = authenticated_client.get("/api/progress/conjugation/verbs/")
        assert response.status_code == 200
        assert "manger" in response.data["verbs"]
        assert "avoir" in response.data["verbs"]
        assert "present" in response.data["tenses"]
```

### 3e. Run all tests, then seed data

```bash
cd backend && pytest apps/progress/tests/test_conjugation.py -v
cd backend && python manage.py seed_conjugations
```

---

## Task 4 — Frontend Pages

**Commit:** `feat(frontend): add SRS review, mistake journal, and conjugation drill pages`

### 4a. API module

```javascript
// frontend/src/api/progress.js
import client from "./client";

export const getSRSDueCards = (limit = 20) =>
  client.get("/progress/srs/due/", { params: { limit } });

export const submitSRSReview = (cardId, quality) =>
  client.post("/progress/srs/review/", { card_id: cardId, quality });

export const getMistakes = (params = {}) =>
  client.get("/progress/mistakes/", { params });

export const markMistakesReviewed = (mistakeIds) =>
  client.post("/progress/mistakes/reviewed/", { mistake_ids: mistakeIds });

export const getConjugationVerbs = () =>
  client.get("/progress/conjugation/verbs/");

export const checkConjugation = (verb, tense, subject, answer) =>
  client.post("/progress/conjugation/check/", { verb, tense, subject, answer });
```

### 4b. SRS Review page

```jsx
// frontend/src/pages/SRSReview.jsx
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { getSRSDueCards, submitSRSReview } from "../api/progress";

const QUALITY_OPTIONS = [
  { value: 0, label: "Blackout", color: "bg-red-600" },
  { value: 1, label: "Wrong", color: "bg-red-400" },
  { value: 2, label: "Hard", color: "bg-orange-400" },
  { value: 3, label: "Okay", color: "bg-yellow-400" },
  { value: 4, label: "Good", color: "bg-green-400" },
  { value: 5, label: "Easy", color: "bg-green-600" },
];

export default function SRSReview() {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getSRSDueCards()
      .then((res) => {
        setCards(res.data.cards);
        if (res.data.count === 0) setDone(true);
      })
      .catch((err) => setError(err.response?.data?.detail || "Failed to load cards."))
      .finally(() => setLoading(false));
  }, []);

  const handleRate = useCallback(
    async (quality) => {
      const card = cards[currentIndex];
      try {
        await submitSRSReview(card.id, quality);
        setReviewedCount((prev) => prev + 1);
        setShowAnswer(false);
        if (currentIndex + 1 < cards.length) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          setDone(true);
        }
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to submit review.");
      }
    },
    [cards, currentIndex]
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          {reviewedCount > 0 ? "Session Complete!" : "All Caught Up!"}
        </h2>
        <p className="text-gray-600 mb-6">
          {reviewedCount > 0
            ? `You reviewed ${reviewedCount} card${reviewedCount !== 1 ? "s" : ""}.`
            : "No cards are due for review right now."}
        </p>
        <Link
          to="/"
          className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const card = cards[currentIndex];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">SRS Review</h1>
        <span className="text-sm text-gray-500">
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-8 text-center mb-6">
        <p className="text-3xl font-bold text-gray-900 mb-2">{card.french}</p>
        {card.pronunciation && (
          <p className="text-sm text-gray-400 mb-4">{card.pronunciation}</p>
        )}

        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="mt-6 px-8 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
          >
            Show Answer
          </button>
        ) : (
          <div className="mt-6">
            <p className="text-xl text-gray-700 mb-2">{card.english}</p>
            {card.example_sentence && (
              <p className="text-sm text-gray-500 italic mb-6">
                {card.example_sentence}
              </p>
            )}
            <p className="text-sm text-gray-500 mb-3">How well did you know this?</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {QUALITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleRate(opt.value)}
                  className={`${opt.color} text-white py-2 px-3 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-primary-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${(reviewedCount / cards.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
```

### 4c. Mistake Journal page

```jsx
// frontend/src/pages/MistakeJournal.jsx
import { useEffect, useState } from "react";
import { getMistakes, markMistakesReviewed } from "../api/progress";

const TYPE_LABELS = {
  gender: "Gender",
  conjugation: "Conjugation",
  preposition: "Preposition",
  spelling: "Spelling",
  other: "Other",
};

export default function MistakeJournal() {
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: "", reviewed: "" });
  const [selected, setSelected] = useState(new Set());

  const fetchMistakes = (params = {}) => {
    setLoading(true);
    const query = {};
    if (params.type || filter.type) query.type = params.type || filter.type;
    if ((params.reviewed ?? filter.reviewed) !== "")
      query.reviewed = params.reviewed ?? filter.reviewed;

    getMistakes(query)
      .then((res) => setMistakes(res.data.results || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMistakes();
  }, []);

  const handleFilterChange = (key, value) => {
    const newFilter = { ...filter, [key]: value };
    setFilter(newFilter);
    fetchMistakes(newFilter);
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleMarkReviewed = async () => {
    if (selected.size === 0) return;
    await markMistakesReviewed([...selected]);
    setSelected(new Set());
    fetchMistakes();
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mistake Journal</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filter.type}
          onChange={(e) => handleFilterChange("type", e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filter.reviewed}
          onChange={(e) => handleFilterChange("reviewed", e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All</option>
          <option value="false">Not reviewed</option>
          <option value="true">Reviewed</option>
        </select>

        {selected.size > 0 && (
          <button
            onClick={handleMarkReviewed}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Mark {selected.size} as reviewed
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : mistakes.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No mistakes found. Keep practicing!</p>
      ) : (
        <div className="space-y-3">
          {mistakes.map((m) => (
            <div
              key={m.id}
              className={`bg-white rounded-xl border p-4 flex items-start gap-3 ${
                m.reviewed ? "opacity-60" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggleSelect(m.id)}
                className="mt-1 h-4 w-4 text-primary-600 rounded"
              />
              <div className="flex-1">
                {m.question_prompt && (
                  <p className="text-sm text-gray-500 mb-1">{m.question_prompt}</p>
                )}
                <p className="text-red-600 font-medium">
                  Your answer: <span className="line-through">{m.user_answer}</span>
                </p>
                <p className="text-green-700 font-medium">
                  Correct: {m.correct_answer}
                </p>
              </div>
              <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                {TYPE_LABELS[m.mistake_type] || m.mistake_type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 4d. Conjugation Drill page

```jsx
// frontend/src/pages/ConjugationDrill.jsx
import { useEffect, useState, useCallback } from "react";
import { getConjugationVerbs, checkConjugation } from "../api/progress";

export default function ConjugationDrill() {
  const [verbs, setVerbs] = useState([]);
  const [tenses, setTenses] = useState([]);
  const [selectedVerb, setSelectedVerb] = useState("");
  const [selectedTense, setSelectedTense] = useState("");
  const [loading, setLoading] = useState(true);

  // Drill state
  const SUBJECTS = ["je", "tu", "il/elle", "nous", "vous", "ils/elles"];
  const [currentSubjectIndex, setCurrentSubjectIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [results, setResults] = useState([]);
  const [drilling, setDrilling] = useState(false);

  useEffect(() => {
    getConjugationVerbs()
      .then((res) => {
        setVerbs(res.data.verbs);
        setTenses(res.data.tenses);
        if (res.data.verbs.length > 0) setSelectedVerb(res.data.verbs[0]);
        if (res.data.tenses.length > 0) setSelectedTense(res.data.tenses[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  const startDrill = () => {
    setDrilling(true);
    setCurrentSubjectIndex(0);
    setResults([]);
    setFeedback(null);
    setAnswer("");
  };

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!answer.trim()) return;

      const subject = SUBJECTS[currentSubjectIndex];
      try {
        const res = await checkConjugation(
          selectedVerb, selectedTense, subject, answer.trim()
        );
        setFeedback(res.data);
        setResults((prev) => [
          ...prev,
          { subject, answer: answer.trim(), ...res.data },
        ]);
      } catch (err) {
        setFeedback({
          is_correct: false,
          correct_answer: "N/A",
          explanation: err.response?.data?.detail || "Error checking answer.",
        });
      }
    },
    [answer, currentSubjectIndex, selectedVerb, selectedTense]
  );

  const handleNext = () => {
    setFeedback(null);
    setAnswer("");
    if (currentSubjectIndex + 1 < SUBJECTS.length) {
      setCurrentSubjectIndex((prev) => prev + 1);
    } else {
      setDrilling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!drilling && results.length > 0) {
    const correct = results.filter((r) => r.is_correct).length;
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Conjugation Results: {selectedVerb} ({selectedTense})
        </h1>
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <p className="text-3xl font-bold text-center mb-4">
            {correct}/{results.length}
          </p>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex justify-between p-3 rounded-lg ${
                  r.is_correct ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <span className="font-medium">{r.subject}</span>
                <span>
                  {r.is_correct ? (
                    <span className="text-green-700">{r.answer}</span>
                  ) : (
                    <>
                      <span className="text-red-600 line-through mr-2">{r.answer}</span>
                      <span className="text-green-700">{r.correct_answer}</span>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={startDrill}
          className="w-full px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!drilling) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Conjugation Drill</h1>
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verb</label>
              <select
                value={selectedVerb}
                onChange={(e) => setSelectedVerb(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {verbs.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tense</label>
              <select
                value={selectedTense}
                onChange={(e) => setSelectedTense(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {tenses.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={startDrill}
            disabled={!selectedVerb || !selectedTense}
            className="w-full px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            Start Drill
          </button>
        </div>
      </div>
    );
  }

  const subject = SUBJECTS[currentSubjectIndex];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {selectedVerb} — {selectedTense}
        </h1>
        <span className="text-sm text-gray-500">
          {currentSubjectIndex + 1} / {SUBJECTS.length}
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <p className="text-2xl font-bold text-gray-900 mb-6">
          {subject} ________
        </p>

        {!feedback ? (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type the conjugation..."
              autoFocus
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg text-center focus:border-primary-500 focus:ring-0 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!answer.trim()}
              className="mt-4 w-full px-8 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              Check
            </button>
          </form>
        ) : (
          <div>
            <div
              className={`p-4 rounded-xl border-2 mb-4 ${
                feedback.is_correct
                  ? "bg-green-50 border-green-300"
                  : "bg-red-50 border-red-300"
              }`}
            >
              <p className={`font-bold ${feedback.is_correct ? "text-green-800" : "text-red-800"}`}>
                {feedback.is_correct ? "Correct!" : "Incorrect"}
              </p>
              {!feedback.is_correct && (
                <p className="text-sm text-red-700 mt-1">
                  Correct answer: <strong>{feedback.correct_answer}</strong>
                </p>
              )}
            </div>
            <button
              onClick={handleNext}
              className="w-full px-8 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
            >
              {currentSubjectIndex + 1 < SUBJECTS.length ? "Next" : "See Results"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 4e. Add routes to App.jsx

Add imports:
```jsx
import SRSReview from "./pages/SRSReview";
import MistakeJournal from "./pages/MistakeJournal";
import ConjugationDrill from "./pages/ConjugationDrill";
```

Add routes inside the protected `<Route>` block (after the `discover` route):
```jsx
<Route path="practice/srs" element={<SRSReview />} />
<Route path="practice/conjugation" element={<ConjugationDrill />} />
<Route path="progress/mistakes" element={<MistakeJournal />} />
```

---

## Task 5 — Telegram /daily Command

**Commit:** `feat(bot): add /daily command for SRS review cards`

### 5a. Handler

```python
# backend/apps/bot/handlers/daily.py
import logging

from telegram import Update
from telegram.ext import ContextTypes

from apps.users.models import User
from apps.progress.services import get_due_cards

logger = logging.getLogger(__name__)


async def daily_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /daily — send the user's due SRS review cards."""
    telegram_id = update.effective_user.id

    try:
        user = User.objects.get(telegram_id=telegram_id)
    except User.DoesNotExist:
        await update.message.reply_text(
            "You haven't linked your account yet. Use /start first."
        )
        return

    cards = get_due_cards(user, limit=10)

    if not cards:
        await update.message.reply_text(
            "No cards due for review today. You're all caught up!"
        )
        return

    lines = [f"You have {len(cards)} card(s) due for review:\n"]
    for i, card in enumerate(cards, 1):
        lines.append(f"{i}. **{card.vocabulary.french}** — {card.vocabulary.english}")

    lines.append("\nVisit the app to start your review session.")

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
```

### 5b. Register in bot.py

Add import:
```python
from apps.bot.handlers.daily import daily_command
```

Add handler registration (after the `news_command` line):
```python
application.add_handler(CommandHandler("daily", daily_command))
```

### 5c. Tests

```python
# backend/apps/bot/tests/test_daily.py
import pytest
from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.bot.handlers.daily import daily_command
from apps.content.models import Topic, Lesson, Vocabulary
from apps.progress.models import SRSCard

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="botdaily", email="daily@example.com",
        password="testpass123!", telegram_id=12345,
    )


@pytest.fixture
def due_cards(user, db):
    topic = Topic.objects.create(
        name_fr="Test", name_en="Test",
        description="", icon="t", order=1, difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic, type="vocab", title="Test",
        content={}, order=1, difficulty=1,
    )
    vocab = Vocabulary.objects.create(
        lesson=lesson, french="bonjour", english="hello",
        pronunciation="/bɔ̃ʒuʁ/", gender="a", part_of_speech="interjection",
    )
    return SRSCard.objects.create(
        user=user, vocabulary=vocab,
        next_review_at=timezone.now() - timedelta(hours=1),
    )


def _make_update(telegram_user_id):
    update = MagicMock()
    update.effective_user.id = telegram_user_id
    update.message.reply_text = AsyncMock()
    return update


@pytest.mark.django_db
class TestDailyCommand:
    @pytest.mark.asyncio
    async def test_unlinked_user(self):
        update = _make_update(telegram_user_id=99999)
        await daily_command(update, MagicMock())
        update.message.reply_text.assert_called_once()
        assert "haven't linked" in update.message.reply_text.call_args[0][0]

    @pytest.mark.asyncio
    async def test_no_due_cards(self, user):
        update = _make_update(telegram_user_id=user.telegram_id)
        await daily_command(update, MagicMock())
        assert "all caught up" in update.message.reply_text.call_args[0][0]

    @pytest.mark.asyncio
    async def test_with_due_cards(self, user, due_cards):
        update = _make_update(telegram_user_id=user.telegram_id)
        await daily_command(update, MagicMock())
        text = update.message.reply_text.call_args[0][0]
        assert "1 card(s) due" in text
        assert "bonjour" in text
```

### 5d. Run tests

```bash
cd backend && pytest apps/bot/tests/test_daily.py -v
```

---

## Commit Summary

| # | Commit message | Key files |
|---|---|---|
| 1 | `feat(progress): add SRSCard model and SM-2 service with tests` | models.py, services.py, test_srs_service.py, settings, migration |
| 2 | `feat(progress): add SRS review and mistake journal API endpoints` | views.py, serializers.py, urls.py, test_srs_api.py, test_mistakes.py, practice/views.py mod |
| 3 | `feat(progress): add conjugation drill endpoint and seed data` | views.py additions, seed_conjugations.py, test_conjugation.py |
| 4 | `feat(frontend): add SRS review, mistake journal, and conjugation drill pages` | progress.js, SRSReview.jsx, MistakeJournal.jsx, ConjugationDrill.jsx, App.jsx |
| 5 | `feat(bot): add /daily command for SRS review cards` | daily.py, bot.py, test_daily.py |

## Verification Checklist

After all 5 commits:

```bash
# Backend tests
cd backend && pytest apps/progress/tests/ -v
cd backend && pytest apps/bot/tests/test_daily.py -v
cd backend && pytest apps/practice/tests/ -v  # ensure existing quiz tests still pass

# Migration
cd backend && python manage.py migrate

# Seed data
cd backend && python manage.py seed_conjugations

# Frontend dev server
cd frontend && npm run dev
# Visit: /practice/srs, /progress/mistakes, /practice/conjugation
```
