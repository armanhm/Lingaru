# Phase 4: Telegram Bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Telegram bot that runs as a separate process within the same Django codebase, providing quiz, vocabulary, and stats features via Telegram. The bot uses `python-telegram-bot` v20+ (async) and imports Django models directly via `django.setup()`.

**Architecture:** A new `apps.bot` Django app contains the bot setup, a `run_bot` management command, and handler modules for each command. The bot runs as its own Docker Compose service sharing the same backend image. It links Telegram users to existing Django `User` records via the `telegram_id` field (already on the model). Quiz flow uses `ConversationHandler` for multi-step interactions. All other commands are single-turn.

**Tech Stack:** Python 3.12, Django 5.x, python-telegram-bot 21.x, PostgreSQL, pytest, pytest-asyncio

---

## File Structure

```
backend/
├── apps/
│   └── bot/
│       ├── __init__.py
│       ├── apps.py
│       ├── bot.py                          # Bot application factory
│       ├── management/
│       │   ├── __init__.py
│       │   └── commands/
│       │       ├── __init__.py
│       │       └── run_bot.py              # Management command entry point
│       ├── handlers/
│       │   ├── __init__.py
│       │   ├── start.py                    # /start — register/link account
│       │   ├── quiz.py                     # /quiz — ConversationHandler quiz flow
│       │   ├── word.py                     # /word — word of the day
│       │   ├── stats.py                    # /stats — user stats
│       │   └── help.py                     # /help — command list
│       └── tests/
│           ├── __init__.py
│           ├── test_start.py
│           ├── test_word.py
│           ├── test_stats.py
│           └── test_quiz.py
│
├── config/
│   └── settings/
│       └── base.py                         # (edit: add TELEGRAM_BOT_TOKEN, apps.bot)

docker-compose.yml                          # (edit: add bot service)
docker-compose.dev.yml                      # (edit: add bot service override)
```

---

### Task 1: Bot App Scaffold & Dependencies

**Files:**
- Create: `backend/apps/bot/__init__.py`
- Create: `backend/apps/bot/apps.py`
- Create: `backend/apps/bot/bot.py` (empty placeholder)
- Create: `backend/apps/bot/handlers/__init__.py`
- Create: `backend/apps/bot/handlers/start.py` (empty placeholder)
- Create: `backend/apps/bot/handlers/quiz.py` (empty placeholder)
- Create: `backend/apps/bot/handlers/word.py` (empty placeholder)
- Create: `backend/apps/bot/handlers/stats.py` (empty placeholder)
- Create: `backend/apps/bot/handlers/help.py` (empty placeholder)
- Create: `backend/apps/bot/management/__init__.py`
- Create: `backend/apps/bot/management/commands/__init__.py`
- Create: `backend/apps/bot/management/commands/run_bot.py` (empty placeholder)
- Create: `backend/apps/bot/tests/__init__.py`
- Edit: `backend/requirements.txt` (add python-telegram-bot)
- Edit: `backend/config/settings/base.py` (add TELEGRAM_BOT_TOKEN + register app)

**No tests for this task — scaffold only.**

- [ ] **Step 1: Create the bot app directory and apps.py**

```python
# backend/apps/bot/__init__.py
```

```python
# backend/apps/bot/apps.py
from django.apps import AppConfig


class BotConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.bot"
    verbose_name = "Telegram Bot"
```

- [ ] **Step 2: Create empty placeholder files**

```python
# backend/apps/bot/bot.py
```

```python
# backend/apps/bot/handlers/__init__.py
```

```python
# backend/apps/bot/handlers/start.py
```

```python
# backend/apps/bot/handlers/quiz.py
```

```python
# backend/apps/bot/handlers/word.py
```

```python
# backend/apps/bot/handlers/stats.py
```

```python
# backend/apps/bot/handlers/help.py
```

```python
# backend/apps/bot/management/__init__.py
```

```python
# backend/apps/bot/management/commands/__init__.py
```

```python
# backend/apps/bot/management/commands/run_bot.py
```

```python
# backend/apps/bot/tests/__init__.py
```

- [ ] **Step 3: Add python-telegram-bot and pytest-asyncio to requirements.txt**

Add these two lines to `backend/requirements.txt` after the existing entries:

```
python-telegram-bot>=21.0,<22.0
pytest-asyncio>=0.23,<1.0
```

Full file after edit:

