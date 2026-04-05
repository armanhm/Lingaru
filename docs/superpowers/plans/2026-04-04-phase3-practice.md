# Phase 3: Practice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a quiz engine with session-based answer tracking, multiple question types (MCQ, fill-blank, translate), four DRF endpoints, and a Duolingo-style interactive React quiz UI with progress bar, animated transitions, immediate feedback, and score summary.

**Architecture:** A new `apps.practice` Django app houses two models (QuizSession, QuizAnswer) that reference the existing `Question` model in `apps.content`. Four DRF endpoints manage the quiz lifecycle: start, answer, complete, and history. The React frontend adds a full-screen quiz page at `/practice/quiz/:lessonId` and a "Start Quiz" button on the existing LessonDetail page. The quiz flow is: start session (POST) -> answer questions one at a time (POST per question) -> complete session (POST) -> see score summary.

**Tech Stack:** Python 3.12, Django 5.x, Django REST Framework, PostgreSQL, pytest, React 18, Vite 5, React Router 6, Axios, Tailwind CSS 3

---

## File Structure

```
backend/
├── apps/
│   └── practice/
│       ├── __init__.py
│       ├── apps.py
│       ├── models.py
│       ├── admin.py
│       ├── serializers.py
│       ├── views.py
│       ├── urls.py
│       └── tests/
│           ├── __init__.py
│           ├── test_models.py
│           ├── test_serializers.py
│           └── test_views.py
│
├── config/
│   ├── settings/
│   │   └── base.py                     # (edit: add apps.practice to INSTALLED_APPS)
│   └── urls.py                         # (edit: add practice URLs)

frontend/
├── src/
│   ├── App.jsx                         # (edit: add quiz route)
│   ├── api/
│   │   └── practice.js                 # NEW: practice API functions
│   └── pages/
│       ├── LessonDetail.jsx            # (edit: add "Start Quiz" button)
│       └── Quiz.jsx                    # NEW: Duolingo-style quiz page
```

---

### Task 1: Practice Models

**Files:**
- Create: `backend/apps/practice/__init__.py`
- Create: `backend/apps/practice/apps.py`
- Create: `backend/apps/practice/models.py`
- Create: `backend/apps/practice/admin.py`
- Create: `backend/apps/practice/serializers.py` (empty placeholder)
- Create: `backend/apps/practice/views.py` (empty placeholder)
- Create: `backend/apps/practice/urls.py` (empty placeholder)
- Create: `backend/apps/practice/tests/__init__.py`
- Create: `backend/apps/practice/tests/test_models.py`
- Edit: `backend/config/settings/base.py` (add `apps.practice` to INSTALLED_APPS)

- [ ] **Step 1: Create the practice app directory and apps.py**

```python
# backend/apps/practice/__init__.py
```

```python
# backend/apps/practice/apps.py
from django.apps import AppConfig


class PracticeConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.practice"
    verbose_name = "Practice"
```

- [ ] **Step 2: Create empty placeholder files**

```python
# backend/apps/practice/admin.py
from django.contrib import admin  # noqa: F401
```

```python
# backend/apps/practice/serializers.py
from rest_framework import serializers  # noqa: F401
```

```python
# backend/apps/practice/views.py
from rest_framework import generics  # noqa: F401
```

```python
# backend/apps/practice/urls.py
from django.urls import path  # noqa: F401

app_name = "practice"

urlpatterns = []
```

```python
# backend/apps/practice/tests/__init__.py
```

- [ ] **Step 3: Register apps.practice in INSTALLED_APPS**

In `backend/config/settings/base.py`, add `"apps.practice"` after `"apps.content"`:

```python
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "corsheaders",
    # Local apps
    "apps.users",
    "apps.content",
    "apps.practice",
]
```

- [ ] **Step 4: Write model tests (TDD — tests first, expect failure)**

