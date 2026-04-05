# Phase 2: Content — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the content domain (Topics, Lessons, Vocabulary, Grammar, Reading Texts, Questions) with a rich Django Admin, DRF API endpoints, seed data, and React frontend pages — giving authors a way to manage French learning content and learners a way to browse it.

**Architecture:** A new `apps.content` Django app houses six models following the Topic -> Lesson -> (Vocabulary | GrammarRule | ReadingText | Question) hierarchy from the system design spec. DRF serializers expose nested read endpoints. Django Admin provides inline editing for lesson sub-content. React pages consume the API to render topic grids, lesson lists, and lesson detail views.

**Tech Stack:** Python 3.12, Django 5.x, Django REST Framework, PostgreSQL, pytest, React 18, Vite 5, React Router 6, Axios, Tailwind CSS 3

---

## File Structure

```
backend/
├── apps/
│   └── content/
│       ├── __init__.py
│       ├── apps.py
│       ├── models.py
│       ├── admin.py
│       ├── serializers.py
│       ├── views.py
│       ├── urls.py
│       ├── management/
│       │   ├── __init__.py
│       │   └── commands/
│       │       ├── __init__.py
│       │       └── seed_content.py
│       └── tests/
│           ├── __init__.py
│           ├── test_models.py
│           ├── test_serializers.py
│           └── test_views.py
│
├── config/
│   ├── settings/
│   │   └── base.py                     # (edit: add apps.content to INSTALLED_APPS)
│   └── urls.py                         # (edit: add content URLs)

frontend/
├── src/
│   ├── App.jsx                         # (edit: add topic/lesson routes)
│   ├── api/
│   │   └── content.js                  # NEW: content API functions
│   └── pages/
│       ├── Topics.jsx                  # NEW: topic grid
│       ├── TopicDetail.jsx             # NEW: lesson list for a topic
│       └── LessonDetail.jsx            # NEW: lesson view
```

---

### Task 1: Content Models

**Files:**
- Create: `backend/apps/content/__init__.py`
- Create: `backend/apps/content/apps.py`
- Create: `backend/apps/content/models.py`
- Create: `backend/apps/content/admin.py` (empty placeholder)
- Create: `backend/apps/content/serializers.py` (empty placeholder)
- Create: `backend/apps/content/views.py` (empty placeholder)
- Create: `backend/apps/content/urls.py` (empty placeholder)
- Create: `backend/apps/content/tests/__init__.py`
- Create: `backend/apps/content/tests/test_models.py`
- Edit: `backend/config/settings/base.py` (add `apps.content` to INSTALLED_APPS)

- [ ] **Step 1: Create the content app directory and apps.py**

```python
# backend/apps/content/__init__.py
```

```python
# backend/apps/content/apps.py
from django.apps import AppConfig


class ContentConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.content"
    verbose_name = "Content"
```

- [ ] **Step 2: Create empty placeholder files**

```python
# backend/apps/content/admin.py
from django.contrib import admin  # noqa: F401
```

```python
# backend/apps/content/serializers.py
from rest_framework import serializers  # noqa: F401
```

```python
# backend/apps/content/views.py
from rest_framework import generics  # noqa: F401
```

```python
# backend/apps/content/urls.py
from django.urls import path  # noqa: F401

app_name = "content"

urlpatterns = []
```

```python
# backend/apps/content/tests/__init__.py
```

- [ ] **Step 3: Register apps.content in INSTALLED_APPS**

In `backend/config/settings/base.py`, add `"apps.content"` after `"apps.users"`:

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
]
```

- [ ] **Step 4: Write model tests (TDD — tests first, expect failure)**

```python
# backend/apps/content/tests/test_models.py
import pytest
from apps.content.models import (
    Topic,
    Lesson,
    Vocabulary,
    GrammarRule,
    ReadingText,
    Question,
)


@pytest.mark.django_db
class TestTopicModel:
    def test_create_topic(self):
        topic = Topic.objects.create(
            name_fr="Les salutations",
            name_en="Greetings",
            description="Learn basic French greetings",
            icon="wave",
            order=1,
            difficulty_level=1,
        )
        assert topic.name_fr == "Les salutations"
        assert topic.name_en == "Greetings"
        assert topic.order == 1
        assert topic.difficulty_level == 1
        assert str(topic) == "Les salutations"

    def test_topic_ordering(self):
        Topic.objects.create(name_fr="Second", name_en="Second", order=2, difficulty_level=1)
        Topic.objects.create(name_fr="First", name_en="First", order=1, difficulty_level=1)
        topics = list(Topic.objects.all())
        assert topics[0].name_fr == "First"
        assert topics[1].name_fr == "Second"

    def test_topic_default_fields(self):
        topic = Topic.objects.create(
            name_fr="Test",
            name_en="Test",
            order=1,
            difficulty_level=1,
        )
        assert topic.description == ""
        assert topic.icon == ""


@pytest.mark.django_db
class TestLessonModel:
    def test_create_vocab_lesson(self):
        topic = Topic.objects.create(
            name_fr="Nourriture", name_en="Food", order=1, difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic,
            type="vocab",
            title="Common Foods",
            content={"intro": "Learn about food"},
            order=1,
            difficulty=1,
        )
        assert lesson.topic == topic
        assert lesson.type == "vocab"
        assert lesson.title == "Common Foods"
        assert lesson.content == {"intro": "Learn about food"}
        assert str(lesson) == "Common Foods"

    def test_create_grammar_lesson(self):
        topic = Topic.objects.create(
            name_fr="Grammaire", name_en="Grammar", order=1, difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic, type="grammar", title="Articles", content={}, order=1, difficulty=2,
        )
        assert lesson.type == "grammar"

    def test_create_text_lesson(self):
        topic = Topic.objects.create(
            name_fr="Lecture", name_en="Reading", order=1, difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic, type="text", title="At the Cafe", content={}, order=1, difficulty=1,
        )
        assert lesson.type == "text"

    def test_lesson_ordering(self):
        topic = Topic.objects.create(
            name_fr="Topic", name_en="Topic", order=1, difficulty_level=1,
        )
        Lesson.objects.create(topic=topic, type="vocab", title="Second", content={}, order=2, difficulty=1)
        Lesson.objects.create(topic=topic, type="vocab", title="First", content={}, order=1, difficulty=1)
        lessons = list(Lesson.objects.filter(topic=topic))
        assert lessons[0].title == "First"
        assert lessons[1].title == "Second"

    def test_lesson_cascade_delete(self):
        topic = Topic.objects.create(
            name_fr="Topic", name_en="Topic", order=1, difficulty_level=1,
        )
        Lesson.objects.create(topic=topic, type="vocab", title="Lesson", content={}, order=1, difficulty=1)
        topic.delete()
        assert Lesson.objects.count() == 0


@pytest.mark.django_db
class TestVocabularyModel:
    def test_create_vocabulary(self):
        topic = Topic.objects.create(
            name_fr="Nourriture", name_en="Food", order=1, difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic, type="vocab", title="Foods", content={}, order=1, difficulty=1,
        )
        vocab = Vocabulary.objects.create(
            lesson=lesson,
            french="le pain",
            english="bread",
            pronunciation="lə pɛ̃",
            example_sentence="Je mange du pain.",
            gender="m",
            part_of_speech="noun",
        )
        assert vocab.french == "le pain"
        assert vocab.english == "bread"
        assert vocab.gender == "m"
        assert vocab.audio_url is None
        assert str(vocab) == "le pain — bread"

    def test_vocabulary_with_audio(self):
        topic = Topic.objects.create(
            name_fr="T", name_en="T", order=1, difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic, type="vocab", title="L", content={}, order=1, difficulty=1,
        )
        vocab = Vocabulary.objects.create(
            lesson=lesson,
            french="bonjour",
            english="hello",
            pronunciation="bɔ̃ʒuʁ",
            example_sentence="Bonjour, comment allez-vous?",
            gender="n",
            part_of_speech="interjection",
            audio_url="https://example.com/bonjour.mp3",
        )
        assert vocab.audio_url == "https://example.com/bonjour.mp3"

    def test_vocabulary_cascade_delete(self):
        topic = Topic.objects.create(
            name_fr="T", name_en="T", order=1, difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic, type="vocab", title="L", content={}, order=1, difficulty=1,
        )
        Vocabulary.objects.create(
            lesson=lesson, french="le pain", english="bread",
            pronunciation="pɛ̃", example_sentence=".", gender="m", part_of_speech="noun",
        )
        lesson.delete()
        assert Vocabulary.objects.count() == 0