```
# backend/requirements.txt
Django>=5.1,<5.2
djangorestframework>=3.15,<3.16
djangorestframework-simplejwt>=5.3,<5.4
django-cors-headers>=4.3,<4.4
psycopg2-binary>=2.9,<2.10
redis>=5.0,<5.1
celery>=5.4,<5.5
gunicorn>=22.0,<23.0
python-decouple>=3.8,<3.9
pytest>=8.0,<9.0
pytest-django>=4.8,<4.9
pytest-cov>=5.0,<6.0
factory-boy>=3.3,<3.4
python-telegram-bot>=21.0,<22.0
pytest-asyncio>=0.23,<1.0
```

- [ ] **Step 4: Register apps.bot in INSTALLED_APPS and add TELEGRAM_BOT_TOKEN**

In `backend/config/settings/base.py`, add `"apps.bot"` after `"apps.practice"` in `INSTALLED_APPS`:

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
    "apps.bot",
]
```

Add the Telegram bot token setting at the bottom of the file, after the Celery settings:

```python
# Telegram Bot
TELEGRAM_BOT_TOKEN = config("TELEGRAM_BOT_TOKEN", default="")
```

- [ ] **Step 5: Run tests to verify scaffold does not break existing code**

```bash
cd backend && python -m pytest --tb=short -q
```

- [ ] **Step 6: Commit**

```
feat(bot): scaffold bot app structure and add dependencies

Create apps.bot with handlers, management command, and tests
directories. Add python-telegram-bot and pytest-asyncio to
requirements. Register app and TELEGRAM_BOT_TOKEN setting.
```

---

### Task 2: Bot Core & Start Command

**Files:**
- Edit: `backend/apps/bot/bot.py` (bot application factory)
- Edit: `backend/apps/bot/management/commands/run_bot.py` (management command)
- Edit: `backend/apps/bot/handlers/start.py` (/start handler)
- Create: `backend/apps/bot/tests/test_start.py`

**TDD approach:** Write tests for user creation/linking logic first, then implement.

- [ ] **Step 1: Write tests for /start handler logic (TDD — tests first, expect failure)**

```python
# backend/apps/bot/tests/test_start.py
import pytest
from django.contrib.auth import get_user_model
from apps.bot.handlers.start import get_or_create_telegram_user

User = get_user_model()


@pytest.mark.django_db
class TestGetOrCreateTelegramUser:
    def test_create_new_user_from_telegram(self):
        """When no user exists with this telegram_id, create one."""
        user, created = get_or_create_telegram_user(
            telegram_id=123456789,
            first_name="Jean",
            username="jean_fr",
        )
        assert created is True
        assert user.telegram_id == 123456789
        assert user.username == "tg_123456789"
        assert user.first_name == "Jean"

    def test_find_existing_user_by_telegram_id(self):
        """When a user already has this telegram_id, return them."""
        existing = User.objects.create_user(
            username="existing_user",
            email="existing@example.com",
            password="testpass123!",
            telegram_id=123456789,
        )
        user, created = get_or_create_telegram_user(
            telegram_id=123456789,
            first_name="Jean",
            username="jean_fr",
        )
        assert created is False
        assert user.pk == existing.pk

    def test_create_user_without_telegram_username(self):
        """Handle Telegram users who have no username set."""
        user, created = get_or_create_telegram_user(
            telegram_id=987654321,
            first_name="Marie",
            username=None,
        )
        assert created is True
        assert user.telegram_id == 987654321
        assert user.username == "tg_987654321"

    def test_create_user_sets_unusable_password(self):
        """Telegram-created users should not be able to log in via password."""
        user, created = get_or_create_telegram_user(
            telegram_id=111222333,
            first_name="Pierre",
            username="pierre_fr",
        )
        assert created is True
        assert user.has_usable_password() is False

    def test_duplicate_telegram_username_gets_suffixed(self):
        """If tg_<id> username is taken, the user is still created."""
        User.objects.create_user(
            username="tg_555666777",
            email="taken@example.com",
            password="testpass123!",
        )
        user, created = get_or_create_telegram_user(
            telegram_id=555666777,
            first_name="Luc",
            username="luc_fr",
        )
        assert created is True
        assert user.telegram_id == 555666777
        # Username should be different since tg_555666777 was taken
        assert user.username != "tg_555666777"
        assert user.username.startswith("tg_555666777_")
```

- [ ] **Step 2: Implement get_or_create_telegram_user in start handler**

```python
# backend/apps/bot/handlers/start.py
import logging

from django.contrib.auth import get_user_model
from telegram import Update
from telegram.ext import ContextTypes

logger = logging.getLogger(__name__)

User = get_user_model()