```python
# backend/apps/practice/tests/test_models.py
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.content.models import Topic, Lesson, Question
from apps.practice.models import QuizSession, QuizAnswer

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="quizuser", email="quiz@example.com", password="testpass123!",
    )


@pytest.fixture
def sample_lesson(db):
    topic = Topic.objects.create(
        name_fr="Les salutations", name_en="Greetings",
        description="Basic greetings", icon="wave", order=1, difficulty_level=1,
    )
    return Lesson.objects.create(
        topic=topic, type="vocab", title="Hello & Goodbye",
        content={"intro": "Greetings"}, order=1, difficulty=1,
    )


@pytest.fixture
def sample_questions(sample_lesson):
    q1 = Question.objects.create(
        lesson=sample_lesson, type="mcq", prompt="What does bonjour mean?",
        correct_answer="hello", wrong_answers=["goodbye", "thanks", "please"],
        explanation="Bonjour means hello.", difficulty=1,
    )
    q2 = Question.objects.create(
        lesson=sample_lesson, type="fill_blank", prompt="___jour!",
        correct_answer="Bon", wrong_answers=[],
        explanation="Bonjour = good day.", difficulty=1,
    )
    q3 = Question.objects.create(
        lesson=sample_lesson, type="translate", prompt="Translate: goodbye",
        correct_answer="au revoir", wrong_answers=[],
        explanation="Au revoir means goodbye.", difficulty=1,
    )
    return [q1, q2, q3]


@pytest.mark.django_db
class TestQuizSessionModel:
    def test_create_session(self, user, sample_lesson):
        session = QuizSession.objects.create(
            user=user,
            lesson=sample_lesson,
            total_questions=5,
        )
        assert session.user == user
        assert session.lesson == sample_lesson
        assert session.total_questions == 5
        assert session.score is None
        assert session.completed_at is None
        assert session.started_at is not None

    def test_session_str(self, user, sample_lesson):
        session = QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=3,
        )
        assert str(session) == f"{user.username} — {sample_lesson.title}"

    def test_complete_session(self, user, sample_lesson):
        session = QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=5,
        )
        now = timezone.now()
        session.score = 4
        session.completed_at = now
        session.save()
        session.refresh_from_db()
        assert session.score == 4
        assert session.completed_at is not None

    def test_session_ordering(self, user, sample_lesson):
        s1 = QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=3,
        )
        s2 = QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=3,
        )
        sessions = list(QuizSession.objects.all())
        # Most recent first
        assert sessions[0].id == s2.id
        assert sessions[1].id == s1.id

    def test_session_cascade_delete_user(self, user, sample_lesson):
        QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=3,
        )
        user.delete()
        assert QuizSession.objects.count() == 0

    def test_session_cascade_delete_lesson(self, user, sample_lesson):
        QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=3,
        )
        sample_lesson.delete()
        assert QuizSession.objects.count() == 0


@pytest.mark.django_db
class TestQuizAnswerModel:
    def test_create_answer(self, user, sample_lesson, sample_questions):
        session = QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=3,
        )
        answer = QuizAnswer.objects.create(
            session=session,
            question=sample_questions[0],
            user_answer="hello",
            is_correct=True,
        )
        assert answer.session == session
        assert answer.question == sample_questions[0]
        assert answer.user_answer == "hello"
        assert answer.is_correct is True
        assert answer.answered_at is not None

    def test_answer_str(self, user, sample_lesson, sample_questions):
        session = QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=3,
        )
        answer = QuizAnswer.objects.create(
            session=session, question=sample_questions[0],
            user_answer="hello", is_correct=True,
        )
        expected = f"Q{sample_questions[0].id} — hello (correct)"
        assert str(answer) == expected

    def test_incorrect_answer_str(self, user, sample_lesson, sample_questions):
        session = QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=3,
        )
        answer = QuizAnswer.objects.create(
            session=session, question=sample_questions[0],
            user_answer="goodbye", is_correct=False,
        )
        expected = f"Q{sample_questions[0].id} — goodbye (wrong)"
        assert str(answer) == expected

    def test_answer_cascade_delete_session(self, user, sample_lesson, sample_questions):
        session = QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=3,
        )
        QuizAnswer.objects.create(
            session=session, question=sample_questions[0],
            user_answer="hello", is_correct=True,
        )
        session.delete()
        assert QuizAnswer.objects.count() == 0

    def test_unique_together_session_question(self, user, sample_lesson, sample_questions):
        session = QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=3,
        )
        QuizAnswer.objects.create(
            session=session, question=sample_questions[0],
            user_answer="hello", is_correct=True,
        )
        from django.db import IntegrityError
        with pytest.raises(IntegrityError):
            QuizAnswer.objects.create(
                session=session, question=sample_questions[0],
                user_answer="goodbye", is_correct=False,
            )
```

- [ ] **Step 5: Create the models**

```python
# backend/apps/practice/models.py
from django.conf import settings
from django.db import models


class QuizSession(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="quiz_sessions",
    )
    lesson = models.ForeignKey(
        "content.Lesson",
        on_delete=models.CASCADE,
        related_name="quiz_sessions",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    score = models.PositiveIntegerField(null=True, blank=True)
    total_questions = models.PositiveIntegerField()

    class Meta:
        db_table = "practice_quiz_sessions"
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.user.username} — {self.lesson.title}"


class QuizAnswer(models.Model):
    session = models.ForeignKey(
        QuizSession,
        on_delete=models.CASCADE,
        related_name="answers",
    )
    question = models.ForeignKey(
        "content.Question",
        on_delete=models.CASCADE,
        related_name="quiz_answers",
    )
    user_answer = models.TextField()
    is_correct = models.BooleanField()
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "practice_quiz_answers"
        constraints = [
            models.UniqueConstraint(
                fields=["session", "question"],
                name="unique_answer_per_question",
            ),
        ]

    def __str__(self):
        status = "correct" if self.is_correct else "wrong"
        return f"Q{self.question_id} — {self.user_answer} ({status})"
```

