"""Async-safety and formatting regression tests for the Telegram handlers (#70).

These run the handlers against real ORM objects, with no patching of
sync_to_async, so a lazy FK access inside the event loop raises
SynchronousOnlyOperation exactly as it does in production.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from telegram import Update
from telegram import User as TGUser
from telegram.ext import ConversationHandler

from apps.bot.handlers.quiz import ANSWERING, quiz_answer, quiz_start
from apps.content.models import Lesson, Question, Topic


def make_update(text="", user_id=4242):
    update = MagicMock(spec=Update)
    update.effective_user = MagicMock(spec=TGUser)
    update.effective_user.id = user_id
    update.effective_user.first_name = "Tester"
    update.effective_user.username = "tester"
    update.message = MagicMock()
    update.message.text = text
    update.message.reply_text = AsyncMock()
    update.message.reply_voice = AsyncMock()
    update.message.chat.send_action = AsyncMock()
    return update


def make_context(args=None):
    context = MagicMock()
    context.user_data = {}
    context.args = args or []
    return context


def sent_texts(update):
    return [c.args[0] for c in update.message.reply_text.call_args_list]


@pytest.fixture
def lesson(db):
    topic = Topic.objects.create(
        name_fr="Salutations",
        name_en="Greetings",
        description="d",
        icon="w",
        order=1,
        difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic, type="vocab", title="Hello", content={}, order=1, difficulty=1
    )
    Question.objects.create(
        lesson=lesson,
        type="fill_blank",
        prompt="___jour",
        correct_answer="Bon",
        wrong_answers=[],
        explanation="",
        difficulty=1,
    )
    return lesson


@pytest.mark.django_db(transaction=True)
class TestQuizAsyncSafe:
    @pytest.mark.asyncio
    async def test_quiz_start_reads_topic_without_sync_error(self, lesson):
        update = make_update("/quiz")
        context = make_context()
        state = await quiz_start(update, context)
        assert state == ANSWERING
        assert "Topic: Greetings" in sent_texts(update)[0]

    @pytest.mark.asyncio
    async def test_quiz_answer_completes_with_real_orm(self, lesson):
        update = make_update("/quiz")
        context = make_context()
        await quiz_start(update, context)
        update.message.text = "bon"
        state = await quiz_answer(update, context)
        assert state == ConversationHandler.END
        assert "Score: 1/1" in sent_texts(update)[-1]