def get_or_create_telegram_user(
    telegram_id: int,
    first_name: str,
    username: str | None,
) -> tuple:
    """Find or create a Django user linked to a Telegram account.

    Returns (user, created) tuple.
    """
    try:
        user = User.objects.get(telegram_id=telegram_id)
        return user, False
    except User.DoesNotExist:
        pass

    # Build a unique username
    base_username = f"tg_{telegram_id}"
    final_username = base_username

    if User.objects.filter(username=base_username).exists():
        import uuid
        suffix = uuid.uuid4().hex[:6]
        final_username = f"{base_username}_{suffix}"

    user = User(
        username=final_username,
        telegram_id=telegram_id,
        first_name=first_name,
    )
    user.set_unusable_password()
    user.save()

    return user, True


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /start command — register or link Telegram account."""
    tg_user = update.effective_user
    user, created = get_or_create_telegram_user(
        telegram_id=tg_user.id,
        first_name=tg_user.first_name or "",
        username=tg_user.username,
    )

    if created:
        await update.message.reply_text(
            f"Bienvenue, {user.first_name}! Your Lingaru account has been created.\n"
            f"Use /help to see available commands."
        )
        logger.info("New user created via Telegram: %s (tg_id=%d)", user.username, tg_user.id)
    else:
        await update.message.reply_text(
            f"Welcome back, {user.first_name}! You are already registered.\n"
            f"Use /help to see available commands."
        )
        logger.info("Returning user via Telegram: %s (tg_id=%d)", user.username, tg_user.id)
```

- [ ] **Step 3: Implement bot.py — bot application factory**

```python
# backend/apps/bot/bot.py
import logging

from django.conf import settings
from telegram.ext import ApplicationBuilder, CommandHandler

from apps.bot.handlers.start import start_command
from apps.bot.handlers.help import help_command
from apps.bot.handlers.word import word_command
from apps.bot.handlers.stats import stats_command
from apps.bot.handlers.quiz import quiz_conversation_handler

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

    logger.info("Telegram bot application configured successfully.")
    return application
```

- [ ] **Step 4: Implement run_bot management command**

```python
# backend/apps/bot/management/commands/run_bot.py
import logging

from django.core.management.base import BaseCommand

from apps.bot.bot import create_bot_application

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Start the Lingaru Telegram bot (long-polling mode)."

    def handle(self, *args, **options):
        self.stdout.write("Starting Lingaru Telegram bot...")
        logger.info("Starting Lingaru Telegram bot...")

        application = create_bot_application()
        application.run_polling(drop_pending_updates=True)
```

- [ ] **Step 5: Run tests — they should pass**

```bash
cd backend && python -m pytest apps/bot/tests/test_start.py -v
```

- [ ] **Step 6: Commit**

```
feat(bot): implement bot core, run_bot command, and /start handler

Add bot.py application factory with handler registration, run_bot
management command for long-polling mode, and /start handler that
creates or finds a Django user by telegram_id. Includes tests for
user creation/linking logic.
```

---

### Task 3: Word & Stats Commands

**Files:**
- Edit: `backend/apps/bot/handlers/word.py` (/word handler)
- Edit: `backend/apps/bot/handlers/stats.py` (/stats handler)
- Edit: `backend/apps/bot/handlers/help.py` (/help handler)
- Create: `backend/apps/bot/tests/test_word.py`
- Create: `backend/apps/bot/tests/test_stats.py`

**TDD approach:** Write tests for query logic first, then implement handlers.

- [ ] **Step 1: Write tests for /word query logic (TDD — tests first, expect failure)**

```python
# backend/apps/bot/tests/test_word.py
import pytest
from django.contrib.auth import get_user_model
from apps.content.models import Topic, Lesson, Vocabulary
from apps.bot.handlers.word import get_random_vocabulary

User = get_user_model()


@pytest.fixture
def vocab_data(db):
    topic = Topic.objects.create(
        name_fr="Les salutations", name_en="Greetings",
        description="Basic greetings", icon="wave", order=1, difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic, type="vocab", title="Hello & Goodbye",
        content={}, order=1, difficulty=1,
    )
    v1 = Vocabulary.objects.create(
        lesson=lesson, french="bonjour", english="hello",
        pronunciation="/bɔ̃.ʒuʁ/", example_sentence="Bonjour, comment allez-vous?",
        gender="a", part_of_speech="interjection",
    )
    v2 = Vocabulary.objects.create(
        lesson=lesson, french="au revoir", english="goodbye",
        pronunciation="/o ʁə.vwaʁ/", example_sentence="Au revoir, a bientot!",
        gender="a", part_of_speech="interjection",
    )
    return [v1, v2]


@pytest.mark.django_db
class TestGetRandomVocabulary:
    def test_returns_vocabulary_item(self, vocab_data):
        result = get_random_vocabulary()
        assert result is not None
        assert result.pk in [v.pk for v in vocab_data]

    def test_returns_none_when_no_vocabulary(self, db):
        result = get_random_vocabulary()
        assert result is None

    def test_returns_vocabulary_with_expected_fields(self, vocab_data):
        result = get_random_vocabulary()
        assert hasattr(result, "french")
        assert hasattr(result, "english")
        assert hasattr(result, "pronunciation")
        assert hasattr(result, "example_sentence")
```

- [ ] **Step 2: Write tests for /stats query logic (TDD — tests first, expect failure)**

```python
# backend/apps/bot/tests/test_stats.py
import pytest
from django.contrib.auth import get_user_model
from apps.content.models import Topic, Lesson, Question
from apps.practice.models import QuizSession
from apps.bot.handlers.stats import get_user_stats

User = get_user_model()


@pytest.fixture
def user_with_quizzes(db):
    user = User.objects.create_user(
        username="statsuser", email="stats@example.com",
        password="testpass123!", telegram_id=111222333,
    )
    topic = Topic.objects.create(
        name_fr="Grammaire", name_en="Grammar",
        description="Grammar basics", icon="book", order=1, difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic, type="grammar", title="Conjugation",
        content={}, order=1, difficulty=1,
    )
    from django.utils import timezone
    QuizSession.objects.create(
        user=user, lesson=lesson, total_questions=5,
        score=4, completed_at=timezone.now(),
    )
    QuizSession.objects.create(
        user=user, lesson=lesson, total_questions=5,
        score=3, completed_at=timezone.now(),
    )
    return user


@pytest.mark.django_db
class TestGetUserStats:
    def test_returns_stats_for_user_with_quizzes(self, user_with_quizzes):
        stats = get_user_stats(user_with_quizzes)
        assert stats["quizzes_completed"] == 2
        assert stats["total_correct"] == 7
        assert stats["total_questions"] == 10

    def test_returns_zeroes_for_user_without_quizzes(self, db):
        user = User.objects.create_user(
            username="newuser", email="new@example.com",
            password="testpass123!", telegram_id=444555666,
        )
        stats = get_user_stats(user)
        assert stats["quizzes_completed"] == 0
        assert stats["total_correct"] == 0
        assert stats["total_questions"] == 0

    def test_stats_contain_expected_keys(self, user_with_quizzes):
        stats = get_user_stats(user_with_quizzes)
        assert "quizzes_completed" in stats
        assert "total_correct" in stats
        assert "total_questions" in stats
        assert "username" in stats
```

- [ ] **Step 3: Implement /word handler**

```python
# backend/apps/bot/handlers/word.py
import logging

from telegram import Update
from telegram.ext import ContextTypes

from apps.content.models import Vocabulary

logger = logging.getLogger(__name__)


def get_random_vocabulary():
    """Return a random Vocabulary item, or None if the table is empty."""
    item = Vocabulary.objects.order_by("?").first()
    return item


async def word_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /word command — send a random vocabulary item."""
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
```

- [ ] **Step 4: Implement /stats handler**

```python
# backend/apps/bot/handlers/stats.py
import logging