- [ ] **Step 6: Register models in admin**

```python
# backend/apps/practice/admin.py
from django.contrib import admin
from .models import QuizSession, QuizAnswer


class QuizAnswerInline(admin.TabularInline):
    model = QuizAnswer
    extra = 0
    readonly_fields = ("question", "user_answer", "is_correct", "answered_at")


@admin.register(QuizSession)
class QuizSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "lesson", "score", "total_questions", "started_at", "completed_at")
    list_filter = ("completed_at",)
    search_fields = ("user__username", "lesson__title")
    inlines = [QuizAnswerInline]
    readonly_fields = ("started_at",)


@admin.register(QuizAnswer)
class QuizAnswerAdmin(admin.ModelAdmin):
    list_display = ("session", "question", "user_answer", "is_correct", "answered_at")
    list_filter = ("is_correct",)
```

- [ ] **Step 7: Create and run migration**

```bash
cd backend && python manage.py makemigrations practice
cd backend && python manage.py migrate
```

- [ ] **Step 8: Run model tests — confirm all pass**

```bash
cd backend && python -m pytest apps/practice/tests/test_models.py -v
```

**Commit:** `feat(practice): add QuizSession and QuizAnswer models with TDD tests`

---

### Task 2: Practice Serializers

**Files:**
- Edit: `backend/apps/practice/serializers.py`
- Create: `backend/apps/practice/tests/test_serializers.py`

- [ ] **Step 1: Write serializer tests (TDD — tests first, expect failure)**

```python
# backend/apps/practice/tests/test_serializers.py
import pytest
from django.contrib.auth import get_user_model
from apps.content.models import Topic, Lesson, Question
from apps.practice.models import QuizSession, QuizAnswer
from apps.practice.serializers import (
    QuizStartSerializer,
    QuizQuestionSerializer,
    AnswerSubmitSerializer,
    AnswerResultSerializer,
    QuizCompleteSerializer,
    QuizHistorySerializer,
)

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="quizuser", email="quiz@example.com", password="testpass123!",
    )


@pytest.fixture
def sample_lesson(db):
    topic = Topic.objects.create(
        name_fr="Les salutations", name_en="Greetings",
        description="Basic greetings", icon="wave", order=1, difficulty_level=1,
    )
    return Lesson.objects.create(
        topic=topic, type="vocab", title="Hello & Goodbye",
        content={}, order=1, difficulty=1,
    )


@pytest.fixture
def sample_questions(sample_lesson):
    q1 = Question.objects.create(
        lesson=sample_lesson, type="mcq", prompt="What does bonjour mean?",
        correct_answer="hello", wrong_answers=["goodbye", "thanks", "please"],
        explanation="Bonjour means hello.", difficulty=1,
    )
    q2 = Question.objects.create(
        lesson=sample_lesson, type="fill_blank", prompt="___jour!",
        correct_answer="Bon", wrong_answers=[],
        explanation="Bonjour = good day.", difficulty=1,
    )
    return [q1, q2]


@pytest.mark.django_db
class TestQuizStartSerializer:
    def test_valid_lesson_id(self, sample_lesson):
        serializer = QuizStartSerializer(data={"lesson_id": sample_lesson.id})
        assert serializer.is_valid()

    def test_missing_lesson_id(self):
        serializer = QuizStartSerializer(data={})
        assert not serializer.is_valid()
        assert "lesson_id" in serializer.errors

    def test_invalid_lesson_id(self):
        serializer = QuizStartSerializer(data={"lesson_id": 99999})
        assert not serializer.is_valid()


@pytest.mark.django_db
class TestQuizQuestionSerializer:
    def test_mcq_question_has_options(self, sample_questions):
        q = sample_questions[0]  # MCQ
        serializer = QuizQuestionSerializer(q)
        data = serializer.data
        assert data["id"] == q.id
        assert data["type"] == "mcq"
        assert data["prompt"] == "What does bonjour mean?"
        assert "options" in data
        assert len(data["options"]) == 4  # correct + 3 wrong
        assert "hello" in data["options"]
        # Should NOT expose correct_answer or explanation
        assert "correct_answer" not in data
        assert "explanation" not in data

    def test_fill_blank_question_no_options(self, sample_questions):
        q = sample_questions[1]  # fill_blank
        serializer = QuizQuestionSerializer(q)
        data = serializer.data
        assert data["type"] == "fill_blank"
        assert data["options"] is None or data["options"] == []


@pytest.mark.django_db
class TestAnswerSubmitSerializer:
    def test_valid_answer(self, sample_questions):
        serializer = AnswerSubmitSerializer(data={
            "question_id": sample_questions[0].id,
            "answer": "hello",
        })
        assert serializer.is_valid()

    def test_missing_fields(self):
        serializer = AnswerSubmitSerializer(data={})
        assert not serializer.is_valid()
        assert "question_id" in serializer.errors
        assert "answer" in serializer.errors


@pytest.mark.django_db
class TestAnswerResultSerializer:
    def test_serializes_result(self, user, sample_lesson, sample_questions):
        session = QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=2,
        )
        answer = QuizAnswer.objects.create(
            session=session, question=sample_questions[0],
            user_answer="hello", is_correct=True,
        )
        serializer = AnswerResultSerializer(answer)
        data = serializer.data
        assert data["is_correct"] is True
        assert data["correct_answer"] == "hello"
        assert data["explanation"] == "Bonjour means hello."


@pytest.mark.django_db
class TestQuizCompleteSerializer:
    def test_serializes_completed_session(self, user, sample_lesson):
        session = QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=5, score=4,
        )
        serializer = QuizCompleteSerializer(session)
        data = serializer.data
        assert data["score"] == 4
        assert data["total_questions"] == 5
        assert "started_at" in data
        assert "lesson_title" in data


@pytest.mark.django_db
class TestQuizHistorySerializer:
    def test_serializes_history(self, user, sample_lesson):
        session = QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=5, score=3,
        )
        serializer = QuizHistorySerializer(session)
        data = serializer.data
        assert data["id"] == session.id
        assert data["lesson_title"] == "Hello & Goodbye"
        assert data["score"] == 3
        assert data["total_questions"] == 5
```