@pytest.mark.django_db
class TestGrammarRuleModel:
    def test_create_grammar_rule(self):
        topic = Topic.objects.create(
            name_fr="Grammaire", name_en="Grammar", order=1, difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic, type="grammar", title="Articles", content={}, order=1, difficulty=1,
        )
        rule = GrammarRule.objects.create(
            lesson=lesson,
            title="Definite Articles",
            explanation="In French, definite articles agree in gender and number.",
            formula="le (m) / la (f) / les (pl)",
            examples=["le chat", "la maison", "les enfants"],
            exceptions=["l'homme (before vowel)"],
        )
        assert rule.title == "Definite Articles"
        assert rule.formula == "le (m) / la (f) / les (pl)"
        assert len(rule.examples) == 3
        assert len(rule.exceptions) == 1
        assert str(rule) == "Definite Articles"

    def test_grammar_rule_cascade_delete(self):
        topic = Topic.objects.create(
            name_fr="T", name_en="T", order=1, difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic, type="grammar", title="L", content={}, order=1, difficulty=1,
        )
        GrammarRule.objects.create(
            lesson=lesson, title="Rule", explanation="...",
            formula="...", examples=[], exceptions=[],
        )
        lesson.delete()
        assert GrammarRule.objects.count() == 0


@pytest.mark.django_db
class TestReadingTextModel:
    def test_create_reading_text(self):
        topic = Topic.objects.create(
            name_fr="Lecture", name_en="Reading", order=1, difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic, type="text", title="At the Cafe", content={}, order=1, difficulty=1,
        )
        text = ReadingText.objects.create(
            lesson=lesson,
            title="Un cafe a Paris",
            content_fr="Marie entre dans un petit cafe...",
            content_en="Marie enters a small cafe...",
            vocabulary_highlights=["cafe", "petit", "entre"],
            comprehension_questions=[
                {"question": "Where does Marie go?", "answer": "A cafe"}
            ],
        )
        assert text.title == "Un cafe a Paris"
        assert text.content_fr.startswith("Marie")
        assert len(text.vocabulary_highlights) == 3
        assert len(text.comprehension_questions) == 1
        assert str(text) == "Un cafe a Paris"

    def test_reading_text_cascade_delete(self):
        topic = Topic.objects.create(
            name_fr="T", name_en="T", order=1, difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic, type="text", title="L", content={}, order=1, difficulty=1,
        )
        ReadingText.objects.create(
            lesson=lesson, title="T", content_fr="...", content_en="...",
            vocabulary_highlights=[], comprehension_questions=[],
        )
        lesson.delete()
        assert ReadingText.objects.count() == 0


@pytest.mark.django_db
class TestQuestionModel:
    def test_create_mcq_question(self):
        topic = Topic.objects.create(
            name_fr="Quiz", name_en="Quiz", order=1, difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic, type="vocab", title="Foods Quiz", content={}, order=1, difficulty=1,
        )
        question = Question.objects.create(
            lesson=lesson,
            type="mcq",
            prompt="What does 'le pain' mean?",
            correct_answer="bread",
            wrong_answers=["butter", "cheese", "milk"],
            explanation="'Le pain' means bread in French.",
            difficulty=1,
        )
        assert question.type == "mcq"
        assert question.correct_answer == "bread"
        assert len(question.wrong_answers) == 3
        assert str(question) == "What does 'le pain' mean?"

    def test_create_fill_blank_question(self):
        topic = Topic.objects.create(
            name_fr="T", name_en="T", order=1, difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic, type="grammar", title="L", content={}, order=1, difficulty=1,
        )
        question = Question.objects.create(
            lesson=lesson,
            type="fill_blank",
            prompt="Je ___ du pain. (manger, present)",
            correct_answer="mange",
            wrong_answers=["manges", "mangent", "mangeons"],
            explanation="First person singular of manger is mange.",
            difficulty=2,
        )
        assert question.type == "fill_blank"

    def test_create_translate_question(self):
        topic = Topic.objects.create(
            name_fr="T", name_en="T", order=1, difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic, type="vocab", title="L", content={}, order=1, difficulty=1,
        )
        question = Question.objects.create(
            lesson=lesson,
            type="translate",
            prompt="Translate: The cat is on the table.",
            correct_answer="Le chat est sur la table.",
            wrong_answers=[],
            explanation="Direct translation practice.",
            difficulty=2,
        )
        assert question.type == "translate"

    def test_question_cascade_delete(self):
        topic = Topic.objects.create(
            name_fr="T", name_en="T", order=1, difficulty_level=1,
        )
        lesson = Lesson.objects.create(
            topic=topic, type="vocab", title="L", content={}, order=1, difficulty=1,
        )
        Question.objects.create(
            lesson=lesson, type="mcq", prompt="?", correct_answer="a",
            wrong_answers=["b"], explanation=".", difficulty=1,
        )
        lesson.delete()
        assert Question.objects.count() == 0
```

- [ ] **Step 5: Run tests — confirm they fail (models do not exist yet)**

```bash
cd backend && python -m pytest apps/content/tests/test_models.py -v
# Expected: ImportError — models not found
```

- [ ] **Step 6: Create all content models**

```python
# backend/apps/content/models.py
from django.db import models


class Topic(models.Model):
    name_fr = models.CharField(max_length=200)
    name_en = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    icon = models.CharField(max_length=100, blank=True, default="")
    order = models.PositiveIntegerField()
    difficulty_level = models.PositiveIntegerField()

    class Meta:
        db_table = "content_topics"
        ordering = ["order"]

    def __str__(self):
        return self.name_fr


class Lesson(models.Model):
    TYPE_CHOICES = [
        ("vocab", "Vocabulary"),
        ("grammar", "Grammar"),
        ("text", "Reading Text"),
    ]

    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="lessons")
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    title = models.CharField(max_length=300)
    content = models.JSONField(default=dict, blank=True)
    order = models.PositiveIntegerField()
    difficulty = models.PositiveIntegerField()

    class Meta:
        db_table = "content_lessons"
        ordering = ["order"]

    def __str__(self):
        return self.title


class Vocabulary(models.Model):
    GENDER_CHOICES = [
        ("m", "Masculine"),
        ("f", "Feminine"),
        ("n", "Neutral"),
        ("a", "Not Applicable"),
    ]

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="vocabulary")
    french = models.CharField(max_length=300)
    english = models.CharField(max_length=300)
    pronunciation = models.CharField(max_length=200, blank=True, default="")
    example_sentence = models.TextField(blank=True, default="")
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default="a")
    part_of_speech = models.CharField(max_length=50, blank=True, default="")
    audio_url = models.URLField(max_length=500, null=True, blank=True)

    class Meta:
        db_table = "content_vocabulary"
        verbose_name_plural = "vocabulary"

    def __str__(self):
        return f"{self.french} — {self.english}"


class GrammarRule(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="grammar_rules")
    title = models.CharField(max_length=300)
    explanation = models.TextField()
    formula = models.CharField(max_length=500, blank=True, default="")
    examples = models.JSONField(default=list, blank=True)
    exceptions = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "content_grammar_rules"

    def __str__(self):
        return self.title


class ReadingText(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="reading_texts")
    title = models.CharField(max_length=300)
    content_fr = models.TextField()
    content_en = models.TextField()
    vocabulary_highlights = models.JSONField(default=list, blank=True)
    comprehension_questions = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "content_reading_texts"

    def __str__(self):
        return self.title


class Question(models.Model):
    TYPE_CHOICES = [
        ("mcq", "Multiple Choice"),
        ("fill_blank", "Fill in the Blank"),
        ("translate", "Translation"),
        ("match", "Matching"),
        ("listen", "Listening"),
        ("cloze", "Cloze"),
        ("conjugation", "Conjugation"),
    ]

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="questions")
    type = models.CharField(max_length=15, choices=TYPE_CHOICES)
    prompt = models.TextField()
    correct_answer = models.TextField()
    wrong_answers = models.JSONField(default=list, blank=True)
    explanation = models.TextField(blank=True, default="")
    difficulty = models.PositiveIntegerField()

    class Meta:
        db_table = "content_questions"

    def __str__(self):
        return self.prompt[:80]