from django.contrib.auth import get_user_model
from django.db.models import Sum
from telegram import Update
from telegram.ext import ContextTypes

from apps.bot.handlers.start import get_or_create_telegram_user
from apps.practice.models import QuizSession

logger = logging.getLogger(__name__)

User = get_user_model()


def get_user_stats(user) -> dict:
    """Compute basic quiz stats for a user.

    Returns a dict with quizzes_completed, total_correct,
    total_questions, and username.

    Note: XP, level, and streak will be added in Phase 6
    (gamification). For now, stats are quiz-based only.
    """
    completed_sessions = QuizSession.objects.filter(
        user=user,
        completed_at__isnull=False,
    )

    aggregates = completed_sessions.aggregate(
        total_correct=Sum("score"),
        total_questions=Sum("total_questions"),
    )

    return {
        "username": user.first_name or user.username,
        "quizzes_completed": completed_sessions.count(),
        "total_correct": aggregates["total_correct"] or 0,
        "total_questions": aggregates["total_questions"] or 0,
    }


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /stats command — show user quiz statistics."""
    tg_user = update.effective_user
    user, _ = get_or_create_telegram_user(
        telegram_id=tg_user.id,
        first_name=tg_user.first_name or "",
        username=tg_user.username,
    )

    stats = get_user_stats(user)

    if stats["quizzes_completed"] == 0:
        await update.message.reply_text(
            f"Hi {stats['username']}! You haven't completed any quizzes yet.\n"
            f"Try /quiz to start one!"
        )
        return

    accuracy = (
        round(stats["total_correct"] / stats["total_questions"] * 100)
        if stats["total_questions"] > 0 else 0
    )

    message = (
        f"Stats for {stats['username']}:\n\n"
        f"Quizzes completed: {stats['quizzes_completed']}\n"
        f"Correct answers: {stats['total_correct']}/{stats['total_questions']}\n"
        f"Accuracy: {accuracy}%\n\n"
        f"XP, level, and streaks coming soon!"
    )
    await update.message.reply_text(message)
```

- [ ] **Step 5: Implement /help handler**

```python
# backend/apps/bot/handlers/help.py
from telegram import Update
from telegram.ext import ContextTypes


HELP_TEXT = (
    "Lingaru Bot — French Learning\n\n"
    "Available commands:\n"
    "/start — Register or link your account\n"
    "/quiz [topic] — Start a quick quiz\n"
    "/word — Random vocabulary word\n"
    "/stats — Your quiz statistics\n"
    "/help — Show this help message\n"
)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /help command — list available commands."""
    await update.message.reply_text(HELP_TEXT)