- [ ] **Step 2: Implement the serializers**

```python
# backend/apps/practice/serializers.py
import random
from rest_framework import serializers
from apps.content.models import Lesson, Question
from .models import QuizSession, QuizAnswer


class QuizStartSerializer(serializers.Serializer):
    lesson_id = serializers.IntegerField()

    def validate_lesson_id(self, value):
        try:
            Lesson.objects.get(pk=value)
        except Lesson.DoesNotExist:
            raise serializers.ValidationError("Lesson not found.")
        return value


class QuizQuestionSerializer(serializers.ModelSerializer):
    options = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = ("id", "type", "prompt", "difficulty", "options")

    def get_options(self, obj):
        if obj.type == "mcq" and obj.wrong_answers:
            options = [obj.correct_answer] + list(obj.wrong_answers)
            random.shuffle(options)
            return options
        return []


class AnswerSubmitSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    answer = serializers.CharField()


class AnswerResultSerializer(serializers.ModelSerializer):
    correct_answer = serializers.CharField(source="question.correct_answer")
    explanation = serializers.CharField(source="question.explanation")

    class Meta:
        model = QuizAnswer
        fields = ("is_correct", "correct_answer", "explanation", "user_answer")


class QuizCompleteSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source="lesson.title")

    class Meta:
        model = QuizSession
        fields = (
            "id", "lesson_title", "score", "total_questions",
            "started_at", "completed_at",
        )


class QuizHistorySerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source="lesson.title")
    lesson_id = serializers.IntegerField(source="lesson.id")

    class Meta:
        model = QuizSession
        fields = (
            "id", "lesson_id", "lesson_title", "score",
            "total_questions", "started_at", "completed_at",
        )
```

- [ ] **Step 3: Run serializer tests — confirm all pass**

```bash
cd backend && python -m pytest apps/practice/tests/test_serializers.py -v
```

**Commit:** `feat(practice): add quiz serializers for start, answer, complete, and history`

---

### Task 3: Practice Views & URLs

**Files:**
- Edit: `backend/apps/practice/views.py`
- Edit: `backend/apps/practice/urls.py`
- Edit: `backend/config/urls.py` (add practice URLs)
- Create: `backend/apps/practice/tests/test_views.py`

- [ ] **Step 1: Write view tests (TDD — tests first, expect failure)**