```

- [ ] **Step 7: Create and run migrations**

```bash
cd backend && python manage.py makemigrations content
cd backend && python manage.py migrate
```

- [ ] **Step 8: Run tests — confirm they all pass**

```bash
cd backend && python -m pytest apps/content/tests/test_models.py -v
# Expected: All tests pass
```

- [ ] **Step 9: Commit**

```bash
git add backend/apps/content/ backend/config/settings/base.py
git commit -m "feat(content): add content models — Topic, Lesson, Vocabulary, GrammarRule, ReadingText, Question

TDD: tests written first, all passing. Six models with proper FK
relationships, ordering, cascade deletes, and JSON fields."
```

---

### Task 2: Content Admin

**Files:**
- Edit: `backend/apps/content/admin.py`

- [ ] **Step 1: Implement rich Django admin with inlines**

```python
# backend/apps/content/admin.py
from django.contrib import admin
from .models import Topic, Lesson, Vocabulary, GrammarRule, ReadingText, Question


class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 1
    fields = ("title", "type", "order", "difficulty")
    ordering = ("order",)


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ("name_fr", "name_en", "order", "difficulty_level")
    list_filter = ("difficulty_level",)
    search_fields = ("name_fr", "name_en", "description")
    ordering = ("order",)
    inlines = [LessonInline]


class VocabularyInline(admin.TabularInline):
    model = Vocabulary
    extra = 1
    fields = ("french", "english", "pronunciation", "gender", "part_of_speech", "example_sentence")


class GrammarRuleInline(admin.StackedInline):
    model = GrammarRule
    extra = 0
    fields = ("title", "explanation", "formula", "examples", "exceptions")


class ReadingTextInline(admin.StackedInline):
    model = ReadingText
    extra = 0
    fields = ("title", "content_fr", "content_en", "vocabulary_highlights", "comprehension_questions")


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1
    fields = ("type", "prompt", "correct_answer", "wrong_answers", "difficulty")


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("title", "topic", "type", "order", "difficulty")
    list_filter = ("type", "difficulty", "topic")
    search_fields = ("title",)
    ordering = ("topic__order", "order")
    inlines = [VocabularyInline, GrammarRuleInline, ReadingTextInline, QuestionInline]


@admin.register(Vocabulary)
class VocabularyAdmin(admin.ModelAdmin):
    list_display = ("french", "english", "gender", "part_of_speech", "lesson")
    list_filter = ("gender", "part_of_speech")
    search_fields = ("french", "english")


@admin.register(GrammarRule)
class GrammarRuleAdmin(admin.ModelAdmin):
    list_display = ("title", "lesson")
    search_fields = ("title", "explanation")


@admin.register(ReadingText)
class ReadingTextAdmin(admin.ModelAdmin):
    list_display = ("title", "lesson")
    search_fields = ("title", "content_fr", "content_en")


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("prompt_short", "type", "difficulty", "lesson")
    list_filter = ("type", "difficulty")
    search_fields = ("prompt", "correct_answer")

    @admin.display(description="Prompt")
    def prompt_short(self, obj):
        return obj.prompt[:80]
```

- [ ] **Step 2: Verify admin loads without errors**

```bash
cd backend && python manage.py check
# Expected: System check identified no issues.
```

- [ ] **Step 3: Commit**

```bash
git add backend/apps/content/admin.py
git commit -m "feat(content): add rich Django admin with inline editing

Inline editing for vocab, grammar, reading texts, and questions
within lessons. Search and filter support on all models."
```

---

### Task 3: Content Serializers

**Files:**
- Edit: `backend/apps/content/serializers.py`
- Create: `backend/apps/content/tests/test_serializers.py`

- [ ] **Step 1: Write serializer tests (TDD — tests first)**

```python
# backend/apps/content/tests/test_serializers.py
import pytest
from apps.content.models import (
    Topic,
    Lesson,
    Vocabulary,
    GrammarRule,
    ReadingText,
    Question,
)
from apps.content.serializers import (
    TopicListSerializer,
    TopicDetailSerializer,
    LessonListSerializer,
    LessonDetailSerializer,
    VocabularySerializer,
    GrammarRuleSerializer,
    ReadingTextSerializer,
    QuestionSerializer,
)


@pytest.fixture
def topic(db):
    return Topic.objects.create(
        name_fr="Les salutations",
        name_en="Greetings",
        description="Basic greetings",
        icon="wave",
        order=1,
        difficulty_level=1,
    )


@pytest.fixture
def vocab_lesson(topic):
    return Lesson.objects.create(
        topic=topic, type="vocab", title="Hello & Goodbye",
        content={"intro": "Greetings"}, order=1, difficulty=1,
    )


@pytest.fixture
def grammar_lesson(topic):
    return Lesson.objects.create(
        topic=topic, type="grammar", title="Articles",
        content={}, order=2, difficulty=2,
    )


@pytest.mark.django_db
class TestTopicListSerializer:
    def test_serializes_topic_fields(self, topic):
        serializer = TopicListSerializer(topic)
        data = serializer.data
        assert data["id"] == topic.id
        assert data["name_fr"] == "Les salutations"
        assert data["name_en"] == "Greetings"
        assert data["description"] == "Basic greetings"
        assert data["icon"] == "wave"
        assert data["order"] == 1
        assert data["difficulty_level"] == 1
        assert data["lesson_count"] == 0

    def test_lesson_count(self, topic, vocab_lesson, grammar_lesson):
        serializer = TopicListSerializer(topic)
        assert serializer.data["lesson_count"] == 2


@pytest.mark.django_db
class TestTopicDetailSerializer:
    def test_includes_lessons(self, topic, vocab_lesson, grammar_lesson):
        serializer = TopicDetailSerializer(topic)
        data = serializer.data
        assert len(data["lessons"]) == 2
        assert data["lessons"][0]["title"] == "Hello & Goodbye"
        assert data["lessons"][1]["title"] == "Articles"


@pytest.mark.django_db
class TestLessonDetailSerializer:
    def test_includes_vocabulary(self, vocab_lesson):
        Vocabulary.objects.create(
            lesson=vocab_lesson, french="bonjour", english="hello",
            pronunciation="bɔ̃ʒuʁ", example_sentence="Bonjour!",
            gender="n", part_of_speech="interjection",
        )
        serializer = LessonDetailSerializer(vocab_lesson)
        data = serializer.data
        assert len(data["vocabulary"]) == 1
        assert data["vocabulary"][0]["french"] == "bonjour"

    def test_includes_grammar_rules(self, grammar_lesson):
        GrammarRule.objects.create(
            lesson=grammar_lesson, title="Definite Articles",
            explanation="Le, la, les", formula="le/la/les",
            examples=["le chat"], exceptions=[],
        )
        serializer = LessonDetailSerializer(grammar_lesson)
        data = serializer.data
        assert len(data["grammar_rules"]) == 1
        assert data["grammar_rules"][0]["title"] == "Definite Articles"

    def test_includes_reading_texts(self, topic):
        lesson = Lesson.objects.create(
            topic=topic, type="text", title="Cafe", content={}, order=3, difficulty=1,
        )
        ReadingText.objects.create(
            lesson=lesson, title="Au cafe", content_fr="Bonjour...",
            content_en="Hello...", vocabulary_highlights=["bonjour"],
            comprehension_questions=[],
        )
        serializer = LessonDetailSerializer(lesson)
        data = serializer.data
        assert len(data["reading_texts"]) == 1
        assert data["reading_texts"][0]["title"] == "Au cafe"

    def test_includes_questions(self, vocab_lesson):
        Question.objects.create(
            lesson=vocab_lesson, type="mcq", prompt="What is bonjour?",
            correct_answer="hello", wrong_answers=["bye", "thanks"],
            explanation="Bonjour means hello.", difficulty=1,
        )
        serializer = LessonDetailSerializer(vocab_lesson)
        data = serializer.data
        assert len(data["questions"]) == 1
        assert data["questions"][0]["prompt"] == "What is bonjour?"

    def test_includes_topic_info(self, vocab_lesson):
        serializer = LessonDetailSerializer(vocab_lesson)
        data = serializer.data
        assert data["topic"]["name_fr"] == "Les salutations"