```

- [ ] **Step 6: Run tests — they should all pass**

```bash
cd backend && python -m pytest apps/bot/tests/test_word.py apps/bot/tests/test_stats.py -v
```

- [ ] **Step 7: Commit**

```
feat(bot): implement /word, /stats, and /help commands

Add /word handler returning a random vocabulary item with
pronunciation and example. Add /stats handler showing quiz
completion count and accuracy. Add /help handler listing all
available commands. Includes tests for query logic.
```

---

### Task 4: Quiz Command

**Files:**
- Edit: `backend/apps/bot/handlers/quiz.py` (/quiz ConversationHandler)
- Create: `backend/apps/bot/tests/test_quiz.py`

**TDD approach:** Test the quiz logic functions (lesson selection, answer checking, score computation) separately from the Telegram handler wiring.

- [ ] **Step 1: Write tests for quiz logic (TDD — tests first, expect failure)**

```python
# backend/apps/bot/tests/test_quiz.py
import pytest
from django.contrib.auth import get_user_model
from apps.content.models import Topic, Lesson, Question
from apps.practice.models import QuizSession, QuizAnswer
from apps.bot.handlers.quiz import (
    pick_quiz_lesson,
    check_answer,
    build_question_text,
    create_quiz_session,
    record_answer,
    complete_quiz_session,
)

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="quizbot_user", email="quizbot@example.com",
        password="testpass123!", telegram_id=999888777,
    )


@pytest.fixture
def topic_with_lessons(db):
    topic = Topic.objects.create(
        name_fr="Les salutations", name_en="Greetings",
        description="Basic greetings", icon="wave", order=1, difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic, type="vocab", title="Hello & Goodbye",
        content={}, order=1, difficulty=1,
    )
    Question.objects.create(
        lesson=lesson, type="mcq", prompt="What does 'bonjour' mean?",
        correct_answer="hello", wrong_answers=["goodbye", "thanks", "please"],
        explanation="Bonjour means hello.", difficulty=1,
    )
    Question.objects.create(
        lesson=lesson, type="fill_blank", prompt="___jour!",
        correct_answer="Bon", wrong_answers=[],
        explanation="Bonjour = good day.", difficulty=1,
    )
    Question.objects.create(
        lesson=lesson, type="translate", prompt="Translate: goodbye",
        correct_answer="au revoir", wrong_answers=[],
        explanation="Au revoir means goodbye.", difficulty=1,
    )
    return topic, lesson


@pytest.fixture
def empty_topic(db):
    topic = Topic.objects.create(
        name_fr="Vide", name_en="Empty",
        description="No lessons", icon="x", order=2, difficulty_level=1,
    )
    return topic


@pytest.mark.django_db
class TestPickQuizLesson:
    def test_pick_random_lesson_no_filter(self, topic_with_lessons):
        topic, lesson = topic_with_lessons
        result = pick_quiz_lesson(topic_name=None)
        assert result is not None
        assert result.pk == lesson.pk

    def test_pick_lesson_by_topic_name(self, topic_with_lessons):
        topic, lesson = topic_with_lessons
        result = pick_quiz_lesson(topic_name="Greetings")
        assert result is not None
        assert result.pk == lesson.pk

    def test_pick_lesson_by_partial_topic_name(self, topic_with_lessons):
        topic, lesson = topic_with_lessons
        result = pick_quiz_lesson(topic_name="greet")
        assert result is not None
        assert result.pk == lesson.pk

    def test_pick_lesson_nonexistent_topic(self, topic_with_lessons):
        result = pick_quiz_lesson(topic_name="nonexistent_topic_xyz")
        assert result is None

    def test_pick_lesson_returns_none_when_no_questions(self, empty_topic):
        # Empty topic has no lessons, so no questions
        result = pick_quiz_lesson(topic_name="Empty")
        assert result is None

    def test_pick_lesson_returns_none_when_db_empty(self, db):
        result = pick_quiz_lesson(topic_name=None)
        assert result is None