```python
# backend/apps/practice/tests/test_views.py
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.content.models import Topic, Lesson, Question
from apps.practice.models import QuizSession, QuizAnswer

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="quizuser", email="quiz@example.com", password="testpass123!",
    )


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def sample_lesson(db):
    topic = Topic.objects.create(
        name_fr="Les salutations", name_en="Greetings",
        description="Basic greetings", icon="wave", order=1, difficulty_level=1,
    )
    return Lesson.objects.create(
        topic=topic, type="vocab", title="Hello & Goodbye",
        content={}, order=1, difficulty=1,
    )


@pytest.fixture
def sample_questions(sample_lesson):
    q1 = Question.objects.create(
        lesson=sample_lesson, type="mcq", prompt="What does bonjour mean?",
        correct_answer="hello", wrong_answers=["goodbye", "thanks", "please"],
        explanation="Bonjour means hello.", difficulty=1,
    )
    q2 = Question.objects.create(
        lesson=sample_lesson, type="fill_blank", prompt="___jour!",
        correct_answer="Bon", wrong_answers=[],
        explanation="Bonjour = good day.", difficulty=1,
    )
    q3 = Question.objects.create(
        lesson=sample_lesson, type="translate", prompt="Translate: goodbye",
        correct_answer="au revoir", wrong_answers=[],
        explanation="Au revoir means goodbye.", difficulty=2,
    )
    return [q1, q2, q3]


@pytest.mark.django_db
class TestQuizStartView:
    def test_start_quiz_success(self, authenticated_client, sample_lesson, sample_questions):
        response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        assert response.status_code == 201
        assert "session_id" in response.data
        assert "questions" in response.data
        assert len(response.data["questions"]) == 3
        # Questions should not expose correct_answer
        for q in response.data["questions"]:
            assert "correct_answer" not in q
            assert "id" in q
            assert "type" in q
            assert "prompt" in q
        assert QuizSession.objects.count() == 1

    def test_start_quiz_no_questions(self, authenticated_client, sample_lesson):
        response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        assert response.status_code == 400
        assert "no questions" in response.data["detail"].lower()

    def test_start_quiz_invalid_lesson(self, authenticated_client):
        response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": 99999},
            format="json",
        )
        assert response.status_code == 400

    def test_start_quiz_unauthenticated(self, api_client, sample_lesson, sample_questions):
        response = api_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        assert response.status_code == 401


@pytest.mark.django_db
class TestQuizAnswerView:
    def test_submit_correct_answer(self, authenticated_client, sample_lesson, sample_questions):
        # Start quiz first
        start_response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]

        response = authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "hello"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["is_correct"] is True
        assert response.data["correct_answer"] == "hello"
        assert response.data["explanation"] == "Bonjour means hello."
        assert QuizAnswer.objects.count() == 1

    def test_submit_incorrect_answer(self, authenticated_client, sample_lesson, sample_questions):
        start_response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]

        response = authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "goodbye"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["is_correct"] is False
        assert response.data["correct_answer"] == "hello"

    def test_submit_case_insensitive_answer(self, authenticated_client, sample_lesson, sample_questions):
        start_response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]

        response = authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "Hello"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["is_correct"] is True

    def test_submit_duplicate_answer(self, authenticated_client, sample_lesson, sample_questions):
        start_response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]

        authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "hello"},
            format="json",
        )
        response = authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "goodbye"},
            format="json",
        )
        assert response.status_code == 400
        assert "already answered" in response.data["detail"].lower()

    def test_submit_answer_wrong_session(self, authenticated_client, sample_lesson, sample_questions):
        response = authenticated_client.post(
            "/api/practice/quiz/99999/answer/",
            {"question_id": sample_questions[0].id, "answer": "hello"},
            format="json",
        )
        assert response.status_code == 404

    def test_submit_answer_completed_session(self, authenticated_client, user, sample_lesson, sample_questions):
        start_response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]
        # Complete the session
        authenticated_client.post(
            f"/api/practice/quiz/{session_id}/complete/",
            format="json",
        )
        response = authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "hello"},
            format="json",
        )
        assert response.status_code == 400
        assert "already completed" in response.data["detail"].lower()

    def test_submit_answer_other_users_session(self, api_client, user, sample_lesson, sample_questions):
        # Start quiz as user
        api_client.force_authenticate(user=user)
        start_response = api_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]

        # Try to answer as different user
        other_user = User.objects.create_user(
            username="otheruser", email="other@example.com", password="testpass123!",
        )
        api_client.force_authenticate(user=other_user)
        response = api_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "hello"},
            format="json",
        )
        assert response.status_code == 404


@pytest.mark.django_db
class TestQuizCompleteView:
    def test_complete_quiz(self, authenticated_client, sample_lesson, sample_questions):
        start_response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]

        # Answer two questions correctly, one wrong
        authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "hello"},
            format="json",
        )
        authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[1].id, "answer": "Bon"},
            format="json",
        )
        authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[2].id, "answer": "wrong"},
            format="json",
        )

        response = authenticated_client.post(
            f"/api/practice/quiz/{session_id}/complete/",
            format="json",
        )
        assert response.status_code == 200
        assert response.data["score"] == 2
        assert response.data["total_questions"] == 3
        assert response.data["completed_at"] is not None
        assert response.data["lesson_title"] == "Hello & Goodbye"

    def test_complete_already_completed(self, authenticated_client, sample_lesson, sample_questions):
        start_response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]

        authenticated_client.post(
            f"/api/practice/quiz/{session_id}/complete/", format="json",
        )
        response = authenticated_client.post(
            f"/api/practice/quiz/{session_id}/complete/", format="json",
        )
        assert response.status_code == 400
        assert "already completed" in response.data["detail"].lower()


@pytest.mark.django_db
class TestQuizHistoryView:
    def test_list_history(self, authenticated_client, user, sample_lesson):
        QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=5, score=4,
        )
        QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=5, score=3,
        )
        response = authenticated_client.get("/api/practice/quiz/history/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 2

    def test_history_only_own_sessions(self, api_client, user, sample_lesson):
        QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=5, score=4,
        )
        other_user = User.objects.create_user(
            username="other", email="other@example.com", password="testpass123!",
        )
        QuizSession.objects.create(
            user=other_user, lesson=sample_lesson, total_questions=5, score=5,
        )
        api_client.force_authenticate(user=user)
        response = api_client.get("/api/practice/quiz/history/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 1

    def test_history_unauthenticated(self, api_client):
        response = api_client.get("/api/practice/quiz/history/")
        assert response.status_code == 401
```