@pytest.mark.django_db
class TestVocabularySerializer:
    def test_serializes_all_fields(self, vocab_lesson):
        vocab = Vocabulary.objects.create(
            lesson=vocab_lesson, french="merci", english="thank you",
            pronunciation="mɛʁsi", example_sentence="Merci beaucoup!",
            gender="n", part_of_speech="interjection",
            audio_url="https://example.com/merci.mp3",
        )
        serializer = VocabularySerializer(vocab)
        data = serializer.data
        assert data["french"] == "merci"
        assert data["english"] == "thank you"
        assert data["pronunciation"] == "mɛʁsi"
        assert data["audio_url"] == "https://example.com/merci.mp3"


@pytest.mark.django_db
class TestQuestionSerializer:
    def test_serializes_all_fields(self, vocab_lesson):
        question = Question.objects.create(
            lesson=vocab_lesson, type="mcq", prompt="Test?",
            correct_answer="a", wrong_answers=["b", "c"],
            explanation="Because.", difficulty=1,
        )
        serializer = QuestionSerializer(question)
        data = serializer.data
        assert data["type"] == "mcq"
        assert data["correct_answer"] == "a"
        assert len(data["wrong_answers"]) == 2
```

- [ ] **Step 2: Run tests — confirm they fail (serializers not implemented)**

```bash
cd backend && python -m pytest apps/content/tests/test_serializers.py -v
# Expected: ImportError — serializers not found
```

- [ ] **Step 3: Implement all serializers**

```python
# backend/apps/content/serializers.py
from rest_framework import serializers
from .models import Topic, Lesson, Vocabulary, GrammarRule, ReadingText, Question


class VocabularySerializer(serializers.ModelSerializer):
    class Meta:
        model = Vocabulary
        fields = (
            "id", "french", "english", "pronunciation",
            "example_sentence", "gender", "part_of_speech", "audio_url",
        )


class GrammarRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = GrammarRule
        fields = (
            "id", "title", "explanation", "formula", "examples", "exceptions",
        )


class ReadingTextSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReadingText
        fields = (
            "id", "title", "content_fr", "content_en",
            "vocabulary_highlights", "comprehension_questions",
        )


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = (
            "id", "type", "prompt", "correct_answer",
            "wrong_answers", "explanation", "difficulty",
        )


class LessonListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ("id", "type", "title", "order", "difficulty")


class TopicMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ("id", "name_fr", "name_en")


class LessonDetailSerializer(serializers.ModelSerializer):
    topic = TopicMinimalSerializer(read_only=True)
    vocabulary = VocabularySerializer(many=True, read_only=True)
    grammar_rules = GrammarRuleSerializer(many=True, read_only=True)
    reading_texts = ReadingTextSerializer(many=True, read_only=True)
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Lesson
        fields = (
            "id", "topic", "type", "title", "content", "order", "difficulty",
            "vocabulary", "grammar_rules", "reading_texts", "questions",
        )


class TopicListSerializer(serializers.ModelSerializer):
    lesson_count = serializers.IntegerField(source="lessons.count", read_only=True)

    class Meta:
        model = Topic
        fields = (
            "id", "name_fr", "name_en", "description",
            "icon", "order", "difficulty_level", "lesson_count",
        )


class TopicDetailSerializer(serializers.ModelSerializer):
    lessons = LessonListSerializer(many=True, read_only=True)

    class Meta:
        model = Topic
        fields = (
            "id", "name_fr", "name_en", "description",
            "icon", "order", "difficulty_level", "lessons",
        )
```

- [ ] **Step 4: Run tests — confirm they all pass**

```bash
cd backend && python -m pytest apps/content/tests/test_serializers.py -v
# Expected: All tests pass
```

- [ ] **Step 5: Commit**

```bash
git add backend/apps/content/serializers.py backend/apps/content/tests/test_serializers.py
git commit -m "feat(content): add DRF serializers with nested lesson detail

TopicList/Detail, LessonList/Detail with nested vocabulary, grammar,
reading texts, and questions. TDD: all serializer tests passing."
```

---

### Task 4: Content Views & URLs

**Files:**
- Edit: `backend/apps/content/views.py`
- Edit: `backend/apps/content/urls.py`
- Edit: `backend/config/urls.py`
- Create: `backend/apps/content/tests/test_views.py`

- [ ] **Step 1: Write view tests (TDD — tests first)**

```python
# backend/apps/content/tests/test_views.py
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.content.models import (
    Topic,
    Lesson,
    Vocabulary,
    GrammarRule,
    ReadingText,
    Question,
)

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, db):
    user = User.objects.create_user(
        username="testuser", email="test@example.com", password="testpass123!",
    )
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def sample_topic(db):
    return Topic.objects.create(
        name_fr="Les salutations", name_en="Greetings",
        description="Basic greetings", icon="wave", order=1, difficulty_level=1,
    )


@pytest.fixture
def sample_lesson(sample_topic):
    return Lesson.objects.create(
        topic=sample_topic, type="vocab", title="Hello & Goodbye",
        content={"intro": "Greetings"}, order=1, difficulty=1,
    )


@pytest.fixture
def populated_lesson(sample_lesson):
    Vocabulary.objects.create(
        lesson=sample_lesson, french="bonjour", english="hello",
        pronunciation="bɔ̃ʒuʁ", example_sentence="Bonjour!",
        gender="n", part_of_speech="interjection",
    )
    Vocabulary.objects.create(
        lesson=sample_lesson, french="au revoir", english="goodbye",
        pronunciation="o ʁəvwaʁ", example_sentence="Au revoir!",
        gender="n", part_of_speech="interjection",
    )
    Question.objects.create(
        lesson=sample_lesson, type="mcq", prompt="What does bonjour mean?",
        correct_answer="hello", wrong_answers=["goodbye", "thanks"],
        explanation="Bonjour means hello.", difficulty=1,
    )
    return sample_lesson


@pytest.mark.django_db
class TestTopicListView:
    def test_list_topics_authenticated(self, authenticated_client, sample_topic):
        response = authenticated_client.get("/api/content/topics/")
        assert response.status_code == 200
        results = response.data["results"]
        assert len(results) == 1
        assert results[0]["name_fr"] == "Les salutations"
        assert "lesson_count" in results[0]

    def test_list_topics_unauthenticated(self, api_client, sample_topic):
        response = api_client.get("/api/content/topics/")
        assert response.status_code == 401

    def test_list_topics_ordered(self, authenticated_client, db):
        Topic.objects.create(name_fr="Second", name_en="Second", order=2, difficulty_level=1)
        Topic.objects.create(name_fr="First", name_en="First", order=1, difficulty_level=1)
        response = authenticated_client.get("/api/content/topics/")
        results = response.data["results"]
        assert results[0]["name_fr"] == "First"
        assert results[1]["name_fr"] == "Second"


@pytest.mark.django_db
class TestTopicDetailView:
    def test_topic_detail_with_lessons(self, authenticated_client, sample_topic, sample_lesson):
        response = authenticated_client.get(f"/api/content/topics/{sample_topic.id}/")
        assert response.status_code == 200
        assert response.data["name_fr"] == "Les salutations"
        assert len(response.data["lessons"]) == 1
        assert response.data["lessons"][0]["title"] == "Hello & Goodbye"

    def test_topic_detail_not_found(self, authenticated_client):
        response = authenticated_client.get("/api/content/topics/999/")
        assert response.status_code == 404

    def test_topic_detail_unauthenticated(self, api_client, sample_topic):
        response = api_client.get(f"/api/content/topics/{sample_topic.id}/")
        assert response.status_code == 401


@pytest.mark.django_db
class TestLessonDetailView:
    def test_lesson_detail_with_content(self, authenticated_client, populated_lesson):
        response = authenticated_client.get(f"/api/content/lessons/{populated_lesson.id}/")
        assert response.status_code == 200
        assert response.data["title"] == "Hello & Goodbye"
        assert len(response.data["vocabulary"]) == 2
        assert len(response.data["questions"]) == 1
        assert response.data["topic"]["name_fr"] == "Les salutations"

    def test_lesson_detail_not_found(self, authenticated_client):
        response = authenticated_client.get("/api/content/lessons/999/")
        assert response.status_code == 404

    def test_lesson_detail_unauthenticated(self, api_client, sample_lesson):
        response = api_client.get(f"/api/content/lessons/{sample_lesson.id}/")
        assert response.status_code == 401

    def test_lesson_detail_with_grammar(self, authenticated_client, sample_topic):
        lesson = Lesson.objects.create(
            topic=sample_topic, type="grammar", title="Articles",
            content={}, order=2, difficulty=2,
        )
        GrammarRule.objects.create(
            lesson=lesson, title="Definite Articles",
            explanation="Le, la, les", formula="le/la/les",
            examples=["le chat"], exceptions=[],
        )
        response = authenticated_client.get(f"/api/content/lessons/{lesson.id}/")
        assert response.status_code == 200
        assert len(response.data["grammar_rules"]) == 1

    def test_lesson_detail_with_reading_text(self, authenticated_client, sample_topic):
        lesson = Lesson.objects.create(
            topic=sample_topic, type="text", title="Cafe",
            content={}, order=3, difficulty=1,
        )
        ReadingText.objects.create(
            lesson=lesson, title="Au cafe", content_fr="Bonjour...",
            content_en="Hello...", vocabulary_highlights=["bonjour"],
            comprehension_questions=[{"q": "Where?", "a": "Cafe"}],
        )
        response = authenticated_client.get(f"/api/content/lessons/{lesson.id}/")
        assert response.status_code == 200
        assert len(response.data["reading_texts"]) == 1