@pytest.mark.django_db
class TestCheckAnswer:
    def test_correct_answer_exact_match(self):
        assert check_answer("hello", "hello") is True

    def test_correct_answer_case_insensitive(self):
        assert check_answer("Hello", "hello") is True

    def test_correct_answer_with_whitespace(self):
        assert check_answer("  hello  ", "hello") is True

    def test_incorrect_answer(self):
        assert check_answer("goodbye", "hello") is False


@pytest.mark.django_db
class TestBuildQuestionText:
    def test_mcq_question(self, topic_with_lessons):
        _, lesson = topic_with_lessons
        question = Question.objects.filter(lesson=lesson, type="mcq").first()
        text = build_question_text(question)
        assert "What does 'bonjour' mean?" in text
        # MCQ should include options
        assert "hello" in text.lower()

    def test_non_mcq_question(self, topic_with_lessons):
        _, lesson = topic_with_lessons
        question = Question.objects.filter(lesson=lesson, type="fill_blank").first()
        text = build_question_text(question)
        assert "___jour!" in text


@pytest.mark.django_db
class TestCreateQuizSession:
    def test_creates_session(self, user, topic_with_lessons):
        _, lesson = topic_with_lessons
        session = create_quiz_session(user, lesson)
        assert session.user == user
        assert session.lesson == lesson
        assert session.total_questions == 3
        assert session.completed_at is None

    def test_session_has_correct_question_count(self, user, topic_with_lessons):
        _, lesson = topic_with_lessons
        session = create_quiz_session(user, lesson)
        assert session.total_questions == Question.objects.filter(lesson=lesson).count()


@pytest.mark.django_db
class TestRecordAnswer:
    def test_record_correct_answer(self, user, topic_with_lessons):
        _, lesson = topic_with_lessons
        session = create_quiz_session(user, lesson)
        question = Question.objects.filter(lesson=lesson).first()
        answer = record_answer(session, question, question.correct_answer)
        assert answer.is_correct is True

    def test_record_incorrect_answer(self, user, topic_with_lessons):
        _, lesson = topic_with_lessons
        session = create_quiz_session(user, lesson)
        question = Question.objects.filter(lesson=lesson).first()
        answer = record_answer(session, question, "wrong_answer_xyz")
        assert answer.is_correct is False


@pytest.mark.django_db
class TestCompleteQuizSession:
    def test_complete_session_with_score(self, user, topic_with_lessons):
        _, lesson = topic_with_lessons
        session = create_quiz_session(user, lesson)
        questions = list(Question.objects.filter(lesson=lesson))
        # Answer first two correctly, third incorrectly
        record_answer(session, questions[0], questions[0].correct_answer)
        record_answer(session, questions[1], questions[1].correct_answer)
        record_answer(session, questions[2], "wrong")

        result = complete_quiz_session(session)
        assert result.score == 2
        assert result.completed_at is not None
```

- [ ] **Step 2: Implement quiz logic functions**

```python
# backend/apps/bot/handlers/quiz.py
import logging
import random