- [ ] **Step 2: Implement the views**

```python
# backend/apps/practice/views.py
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.content.models import Question
from .models import QuizSession, QuizAnswer
from .serializers import (
    QuizStartSerializer,
    QuizQuestionSerializer,
    AnswerSubmitSerializer,
    AnswerResultSerializer,
    QuizCompleteSerializer,
    QuizHistorySerializer,
)


class QuizStartView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = QuizStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lesson_id = serializer.validated_data["lesson_id"]
        questions = Question.objects.filter(lesson_id=lesson_id)

        if not questions.exists():
            return Response(
                {"detail": "This lesson has no questions available."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session = QuizSession.objects.create(
            user=request.user,
            lesson_id=lesson_id,
            total_questions=questions.count(),
        )

        return Response(
            {
                "session_id": session.id,
                "questions": QuizQuestionSerializer(questions, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


class QuizAnswerView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, session_id):
        try:
            session = QuizSession.objects.get(
                pk=session_id, user=request.user,
            )
        except QuizSession.DoesNotExist:
            return Response(
                {"detail": "Quiz session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if session.completed_at is not None:
            return Response(
                {"detail": "This quiz is already completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AnswerSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question_id = serializer.validated_data["question_id"]
        user_answer = serializer.validated_data["answer"]

        try:
            question = Question.objects.get(pk=question_id)
        except Question.DoesNotExist:
            return Response(
                {"detail": "Question not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if QuizAnswer.objects.filter(session=session, question=question).exists():
            return Response(
                {"detail": "This question was already answered."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_correct = user_answer.strip().lower() == question.correct_answer.strip().lower()

        answer = QuizAnswer.objects.create(
            session=session,
            question=question,
            user_answer=user_answer,
            is_correct=is_correct,
        )

        return Response(AnswerResultSerializer(answer).data)


class QuizCompleteView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, session_id):
        try:
            session = QuizSession.objects.select_related("lesson").get(
                pk=session_id, user=request.user,
            )
        except QuizSession.DoesNotExist:
            return Response(
                {"detail": "Quiz session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if session.completed_at is not None:
            return Response(
                {"detail": "This quiz is already completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        correct_count = session.answers.filter(is_correct=True).count()
        session.score = correct_count
        session.completed_at = timezone.now()
        session.save()

        return Response(QuizCompleteSerializer(session).data)


class QuizHistoryView(generics.ListAPIView):
    serializer_class = QuizHistorySerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return QuizSession.objects.filter(
            user=self.request.user,
        ).select_related("lesson")
```

- [ ] **Step 3: Wire up the URLs**

```python
# backend/apps/practice/urls.py
from django.urls import path
from . import views

app_name = "practice"

urlpatterns = [
    path("quiz/start/", views.QuizStartView.as_view(), name="quiz-start"),
    path("quiz/<int:session_id>/answer/", views.QuizAnswerView.as_view(), name="quiz-answer"),
    path("quiz/<int:session_id>/complete/", views.QuizCompleteView.as_view(), name="quiz-complete"),
    path("quiz/history/", views.QuizHistoryView.as_view(), name="quiz-history"),
]
```

- [ ] **Step 4: Register practice URLs in the main URL config**

In `backend/config/urls.py`, add the practice URL include:

```python
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", include("apps.users.urls")),
    path("api/content/", include("apps.content.urls")),
    path("api/practice/", include("apps.practice.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

- [ ] **Step 5: Run view tests — confirm all pass**

```bash
cd backend && python -m pytest apps/practice/tests/test_views.py -v
```

- [ ] **Step 6: Run the full practice test suite**

```bash
cd backend && python -m pytest apps/practice/ -v
```

**Commit:** `feat(practice): add quiz start, answer, complete, and history endpoints`

---

### Task 4: Frontend Quiz UI

**Files:**
- Create: `frontend/src/api/practice.js`
- Create: `frontend/src/pages/Quiz.jsx`
- Edit: `frontend/src/pages/LessonDetail.jsx` (add "Start Quiz" button)
- Edit: `frontend/src/App.jsx` (add quiz route)

- [ ] **Step 1: Create the practice API module**

```javascript
// frontend/src/api/practice.js
import client from "./client";