```

- [ ] **Step 2: Run tests — confirm they fail (views/URLs not implemented)**

```bash
cd backend && python -m pytest apps/content/tests/test_views.py -v
# Expected: 404 or connection errors — URLs not wired
```

- [ ] **Step 3: Implement views**

```python
# backend/apps/content/views.py
from rest_framework import generics, permissions
from .models import Topic, Lesson
from .serializers import (
    TopicListSerializer,
    TopicDetailSerializer,
    LessonDetailSerializer,
)


class TopicListView(generics.ListAPIView):
    queryset = Topic.objects.all()
    serializer_class = TopicListSerializer
    permission_classes = (permissions.IsAuthenticated,)


class TopicDetailView(generics.RetrieveAPIView):
    queryset = Topic.objects.prefetch_related("lessons")
    serializer_class = TopicDetailSerializer
    permission_classes = (permissions.IsAuthenticated,)


class LessonDetailView(generics.RetrieveAPIView):
    queryset = Lesson.objects.select_related("topic").prefetch_related(
        "vocabulary", "grammar_rules", "reading_texts", "questions",
    )
    serializer_class = LessonDetailSerializer
    permission_classes = (permissions.IsAuthenticated,)
```

- [ ] **Step 4: Wire up content URLs**

```python
# backend/apps/content/urls.py
from django.urls import path
from . import views

app_name = "content"