from django.db.models import Count, Q
from django.utils import timezone
from telegram import Update
from telegram.ext import (
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from apps.bot.handlers.start import get_or_create_telegram_user
from apps.content.models import Lesson, Question
from apps.practice.models import QuizSession, QuizAnswer

logger = logging.getLogger(__name__)

# Conversation states
ANSWERING = 0


def pick_quiz_lesson(topic_name: str | None) -> Lesson | None:
    """Pick a random lesson that has questions.

    If topic_name is provided, filter by topic name (case-insensitive
    partial match against name_en or name_fr). Returns None if no
    suitable lesson is found.
    """
    lessons = Lesson.objects.annotate(
        question_count=Count("questions"),
    ).filter(question_count__gt=0)

    if topic_name:
        lessons = lessons.filter(
            Q(topic__name_en__icontains=topic_name)
            | Q(topic__name_fr__icontains=topic_name)
        )

    lesson = lessons.order_by("?").first()
    return lesson


def check_answer(user_answer: str, correct_answer: str) -> bool:
    """Check if the user's answer matches the correct answer.

    Case-insensitive, strips whitespace.
    """
    return user_answer.strip().lower() == correct_answer.strip().lower()


def build_question_text(question: Question) -> str:
    """Format a question for display in Telegram.

    For MCQ questions, shuffle and display the options as a numbered list.
    For other types, show just the prompt.
    """
    text = f"Q: {question.prompt}"

    if question.type == "mcq" and question.wrong_answers:
        options = [question.correct_answer] + list(question.wrong_answers)
        random.shuffle(options)
        option_lines = [f"  {i+1}. {opt}" for i, opt in enumerate(options)]
        text += "\n\n" + "\n".join(option_lines)
        text += "\n\nReply with the correct answer text."

    return text


def create_quiz_session(user, lesson: Lesson) -> QuizSession:
    """Create a new QuizSession for the given user and lesson."""
    question_count = Question.objects.filter(lesson=lesson).count()
    return QuizSession.objects.create(
        user=user,
        lesson=lesson,
        total_questions=question_count,
    )


def record_answer(
    session: QuizSession, question: Question, user_answer: str,
) -> QuizAnswer:
    """Record a quiz answer and return the QuizAnswer object."""
    is_correct = check_answer(user_answer, question.correct_answer)
    return QuizAnswer.objects.create(
        session=session,
        question=question,
        user_answer=user_answer,
        is_correct=is_correct,
    )


def complete_quiz_session(session: QuizSession) -> QuizSession:
    """Mark a quiz session as complete with the final score."""
    correct_count = session.answers.filter(is_correct=True).count()
    session.score = correct_count
    session.completed_at = timezone.now()
    session.save()
    return session


async def quiz_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle /quiz [topic] — start a new quiz conversation."""
    tg_user = update.effective_user
    user, _ = get_or_create_telegram_user(
        telegram_id=tg_user.id,
        first_name=tg_user.first_name or "",
        username=tg_user.username,
    )

    # Parse optional topic argument
    args = context.args
    topic_name = " ".join(args) if args else None

    lesson = pick_quiz_lesson(topic_name)
    if lesson is None:
        topic_msg = f' for topic "{topic_name}"' if topic_name else ""
        await update.message.reply_text(
            f"No quiz available{topic_msg}. Try /quiz without a topic!"
        )
        return ConversationHandler.END

    session = create_quiz_session(user, lesson)
    questions = list(Question.objects.filter(lesson=lesson).order_by("?"))

    # Store quiz state in context.user_data
    context.user_data["quiz_session_id"] = session.id
    context.user_data["quiz_questions"] = [q.id for q in questions]
    context.user_data["quiz_current_index"] = 0
    context.user_data["quiz_score"] = 0

    await update.message.reply_text(
        f"Starting quiz: {lesson.title}\n"
        f"Topic: {lesson.topic.name_en}\n"
        f"Questions: {len(questions)}\n\n"
        f"Send /cancel to quit at any time.\n"
    )

    # Send first question
    first_question = questions[0]
    await update.message.reply_text(build_question_text(first_question))

    return ANSWERING


async def quiz_answer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle a user's answer to a quiz question."""
    user_answer = update.message.text
    question_ids = context.user_data["quiz_questions"]
    current_index = context.user_data["quiz_current_index"]
    session_id = context.user_data["quiz_session_id"]

    session = QuizSession.objects.get(pk=session_id)
    question = Question.objects.get(pk=question_ids[current_index])

    answer = record_answer(session, question, user_answer)

    if answer.is_correct:
        context.user_data["quiz_score"] += 1
        feedback = "Correct!"
    else:
        feedback = f"Incorrect. The answer was: {question.correct_answer}"

    if question.explanation:
        feedback += f"\n{question.explanation}"

    # Move to next question
    next_index = current_index + 1
    context.user_data["quiz_current_index"] = next_index

    if next_index >= len(question_ids):
        # Quiz complete
        completed_session = complete_quiz_session(session)
        score = completed_session.score
        total = completed_session.total_questions

        await update.message.reply_text(
            f"{feedback}\n\n"
            f"Quiz complete!\n"
            f"Score: {score}/{total}\n"
            f"{'Great job!' if score == total else 'Keep practicing!'}"
        )

        # Clean up user_data
        for key in ["quiz_session_id", "quiz_questions", "quiz_current_index", "quiz_score"]:
            context.user_data.pop(key, None)

        return ConversationHandler.END

    # Send next question
    next_question = Question.objects.get(pk=question_ids[next_index])
    await update.message.reply_text(
        f"{feedback}\n\n"
        f"Question {next_index + 1}/{len(question_ids)}:\n"
        f"{build_question_text(next_question)}"
    )

    return ANSWERING


async def quiz_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle /cancel — abort the current quiz."""
    session_id = context.user_data.get("quiz_session_id")
    if session_id:
        try:
            session = QuizSession.objects.get(pk=session_id)
            complete_quiz_session(session)
        except QuizSession.DoesNotExist:
            pass

    for key in ["quiz_session_id", "quiz_questions", "quiz_current_index", "quiz_score"]:
        context.user_data.pop(key, None)

    await update.message.reply_text("Quiz cancelled. Use /quiz to start a new one!")
    return ConversationHandler.END


def quiz_conversation_handler() -> ConversationHandler:
    """Build the ConversationHandler for the /quiz flow."""
    return ConversationHandler(
        entry_points=[CommandHandler("quiz", quiz_start)],
        states={
            ANSWERING: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, quiz_answer),
            ],
        },
        fallbacks=[CommandHandler("cancel", quiz_cancel)],
    )
```

- [ ] **Step 3: Run tests — they should all pass**

```bash
cd backend && python -m pytest apps/bot/tests/test_quiz.py -v
```

- [ ] **Step 4: Run full bot test suite**

```bash
cd backend && python -m pytest apps/bot/tests/ -v
```

- [ ] **Step 5: Commit**

```
feat(bot): implement /quiz command with ConversationHandler

Add multi-step quiz flow: /quiz [topic] picks a random lesson,
sends questions one by one, checks answers with immediate feedback,
and shows final score. Uses ConversationHandler for state management.
Includes tests for lesson selection, answer checking, session
creation, and score computation.
```

---

### Task 5: Docker Integration

**Files:**
- Edit: `docker-compose.yml` (add bot service)
- Edit: `docker-compose.dev.yml` (add bot service override)

**No tests for this task — infrastructure only.**

- [ ] **Step 1: Add bot service to docker-compose.yml**

Add the `bot` service after the `celery-beat` service and before `nginx`:

```yaml
  bot:
    build: ./backend
    env_file: .env
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.prod
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: python manage.py run_bot
    restart: unless-stopped
```

Full `docker-compose.yml` after edit:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    env_file: .env
    environment:
      POSTGRES_DB: ${DB_NAME:-lingaru}
      POSTGRES_USER: ${DB_USER:-lingaru}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-lingaru}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-lingaru}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  django:
    build: ./backend
    env_file: .env
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.prod
    volumes:
      - static_files:/app/staticfiles
      - media_files:/app/media
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3"

  celery:
    build: ./backend
    env_file: .env
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.prod
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: celery -A config worker -l info

  celery-beat:
    build: ./backend
    env_file: .env
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.prod
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: celery -A config beat -l info

  bot:
    build: ./backend
    env_file: .env
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.prod
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: python manage.py run_bot
    restart: unless-stopped

  nginx:
    build: ./nginx
    ports:
      - "80:80"
    volumes:
      - static_files:/app/staticfiles:ro
      - media_files:/app/media:ro
    depends_on:
      - django

volumes:
  postgres_data:
  redis_data:
  static_files:
  media_files:
```

- [ ] **Step 2: Add bot service override to docker-compose.dev.yml**

Add the `bot` service override after the `celery-beat` override:

```yaml
  bot:
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.dev
    volumes:
      - ./backend:/app
```

Full `docker-compose.dev.yml` after edit:

```yaml
services:
  postgres:
    ports:
      - "5432:5432"

  redis:
    ports:
      - "6379:6379"

  django:
    build: ./backend
    env_file: .env
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.dev
    volumes:
      - ./backend:/app
      - static_files:/app/staticfiles
      - media_files:/app/media
    ports:
      - "8000:8000"
    command: python manage.py runserver 0.0.0.0:8000
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  celery:
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.dev
    volumes:
      - ./backend:/app

  celery-beat:
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.dev
    volumes:
      - ./backend:/app

  bot:
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.dev
    volumes:
      - ./backend:/app

  nginx:
    ports:
      - "80:80"
```

- [ ] **Step 3: Validate Docker Compose files**

```bash
docker compose config --quiet && docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet && echo "OK"
```

- [ ] **Step 4: Run full test suite to confirm nothing is broken**

```bash
cd backend && python -m pytest --tb=short -q
```

- [ ] **Step 5: Commit**

```
feat(bot): add bot service to Docker Compose

Add bot service to docker-compose.yml and docker-compose.dev.yml.
The bot shares the same backend image and runs via the run_bot
management command with restart policy in production.
```