export const startQuiz = (lessonId) =>
  client.post("/practice/quiz/start/", { lesson_id: lessonId });

export const submitAnswer = (sessionId, questionId, answer) =>
  client.post(`/practice/quiz/${sessionId}/answer/`, {
    question_id: questionId,
    answer,
  });

export const completeQuiz = (sessionId) =>
  client.post(`/practice/quiz/${sessionId}/complete/`);

export const getQuizHistory = () =>
  client.get("/practice/quiz/history/");
```

- [ ] **Step 2: Create the Quiz page component**

```jsx
// frontend/src/pages/Quiz.jsx
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { startQuiz, submitAnswer, completeQuiz } from "../api/practice";

function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
      <div
        className="bg-primary-500 h-3 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function MCQQuestion({ question, onAnswer, disabled }) {
  const [selected, setSelected] = useState(null);

  const handleSelect = (option) => {
    if (disabled) return;
    setSelected(option);
    onAnswer(option);
  };

  return (
    <div>
      <p className="text-lg font-semibold text-gray-900 mb-6">
        {question.prompt}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(question.options || []).map((option, i) => (
          <button
            key={i}
            onClick={() => handleSelect(option)}
            disabled={disabled}
            className={`p-4 rounded-xl border-2 text-left font-medium transition-all duration-200 ${
              selected === option
                ? "border-primary-500 bg-primary-50 text-primary-800"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
            } ${disabled ? "cursor-not-allowed opacity-75" : "cursor-pointer"}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function TextInputQuestion({ question, onAnswer, disabled }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (disabled || !value.trim()) return;
    onAnswer(value.trim());
  };

  return (
    <form onSubmit={handleSubmit}>
      <p className="text-lg font-semibold text-gray-900 mb-2">
        {question.prompt}
      </p>
      <p className="text-sm text-gray-500 mb-6">
        {question.type === "translate"
          ? "Type your translation below"
          : "Fill in the blank"}
      </p>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder="Type your answer..."
        autoFocus
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:border-primary-500 focus:ring-0 focus:outline-none transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="mt-4 w-full sm:w-auto px-8 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Check
      </button>
    </form>
  );
}

function FeedbackBanner({ result, onContinue }) {
  if (!result) return null;

  return (
    <div
      className={`mt-6 p-5 rounded-xl border-2 animate-fade-in ${
        result.is_correct
          ? "bg-green-50 border-green-300"
          : "bg-red-50 border-red-300"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{result.is_correct ? "\u2705" : "\u274c"}</span>
        <span
          className={`font-bold text-lg ${
            result.is_correct ? "text-green-800" : "text-red-800"
          }`}
        >
          {result.is_correct ? "Correct!" : "Incorrect"}
        </span>
      </div>
      {!result.is_correct && (
        <p className="text-sm text-red-700 mb-1">
          Correct answer: <strong>{result.correct_answer}</strong>
        </p>
      )}
      {result.explanation && (
        <p className="text-sm text-gray-600 mb-3">{result.explanation}</p>
      )}
      <button
        onClick={onContinue}
        className="px-6 py-2 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

function ScoreSummary({ result, lessonId }) {
  const pct =
    result.total_questions > 0
      ? Math.round((result.score / result.total_questions) * 100)
      : 0;

  let grade, gradeColor;
  if (pct === 100) {
    grade = "Perfect!";
    gradeColor = "text-yellow-600";
  } else if (pct >= 80) {
    grade = "Great job!";
    gradeColor = "text-green-600";
  } else if (pct >= 60) {
    grade = "Good effort!";
    gradeColor = "text-blue-600";
  } else {
    grade = "Keep practicing!";
    gradeColor = "text-orange-600";
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
      <div className="text-6xl mb-4">{pct === 100 ? "\ud83c\udf1f" : pct >= 60 ? "\ud83c\udf89" : "\ud83d\udcaa"}</div>
      <h2 className={`text-3xl font-bold mb-2 ${gradeColor}`}>{grade}</h2>
      <p className="text-gray-600 text-lg mb-6">
        {result.lesson_title}
      </p>
      <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 text-center">
        <p className="text-5xl font-bold text-gray-900 mb-2">
          {result.score}/{result.total_questions}
        </p>
        <p className="text-gray-500">questions correct</p>
        <div className="mt-4 w-48 bg-gray-200 rounded-full h-3 mx-auto">
          <div
            className="bg-primary-500 h-3 rounded-full transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-sm text-gray-400 mt-2">{pct}%</p>
      </div>
      <div className="flex gap-4">
        <Link
          to={`/lesson/${lessonId}`}
          className="px-6 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back to Lesson
        </Link>
        <Link
          to={`/practice/quiz/${lessonId}`}
          reloadDocument
          className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
        >
          Try Again
        </Link>
      </div>
    </div>
  );
}

export default function Quiz() {
  const { lessonId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    startQuiz(lessonId)
      .then((res) => {
        setSessionId(res.data.session_id);
        setQuestions(res.data.questions);
      })
      .catch((err) => {
        setError(
          err.response?.data?.detail ||
            err.response?.data?.lesson_id?.[0] ||
            "Failed to start quiz."
        );
      })
      .finally(() => setLoading(false));
  }, [lessonId]);

  const handleAnswer = useCallback(
    async (answer) => {
      if (!sessionId || feedback) return;
      const question = questions[currentIndex];
      try {
        const res = await submitAnswer(sessionId, question.id, answer);
        setFeedback(res.data);
        setAnsweredCount((prev) => prev + 1);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to submit answer.");
      }
    },
    [sessionId, questions, currentIndex, feedback]
  );

  const handleContinue = useCallback(async () => {
    setFeedback(null);
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // All questions answered, complete the quiz
      try {
        const res = await completeQuiz(sessionId);
        setSummary(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to complete quiz.");
      }
    }
  }, [currentIndex, questions.length, sessionId]);

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
        <Link
          to={`/lesson/${lessonId}`}
          className="mt-4 inline-block text-sm text-primary-600 hover:text-primary-800"
        >
          &larr; Back to Lesson
        </Link>
      </div>
    );
  }

  if (summary) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <ScoreSummary result={summary} lessonId={lessonId} />
      </div>
    );
  }

  const question = questions[currentIndex];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => navigate(`/lesson/${lessonId}`)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close quiz"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="text-sm text-gray-500">
          {currentIndex + 1} / {questions.length}
        </span>
      </div>

      <ProgressBar current={answeredCount} total={questions.length} />

      <div className="min-h-[300px]">
        {question.type === "mcq" ? (
          <MCQQuestion
            key={question.id}
            question={question}
            onAnswer={handleAnswer}
            disabled={!!feedback}
          />
        ) : (
          <TextInputQuestion
            key={question.id}
            question={question}
            onAnswer={handleAnswer}
            disabled={!!feedback}
          />
        )}

        <FeedbackBanner result={feedback} onContinue={handleContinue} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add "Start Quiz" button to LessonDetail**

In `frontend/src/pages/LessonDetail.jsx`, replace the `QuestionsSection` component to include a "Start Quiz" button instead of the "coming soon" message. Also add the `Link` import if not already present (it is).

Replace the entire `QuestionsSection` function with:

```jsx
function QuestionsSection({ questions, lessonId }) {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Practice Questions
        </h2>
        <Link
          to={`/practice/quiz/${lessonId}`}
          className="px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors text-sm"
        >
          Start Quiz
        </Link>
      </div>
      <div className="bg-gray-50 rounded-lg border p-5">
        <p className="text-sm text-gray-500 mb-4">
          {questions.length} question{questions.length !== 1 ? "s" : ""} available.
          Start the quiz to practice interactively.
        </p>
        <div className="space-y-3">
          {questions.slice(0, 3).map((q, index) => (
            <div key={q.id} className="flex gap-3 items-start">
              <span className="text-sm font-medium text-gray-400 mt-0.5">
                {index + 1}.
              </span>
              <div>
                <p className="text-sm text-gray-800">{q.prompt}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Type: {q.type}
                </p>
              </div>
            </div>
          ))}
          {questions.length > 3 && (
            <p className="text-xs text-gray-400 pl-7">
              + {questions.length - 3} more question{questions.length - 3 !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

Then update the usage of `QuestionsSection` in the `LessonDetail` component's return to pass `lessonId`:

```jsx
      <QuestionsSection questions={lesson.questions} lessonId={id} />
```

- [ ] **Step 4: Add a fade-in animation to Tailwind**

In `frontend/tailwind.config.js`, add the `animate-fade-in` keyframe. If the file has an `extend` section, add inside `extend`:

```javascript
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
      },
```

> Note: If `tailwind.config.js` already has a `theme.extend` block, merge into it. If not, add `theme: { extend: { ... } }`.

- [ ] **Step 5: Add the quiz route to App.jsx**

In `frontend/src/App.jsx`:

1. Add the import at the top:

```javascript
import Quiz from "./pages/Quiz";
```

2. Add the route inside the `<ProtectedRoute>` layout group, after the `LessonDetail` route:

```jsx
          <Route path="practice/quiz/:lessonId" element={<Quiz />} />
```

The full routes block becomes:

```jsx
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
        </Route>
```

- [ ] **Step 6: Verify the frontend builds without errors**

```bash
cd frontend && npm run build
```

**Commit:** `feat(practice): add Duolingo-style quiz UI with progress bar and score summary`