urlpatterns = [
    path("topics/", views.TopicListView.as_view(), name="topic-list"),
    path("topics/<int:pk>/", views.TopicDetailView.as_view(), name="topic-detail"),
    path("lessons/<int:pk>/", views.LessonDetailView.as_view(), name="lesson-detail"),
]
```

- [ ] **Step 5: Add content URLs to root config**

In `backend/config/urls.py`, add the content URL include:

```python
# backend/config/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", include("apps.users.urls")),
    path("api/content/", include("apps.content.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

- [ ] **Step 6: Run tests — confirm they all pass**

```bash
cd backend && python -m pytest apps/content/tests/test_views.py -v
# Expected: All tests pass
```

- [ ] **Step 7: Run full test suite to check nothing is broken**

```bash
cd backend && python -m pytest -v
# Expected: All tests pass (users + content)
```

- [ ] **Step 8: Commit**

```bash
git add backend/apps/content/views.py backend/apps/content/urls.py backend/apps/content/tests/test_views.py backend/config/urls.py
git commit -m "feat(content): add API views and URL routing

GET /api/content/topics/ — list topics with lesson count
GET /api/content/topics/{id}/ — topic detail with lessons
GET /api/content/lessons/{id}/ — lesson detail with nested content
TDD: all view tests passing. Prefetch/select_related for performance."
```

---

### Task 5: Seed Data

**Files:**
- Create: `backend/apps/content/management/__init__.py`
- Create: `backend/apps/content/management/commands/__init__.py`
- Create: `backend/apps/content/management/commands/seed_content.py`

- [ ] **Step 1: Create management command directories**

```python
# backend/apps/content/management/__init__.py
```

```python
# backend/apps/content/management/commands/__init__.py
```

- [ ] **Step 2: Create seed_content management command**

```python
# backend/apps/content/management/commands/seed_content.py
from django.core.management.base import BaseCommand
from apps.content.models import (
    Topic,
    Lesson,
    Vocabulary,
    GrammarRule,
    ReadingText,
    Question,
)


class Command(BaseCommand):
    help = "Seed the database with sample French learning content"

    def handle(self, *args, **options):
        if Topic.objects.exists():
            self.stdout.write(self.style.WARNING("Content already exists. Skipping seed."))
            return

        self.stdout.write("Seeding content...")

        # ── Topic 1: Greetings & Introductions ──────────────────────
        t1 = Topic.objects.create(
            name_fr="Salutations et presentations",
            name_en="Greetings & Introductions",
            description="Learn to greet people and introduce yourself in French.",
            icon="hand-wave",
            order=1,
            difficulty_level=1,
        )

        # Lesson 1.1: Basic Greetings (vocab)
        l1_1 = Lesson.objects.create(
            topic=t1, type="vocab", title="Basic Greetings",
            content={"intro": "Master the essential French greetings used every day."},
            order=1, difficulty=1,
        )

        greetings_vocab = [
            ("bonjour", "hello / good morning", "bɔ̃ʒuʁ", "Bonjour, comment allez-vous?", "n", "interjection"),
            ("bonsoir", "good evening", "bɔ̃swaʁ", "Bonsoir, madame.", "n", "interjection"),
            ("salut", "hi / bye (informal)", "saly", "Salut, ca va?", "n", "interjection"),
            ("au revoir", "goodbye", "o ʁəvwaʁ", "Au revoir et bonne journee!", "n", "interjection"),
            ("merci", "thank you", "mɛʁsi", "Merci beaucoup!", "n", "interjection"),
            ("s'il vous plait", "please (formal)", "sil vu plɛ", "Un cafe, s'il vous plait.", "n", "phrase"),
            ("excusez-moi", "excuse me", "ɛkskyze mwa", "Excusez-moi, ou est la gare?", "n", "phrase"),
            ("comment allez-vous?", "how are you? (formal)", "kɔmɑ̃ tale vu", "Bonjour, comment allez-vous?", "n", "phrase"),
        ]

        for fr, en, pron, ex, gender, pos in greetings_vocab:
            Vocabulary.objects.create(
                lesson=l1_1, french=fr, english=en, pronunciation=pron,
                example_sentence=ex, gender=gender, part_of_speech=pos,
            )

        greetings_questions = [
            ("mcq", "What does 'bonjour' mean?", "hello / good morning",
             ["goodbye", "thank you", "please"],
             "'Bonjour' is the standard French greeting used during the day.", 1),
            ("mcq", "Which greeting is informal?", "salut",
             ["bonjour", "bonsoir", "comment allez-vous"],
             "'Salut' is the informal way to say hi or bye among friends.", 1),
            ("translate", "Translate: 'Good evening, madam.'", "Bonsoir, madame.",
             [], "'Bonsoir' is used in the evening. 'Madame' means madam.", 1),
            ("fill_blank", "_____, comment allez-vous? (greeting)", "Bonjour",
             ["Merci", "Au revoir", "Salut"],
             "The formal greeting to start a conversation is 'Bonjour'.", 1),
        ]

        for qtype, prompt, correct, wrong, expl, diff in greetings_questions:
            Question.objects.create(
                lesson=l1_1, type=qtype, prompt=prompt, correct_answer=correct,
                wrong_answers=wrong, explanation=expl, difficulty=diff,
            )

        # Lesson 1.2: Introducing Yourself (grammar)
        l1_2 = Lesson.objects.create(
            topic=t1, type="grammar", title="Introducing Yourself",
            content={"intro": "Learn the key phrases and grammar for self-introduction."},
            order=2, difficulty=1,
        )

        GrammarRule.objects.create(
            lesson=l1_2,
            title="Subject Pronouns",
            explanation=(
                "French subject pronouns are essential for conjugation. "
                "**je** (I), **tu** (you informal), **il/elle/on** (he/she/one), "
                "**nous** (we), **vous** (you formal/plural), **ils/elles** (they).\n\n"
                "Use **tu** with friends and family. Use **vous** with strangers, "
                "elders, and in professional settings."
            ),
            formula="je / tu / il, elle, on / nous / vous / ils, elles",
            examples=[
                "Je suis etudiant. (I am a student.)",
                "Tu es francais? (Are you French?)",
                "Elle est professeur. (She is a teacher.)",
                "Nous sommes amis. (We are friends.)",
            ],
            exceptions=[
                "On can mean 'we' in informal speech: On y va! (Let's go!)",
            ],
        )

        GrammarRule.objects.create(
            lesson=l1_2,
            title="Etre (to be) — Present Tense",
            explanation=(
                "**Etre** is one of the most important French verbs. "
                "It is irregular and must be memorized.\n\n"
                "| Pronoun | Conjugation |\n"
                "|---------|-------------|\n"
                "| je | suis |\n"
                "| tu | es |\n"
                "| il/elle/on | est |\n"
                "| nous | sommes |\n"
                "| vous | etes |\n"
                "| ils/elles | sont |"
            ),
            formula="je suis / tu es / il est / nous sommes / vous etes / ils sont",
            examples=[
                "Je suis Marie. (I am Marie.)",
                "Vous etes americain? (Are you American?)",
                "Ils sont contents. (They are happy.)",
            ],
            exceptions=[
                "C'est vs Il est: 'C'est un professeur' (It's a teacher) vs 'Il est professeur' (He is a teacher).",
            ],
        )

        intro_questions = [
            ("fill_blank", "Je _____ etudiant. (etre, present)", "suis",
             ["es", "est", "sommes"],
             "Je suis — first person singular of etre.", 1),
            ("mcq", "Which pronoun is formal 'you'?", "vous",
             ["tu", "il", "nous"],
             "'Vous' is the formal/plural form of 'you'.", 1),
            ("conjugation", "Conjugate 'etre' for 'nous':", "sommes",
             ["sont", "etes", "suis"],
             "Nous sommes — first person plural of etre.", 2),
        ]

        for qtype, prompt, correct, wrong, expl, diff in intro_questions:
            Question.objects.create(
                lesson=l1_2, type=qtype, prompt=prompt, correct_answer=correct,
                wrong_answers=wrong, explanation=expl, difficulty=diff,
            )

        # Lesson 1.3: At the Hotel (reading text)
        l1_3 = Lesson.objects.create(
            topic=t1, type="text", title="At the Hotel — Checking In",
            content={"intro": "Read a dialogue and practice comprehension."},
            order=3, difficulty=1,
        )

        ReadingText.objects.create(
            lesson=l1_3,
            title="A l'hotel",
            content_fr=(
                "Receptionniste: Bonsoir, bienvenue a l'Hotel du Lac. "
                "Comment puis-je vous aider?\n\n"
                "Marie: Bonsoir. J'ai une reservation au nom de Dupont.\n\n"
                "Receptionniste: Oui, madame Dupont. Vous avez une chambre double "
                "pour trois nuits. Voici votre cle. C'est la chambre 24, au deuxieme etage.\n\n"
                "Marie: Merci beaucoup. A quelle heure est le petit-dejeuner?\n\n"
                "Receptionniste: Le petit-dejeuner est servi de sept heures a dix heures "
                "dans la salle a manger. Bonne soiree, madame!\n\n"
                "Marie: Merci, bonne soiree!"
            ),
            content_en=(
                "Receptionist: Good evening, welcome to Hotel du Lac. "
                "How can I help you?\n\n"
                "Marie: Good evening. I have a reservation under the name Dupont.\n\n"
                "Receptionist: Yes, Mrs. Dupont. You have a double room "
                "for three nights. Here is your key. It's room 24, on the second floor.\n\n"
                "Marie: Thank you very much. What time is breakfast?\n\n"
                "Receptionist: Breakfast is served from seven to ten "
                "in the dining room. Have a good evening, madam!\n\n"
                "Marie: Thank you, good evening!"
            ),
            vocabulary_highlights=[
                "reservation", "chambre", "cle", "petit-dejeuner",
                "deuxieme etage", "salle a manger",
            ],
            comprehension_questions=[
                {"question": "What is the name on the reservation?", "answer": "Dupont"},
                {"question": "What type of room does Marie have?", "answer": "A double room (chambre double)"},
                {"question": "How many nights is the stay?", "answer": "Three nights (trois nuits)"},
                {"question": "What time is breakfast served?", "answer": "From 7:00 to 10:00"},
                {"question": "On which floor is room 24?", "answer": "The second floor (deuxieme etage)"},
            ],
        )

        hotel_questions = [
            ("mcq", "What does 'chambre' mean?", "room",
             ["key", "floor", "breakfast"],
             "'Chambre' means room in French.", 1),
            ("mcq", "What does 'petit-dejeuner' mean?", "breakfast",
             ["lunch", "dinner", "snack"],
             "'Petit-dejeuner' literally means 'small lunch' but refers to breakfast.", 1),
        ]

        for qtype, prompt, correct, wrong, expl, diff in hotel_questions:
            Question.objects.create(
                lesson=l1_3, type=qtype, prompt=prompt, correct_answer=correct,
                wrong_answers=wrong, explanation=expl, difficulty=diff,
            )

        # ── Topic 2: Food & Dining ─────────────────────────────────
        t2 = Topic.objects.create(
            name_fr="Nourriture et restaurant",
            name_en="Food & Dining",
            description="Learn vocabulary and phrases for ordering food and dining out.",
            icon="utensils",
            order=2,
            difficulty_level=1,
        )

        # Lesson 2.1: Food Vocabulary
        l2_1 = Lesson.objects.create(
            topic=t2, type="vocab", title="Common Foods",
            content={"intro": "Essential food vocabulary for everyday life."},
            order=1, difficulty=1,
        )

        food_vocab = [
            ("le pain", "bread", "lə pɛ̃", "Je voudrais du pain, s'il vous plait.", "m", "noun"),
            ("le fromage", "cheese", "lə fʁɔmaʒ", "La France est celebre pour son fromage.", "m", "noun"),
            ("la viande", "meat", "la vjɑ̃d", "Je ne mange pas de viande.", "f", "noun"),
            ("le poisson", "fish", "lə pwasɔ̃", "Le poisson est frais aujourd'hui.", "m", "noun"),
            ("les legumes", "vegetables", "le legym", "Il faut manger des legumes.", "m", "noun"),
            ("les fruits", "fruit", "le fʁɥi", "J'adore les fruits de saison.", "m", "noun"),
            ("l'eau", "water", "lo", "Une carafe d'eau, s'il vous plait.", "f", "noun"),
            ("le vin", "wine", "lə vɛ̃", "Un verre de vin rouge, s'il vous plait.", "m", "noun"),
            ("le cafe", "coffee", "lə kafe", "Un cafe creme, s'il vous plait.", "m", "noun"),
            ("le dessert", "dessert", "lə desɛʁ", "Qu'est-ce que vous avez comme dessert?", "m", "noun"),
        ]

        for fr, en, pron, ex, gender, pos in food_vocab:
            Vocabulary.objects.create(
                lesson=l2_1, french=fr, english=en, pronunciation=pron,
                example_sentence=ex, gender=gender, part_of_speech=pos,
            )

        food_questions = [
            ("mcq", "What does 'le pain' mean?", "bread",
             ["cheese", "meat", "fish"],
             "'Le pain' means bread. It is masculine.", 1),
            ("mcq", "Which word means 'cheese'?", "le fromage",
             ["le poisson", "la viande", "le dessert"],
             "'Le fromage' means cheese — France has over 400 varieties!", 1),
            ("fill_blank", "Je voudrais du _____, s'il vous plait. (bread)", "pain",
             ["fromage", "poisson", "vin"],
             "'Du pain' — some bread. 'Du' is the partitive article for masculine nouns.", 1),
            ("translate", "Translate: 'I don't eat meat.'", "Je ne mange pas de viande.",
             [], "Negation: ne...pas. After negation, 'de la' becomes 'de'.", 2),
            ("mcq", "What gender is 'la viande'?", "feminine",
             ["masculine", "neutral", "plural"],
             "'La' indicates feminine gender. La viande = the meat.", 1),
        ]

        for qtype, prompt, correct, wrong, expl, diff in food_questions:
            Question.objects.create(
                lesson=l2_1, type=qtype, prompt=prompt, correct_answer=correct,
                wrong_answers=wrong, explanation=expl, difficulty=diff,
            )

        # Lesson 2.2: Partitive Articles (grammar)
        l2_2 = Lesson.objects.create(
            topic=t2, type="grammar", title="Partitive Articles",
            content={"intro": "Learn when and how to use du, de la, de l', and des."},
            order=2, difficulty=2,
        )

        GrammarRule.objects.create(
            lesson=l2_2,
            title="Partitive Articles: du, de la, de l', des",
            explanation=(
                "Partitive articles express an unspecified quantity — 'some' or 'any'. "
                "They are required in French where English often uses no article.\n\n"
                "| Gender | Article | Example |\n"
                "|--------|---------|----------|\n"
                "| Masculine | du | du pain (some bread) |\n"
                "| Feminine | de la | de la viande (some meat) |\n"
                "| Before vowel | de l' | de l'eau (some water) |\n"
                "| Plural | des | des fruits (some fruit) |\n\n"
                "After negation, all partitive articles become **de** (or **d'** before a vowel)."
            ),
            formula="du (m) / de la (f) / de l' (vowel) / des (pl) → de (after negation)",
            examples=[
                "Je mange du fromage. (I eat some cheese.)",
                "Elle boit de la biere. (She drinks some beer.)",
                "Nous buvons de l'eau. (We drink some water.)",
                "Vous voulez des legumes? (Do you want some vegetables?)",
                "Je ne mange pas de viande. (I don't eat meat.)",
            ],
            exceptions=[
                "After expressions of quantity (beaucoup, peu, assez), use 'de': beaucoup de pain.",
                "With aimer, adorer, detester, preferer, use definite articles: J'adore le chocolat.",
            ],
        )

        partitive_questions = [
            ("fill_blank", "Je mange _____ fromage. (some)", "du",
             ["de la", "des", "de"],
             "'Fromage' is masculine, so the partitive article is 'du'.", 2),
            ("fill_blank", "Elle ne boit pas _____ vin. (negation)", "de",
             ["du", "de la", "des"],
             "After negation (ne...pas), partitive articles become 'de'.", 2),
            ("mcq", "Which partitive article is used before a vowel?", "de l'",
             ["du", "de la", "des"],
             "Before a vowel or silent h, use 'de l'': de l'eau, de l'huile.", 2),
        ]

        for qtype, prompt, correct, wrong, expl, diff in partitive_questions:
            Question.objects.create(
                lesson=l2_2, type=qtype, prompt=prompt, correct_answer=correct,
                wrong_answers=wrong, explanation=expl, difficulty=diff,
            )

        # Lesson 2.3: At the Restaurant (reading text)
        l2_3 = Lesson.objects.create(
            topic=t2, type="text", title="At the Restaurant",
            content={"intro": "Read a restaurant dialogue and test your comprehension."},
            order=3, difficulty=2,
        )

        ReadingText.objects.create(
            lesson=l2_3,
            title="Au restaurant",
            content_fr=(
                "Serveur: Bonjour! Voici le menu. Vous avez choisi?\n\n"
                "Pierre: Pas encore. Qu'est-ce que vous recommandez?\n\n"
                "Serveur: Notre plat du jour est le saumon grille avec des legumes "
                "de saison. C'est excellent.\n\n"
                "Pierre: Tres bien, je vais prendre le plat du jour. "
                "Et une carafe d'eau, s'il vous plait.\n\n"
                "Sophie: Pour moi, la salade nicoise et un verre de vin blanc.\n\n"
                "Serveur: Parfait. Et comme dessert?\n\n"
                "Pierre: On verra plus tard, merci.\n\n"
                "Serveur: Tres bien. Je reviens tout de suite avec vos boissons."
            ),
            content_en=(
                "Waiter: Hello! Here is the menu. Have you decided?\n\n"
                "Pierre: Not yet. What do you recommend?\n\n"
                "Waiter: Our dish of the day is grilled salmon with seasonal "
                "vegetables. It's excellent.\n\n"
                "Pierre: Very good, I'll have the dish of the day. "
                "And a carafe of water, please.\n\n"
                "Sophie: For me, the nicoise salad and a glass of white wine.\n\n"
                "Waiter: Perfect. And for dessert?\n\n"
                "Pierre: We'll see later, thank you.\n\n"
                "Waiter: Very well. I'll be right back with your drinks."
            ),
            vocabulary_highlights=[
                "menu", "plat du jour", "saumon grille", "legumes de saison",
                "carafe d'eau", "salade nicoise", "vin blanc", "boissons",
            ],
            comprehension_questions=[
                {"question": "What is the dish of the day?", "answer": "Grilled salmon with seasonal vegetables"},
                {"question": "What does Sophie order?", "answer": "Nicoise salad and a glass of white wine"},
                {"question": "What does Pierre order to drink?", "answer": "A carafe of water"},
                {"question": "Do they order dessert immediately?", "answer": "No, Pierre says they'll decide later"},
            ],
        )

        restaurant_questions = [
            ("mcq", "What does 'plat du jour' mean?", "dish of the day",
             ["dessert menu", "drink special", "appetizer"],
             "'Plat du jour' literally means 'dish of the day' — the daily special.", 1),
            ("mcq", "What does 'vin blanc' mean?", "white wine",
             ["red wine", "rose wine", "sparkling wine"],
             "'Vin blanc' = white wine. 'Vin rouge' = red wine.", 1),
            ("translate", "Translate: 'A carafe of water, please.'",
             "Une carafe d'eau, s'il vous plait.",
             [], "A very useful phrase when dining in France — water is free!", 2),
        ]

        for qtype, prompt, correct, wrong, expl, diff in restaurant_questions:
            Question.objects.create(
                lesson=l2_3, type=qtype, prompt=prompt, correct_answer=correct,
                wrong_answers=wrong, explanation=expl, difficulty=diff,
            )

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {Topic.objects.count()} topics, "
            f"{Lesson.objects.count()} lessons, "
            f"{Vocabulary.objects.count()} vocabulary items, "
            f"{GrammarRule.objects.count()} grammar rules, "
            f"{ReadingText.objects.count()} reading texts, "
            f"{Question.objects.count()} questions."
        ))
```

- [ ] **Step 3: Run the seed command**

```bash
cd backend && python manage.py seed_content
# Expected: "Seeded 2 topics, 6 lessons, 18 vocabulary items, 3 grammar rules, 2 reading texts, 17 questions."
```

- [ ] **Step 4: Commit**

```bash
git add backend/apps/content/management/
git commit -m "feat(content): add seed_content management command

Populates 2 topics (Greetings, Food & Dining) with 6 lessons,
18 vocab items, 3 grammar rules, 2 reading texts, and 17 questions.
Run: python manage.py seed_content"
```

---

### Task 6: Frontend Topic & Lesson Pages

**Files:**
- Create: `frontend/src/api/content.js`
- Create: `frontend/src/pages/Topics.jsx`
- Create: `frontend/src/pages/TopicDetail.jsx`
- Create: `frontend/src/pages/LessonDetail.jsx`
- Edit: `frontend/src/App.jsx`

- [ ] **Step 1: Create content API module**

```javascript
// frontend/src/api/content.js
import client from "./client";

export async function getTopics() {
  const response = await client.get("/content/topics/");
  return response.data;
}

export async function getTopic(id) {
  const response = await client.get(`/content/topics/${id}/`);
  return response.data;
}

export async function getLesson(id) {
  const response = await client.get(`/content/lessons/${id}/`);
  return response.data;
}
```

- [ ] **Step 2: Create Topics page (topic grid)**

```jsx
// frontend/src/pages/Topics.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getTopics } from "../api/content";

const DIFFICULTY_LABELS = {
  1: "Beginner",
  2: "Intermediate",
  3: "Advanced",
};

const DIFFICULTY_COLORS = {
  1: "bg-green-100 text-green-800",
  2: "bg-yellow-100 text-yellow-800",
  3: "bg-red-100 text-red-800",
};

export default function Topics() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTopics()
      .then((data) => {
        setTopics(data.results || []);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load topics.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-gray-500 text-lg">Loading topics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-red-500 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Topics</h1>
      <p className="text-gray-600 mb-8">
        Choose a topic to start learning French.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {topics.map((topic) => (
          <Link
            key={topic.id}
            to={`/topics/${topic.id}`}
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 block"
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {topic.name_fr}
              </h2>
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  DIFFICULTY_COLORS[topic.difficulty_level] ||
                  "bg-gray-100 text-gray-800"
                }`}
              >
                {DIFFICULTY_LABELS[topic.difficulty_level] || `Level ${topic.difficulty_level}`}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-1">{topic.name_en}</p>
            <p className="text-sm text-gray-600 mb-4">{topic.description}</p>
            <div className="flex items-center text-sm text-primary-600 font-medium">
              {topic.lesson_count} {topic.lesson_count === 1 ? "lesson" : "lessons"}
            </div>
          </Link>
        ))}
      </div>
      {topics.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No topics available yet. Check back soon!
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create TopicDetail page (lesson list)**

```jsx
// frontend/src/pages/TopicDetail.jsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getTopic } from "../api/content";

const TYPE_LABELS = {
  vocab: "Vocabulary",
  grammar: "Grammar",
  text: "Reading",
};

const TYPE_COLORS = {
  vocab: "bg-blue-100 text-blue-800",
  grammar: "bg-purple-100 text-purple-800",
  text: "bg-emerald-100 text-emerald-800",
};

export default function TopicDetail() {
  const { id } = useParams();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTopic(id)
      .then((data) => {
        setTopic(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.response?.status === 404 ? "Topic not found." : "Failed to load topic.");
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-gray-500 text-lg">Loading topic...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-red-500 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/topics"
        className="text-sm text-primary-600 hover:text-primary-800 mb-4 inline-block"
      >
        &larr; Back to Topics
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {topic.name_fr}
      </h1>
      <p className="text-gray-500 mb-2">{topic.name_en}</p>
      <p className="text-gray-600 mb-8">{topic.description}</p>

      <div className="space-y-4">
        {topic.lessons.map((lesson, index) => (
          <Link
            key={lesson.id}
            to={`/lesson/${lesson.id}`}
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-5 flex items-center justify-between block"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
                {index + 1}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{lesson.title}</h3>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    TYPE_COLORS[lesson.type] || "bg-gray-100 text-gray-800"
                  }`}
                >
                  {TYPE_LABELS[lesson.type] || lesson.type}
                </span>
              </div>
            </div>
            <span className="text-gray-400 text-xl">&rsaquo;</span>
          </Link>
        ))}
      </div>

      {topic.lessons.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No lessons in this topic yet.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create LessonDetail page**

```jsx
// frontend/src/pages/LessonDetail.jsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getLesson } from "../api/content";

function VocabularySection({ vocabulary }) {
  if (!vocabulary || vocabulary.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Vocabulary</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vocabulary.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-lg shadow p-4 border-l-4 border-primary-500"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-lg font-semibold text-gray-900">
                  {item.french}
                </span>
                {item.gender && item.gender !== "n" && item.gender !== "a" && (
                  <span className="ml-2 text-xs text-gray-400">
                    ({item.gender === "m" ? "masc." : "fem."})
                  </span>
                )}
              </div>
              {item.part_of_speech && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {item.part_of_speech}
                </span>
              )}
            </div>
            <p className="text-gray-700 mb-1">{item.english}</p>
            {item.pronunciation && (
              <p className="text-sm text-gray-400 mb-2">/{item.pronunciation}/</p>
            )}
            {item.example_sentence && (
              <p className="text-sm text-gray-500 italic">
                &ldquo;{item.example_sentence}&rdquo;
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function GrammarSection({ grammarRules }) {
  if (!grammarRules || grammarRules.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Grammar</h2>
      <div className="space-y-6">
        {grammarRules.map((rule) => (
          <div key={rule.id} className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {rule.title}
            </h3>
            {rule.formula && (
              <div className="bg-primary-50 text-primary-800 text-sm font-mono px-4 py-2 rounded mb-4">
                {rule.formula}
              </div>
            )}
            <div className="text-gray-700 whitespace-pre-line mb-4">
              {rule.explanation}
            </div>
            {rule.examples.length > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-gray-600 mb-2">
                  Examples:
                </h4>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  {rule.examples.map((ex, i) => (
                    <li key={i} className="text-sm">{ex}</li>
                  ))}
                </ul>
              </div>
            )}
            {rule.exceptions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-yellow-700 mb-2">
                  Exceptions:
                </h4>
                <ul className="list-disc list-inside text-yellow-700 space-y-1">
                  {rule.exceptions.map((ex, i) => (
                    <li key={i} className="text-sm">{ex}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ReadingSection({ readingTexts }) {
  if (!readingTexts || readingTexts.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Reading</h2>
      {readingTexts.map((text) => (
        <div key={text.id} className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {text.title}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-500 mb-2">
                Francais
              </h4>
              <div className="text-gray-800 whitespace-pre-line bg-blue-50 p-4 rounded">
                {text.content_fr}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-500 mb-2">
                English
              </h4>
              <div className="text-gray-600 whitespace-pre-line bg-gray-50 p-4 rounded">
                {text.content_en}
              </div>
            </div>
          </div>
          {text.vocabulary_highlights.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-600 mb-2">
                Key Vocabulary:
              </h4>
              <div className="flex flex-wrap gap-2">
                {text.vocabulary_highlights.map((word, i) => (
                  <span
                    key={i}
                    className="bg-yellow-100 text-yellow-800 text-sm px-3 py-1 rounded-full"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}
          {text.comprehension_questions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-600 mb-2">
                Comprehension Questions:
              </h4>
              <ol className="list-decimal list-inside space-y-2">
                {text.comprehension_questions.map((cq, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    {cq.question}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function QuestionsPreview({ questions }) {
  if (!questions || questions.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Practice Questions ({questions.length})
      </h2>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600 mb-4">
          This lesson has {questions.length} practice{" "}
          {questions.length === 1 ? "question" : "questions"} to test your
          knowledge.
        </p>
        <div className="flex flex-wrap gap-2">
          {[...new Set(questions.map((q) => q.type))].map((type) => {
            const count = questions.filter((q) => q.type === type).length;
            const labels = {
              mcq: "Multiple Choice",
              fill_blank: "Fill in the Blank",
              translate: "Translation",
              match: "Matching",
              listen: "Listening",
              cloze: "Cloze",
              conjugation: "Conjugation",
            };
            return (
              <span
                key={type}
                className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full"
              >
                {labels[type] || type}: {count}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function LessonDetail() {
  const { id } = useParams();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getLesson(id)
      .then((data) => {
        setLesson(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(
          err.response?.status === 404
            ? "Lesson not found."
            : "Failed to load lesson."
        );
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-gray-500 text-lg">Loading lesson...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-red-500 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div>
      {lesson.topic && (
        <Link
          to={`/topics/${lesson.topic.id}`}
          className="text-sm text-primary-600 hover:text-primary-800 mb-4 inline-block"
        >
          &larr; Back to {lesson.topic.name_en}
        </Link>
      )}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{lesson.title}</h1>

      <VocabularySection vocabulary={lesson.vocabulary} />
      <GrammarSection grammarRules={lesson.grammar_rules} />
      <ReadingSection readingTexts={lesson.reading_texts} />
      <QuestionsPreview questions={lesson.questions} />
    </div>
  );
}
```

- [ ] **Step 5: Add routes to App.jsx**

```jsx
// frontend/src/App.jsx
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import Topics from "./pages/Topics";
import TopicDetail from "./pages/TopicDetail";
import LessonDetail from "./pages/LessonDetail";

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
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
```

- [ ] **Step 6: Verify frontend builds without errors**

```bash
cd frontend && npm run build
# Expected: Build succeeds with no errors
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/content.js frontend/src/pages/Topics.jsx frontend/src/pages/TopicDetail.jsx frontend/src/pages/LessonDetail.jsx frontend/src/App.jsx
git commit -m "feat(content): add frontend topic grid, lesson list, and lesson detail pages

Topics page with difficulty badges and lesson counts. TopicDetail
shows ordered lesson list with type tags. LessonDetail renders
vocabulary cards, grammar rules, reading texts, and question previews.
Routes wired in App.jsx under ProtectedRoute."
```

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `cd backend && python -m pytest -v` — all tests pass (users + content)
- [ ] `cd backend && python manage.py check` — no system check issues
- [ ] `cd backend && python manage.py seed_content` — seed data loads
- [ ] `cd frontend && npm run build` — frontend builds cleanly
- [ ] Visit `/admin/` — content models visible with inline editing
- [ ] Visit `/api/content/topics/` — returns seeded topics
- [ ] Visit `/api/content/topics/1/` — returns topic with lessons
- [ ] Visit `/api/content/lessons/1/` — returns lesson with nested content
- [ ] Visit `/topics` in frontend — topic grid renders
- [ ] Visit `/topics/1` in frontend — lesson list renders
- [ ] Visit `/lesson/1` in frontend — lesson detail renders with vocab/grammar/text
