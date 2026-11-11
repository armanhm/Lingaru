"""#70: HTML formatting, long-reply chunking and no blocking calls on the event loop."""

import re
import threading
from unittest.mock import MagicMock, patch

import pytest

from apps.agents.models import Agent
from apps.assistant.models import Conversation
from apps.bot.handlers.agents import agent_run, agents_command
from apps.bot.handlers.chat import CHATTING, chat_message, chat_photo, chat_voice
from apps.bot.handlers.common import MAX_LEN, chunk_text
from apps.bot.handlers.daily import daily_command
from apps.bot.handlers.dictation import dictation_answer
from apps.bot.handlers.news import news_command
from apps.bot.handlers.word import word_command
from apps.bot.tests.test_async_safety import make_context, make_update, sent_texts
from apps.content.models import Lesson, Topic, Vocabulary
from apps.discover.models import DiscoverCard
from apps.progress.models import SRSCard
from apps.users.models import User
from services.llm.base import LLMResponse

NASTY = "a_b*c[d]`e<f>&g"


def assert_valid_telegram_html(text):
    """Cheap stand-in for Telegram's parser: no raw `<`, `>` or `&` outside known tags."""
    stripped = re.sub(r"</?(b|i|a|code|pre)(\s+href=\"[^\"<>]*\")?>", "", text)
    assert "<" not in stripped and ">" not in stripped, text
    assert not re.search(r"&(?!amp;|lt;|gt;|quot;|#x27;)", stripped), text


def assert_html_sends(update):
    calls = update.message.reply_text.call_args_list
    assert calls
    for call in calls:
        assert call.kwargs.get("parse_mode") == "HTML"
        assert_valid_telegram_html(call.args[0])


class TestChunking:
    def test_short_text_is_one_chunk(self):
        assert chunk_text("hello") == ["hello"]

    def test_long_text_is_split_within_limit(self):
        text = "\n".join(["x" * 100] * 120)
        chunks = chunk_text(text)
        assert len(chunks) > 1
        assert all(len(c) <= MAX_LEN for c in chunks)
        assert "\n".join(chunks) == text

    def test_single_huge_line_is_hard_split(self):
        chunks = chunk_text("y" * (MAX_LEN * 2 + 5))
        assert all(len(c) <= MAX_LEN for c in chunks)
        assert "".join(chunks) == "y" * (MAX_LEN * 2 + 5)


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="fmtuser", email="fmt@example.com", password="x-pass-123!", telegram_id=4242
    )


@pytest.fixture
def vocab(db):
    topic = Topic.objects.create(
        name_fr="T", name_en="T", description="", icon="t", order=1, difficulty_level=1
    )
    lesson = Lesson.objects.create(
        topic=topic, type="vocab", title="T", content={}, order=1, difficulty=1
    )
    return Vocabulary.objects.create(
        lesson=lesson,
        french=NASTY,
        english="x_y*z",
        pronunciation="/p_r/",
        gender="m",
        part_of_speech="noun",
        example_sentence="Il dit _bonjour_ [a] <b>",
    )


@pytest.mark.django_db(transaction=True)
class TestHtmlFormatting:
    @pytest.mark.asyncio
    async def test_news_title_with_markdown_chars(self):
        await DiscoverCard.objects.acreate(
            type="news",
            title=NASTY,
            content_json={
                "source_name": "Le_Monde*",
                "article_fr": "Texte _avec_ [crochets] et <balises> & plus\nligne 2",
                "article_en": "English _text_",
                "vocabulary": [{"french": "a_b", "english": "c*d"}],
            },
            source_url="https://example.com/a?x=1&y=2",
        )
        update = make_update()
        await news_command(update, make_context())
        assert_html_sends(update)

    @pytest.mark.asyncio
    async def test_news_long_article_is_chunked(self):
        await DiscoverCard.objects.acreate(
            type="news",
            title="t",
            content_json={"article_fr": "\n".join(["phrase _longue_"] * 600)},
        )
        update = make_update()
        await news_command(update, make_context())
        texts = sent_texts(update)
        assert len(texts) > 1
        assert all(len(t) <= MAX_LEN for t in texts)
        assert_html_sends(update)

    @pytest.mark.asyncio
    async def test_trivia_with_markdown_chars(self):
        await DiscoverCard.objects.acreate(
            type="trivia",
            title=NASTY,
            content_json={"fact_fr": "a_b*c[", "fact_en": "x_y"},
        )
        update = make_update()
        await news_command(update, make_context())
        assert_html_sends(update)

    @pytest.mark.asyncio
    async def test_daily_with_real_orm_and_markdown_chars(self, user, vocab):
        await SRSCard.objects.acreate(user=user, vocabulary=vocab)
        update = make_update(user_id=user.telegram_id)
        await daily_command(update, make_context())
        assert_html_sends(update)
        assert "1 card(s) due" in sent_texts(update)[0]

    @pytest.mark.asyncio
    async def test_word_markdown_chars(self, vocab):
        update = make_update()
        with patch(
            "apps.bot.handlers.word.get_or_create_audio", side_effect=RuntimeError("no tts")
        ):
            await word_command(update, make_context())
        assert_html_sends(update)

    @pytest.mark.asyncio
    async def test_dictation_answer_markdown_chars(self):
        update = make_update(NASTY)
        context = make_context()
        context.user_data["dictation_expected"] = "Il dit _bonjour_ [a]"
        await dictation_answer(update, context)
        assert_html_sends(update)

    @pytest.mark.asyncio
    async def test_agents_list_markdown_chars(self):
        await Agent.objects.acreate(
            slug="weird", name="Cor_rec*teur", emoji="x", tagline="a [b] _c_", system_prompt="p"
        )
        update = make_update()
        await agents_command(update, make_context())
        assert_html_sends(update)


@pytest.mark.django_db(transaction=True)
class TestNoBlockingOnEventLoop:
    """The LLM/STT SDK calls must run off the event-loop thread."""

    async def _conversation(self, user):
        conv = await Conversation.objects.acreate(user=user, title="t", context="telegram")
        context = make_context()
        context.user_data["conversation_id"] = conv.id
        context.user_data["user_id"] = user.id
        return context

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.chat.create_llm_router")
    async def test_chat_message_llm_off_loop_and_chunked(self, mock_factory, user):
        loop_thread = threading.get_ident()
        seen = []

        def generate(**kwargs):
            seen.append(threading.get_ident())
            return LLMResponse(content="mot\n" * 3000, provider="t", tokens_used=1)

        mock_factory.return_value.generate.side_effect = generate
        context = await self._conversation(user)
        update = make_update("Bonjour")
        assert await chat_message(update, context) == CHATTING
        assert seen and seen[0] != loop_thread
        texts = sent_texts(update)
        assert len(texts) > 1 and all(len(t) <= MAX_LEN for t in texts)

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.chat.create_llm_router")
    async def test_chat_photo_llm_off_loop(self, mock_factory, user):
        loop_thread = threading.get_ident()
        seen = []

        def generate_with_image(**kwargs):
            seen.append(threading.get_ident())
            return LLMResponse(content="une image", provider="t", tokens_used=1)

        mock_factory.return_value.generate_with_image.side_effect = generate_with_image
        context = await self._conversation(user)
        update = make_update()
        update.message.caption = "c"
        photo = MagicMock()
        file_obj = MagicMock()

        async def download():
            return bytearray(b"img")

        file_obj.download_as_bytearray = download

        async def get_file():
            return file_obj

        photo.get_file = get_file
        update.message.photo = [photo]
        await chat_photo(update, context)
        assert seen and seen[0] != loop_thread

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.chat.get_or_create_audio", side_effect=RuntimeError("no tts"))
    @patch("apps.bot.handlers.chat.create_llm_router")
    @patch("apps.bot.handlers.chat.GroqWhisperProvider")
    async def test_chat_voice_stt_and_llm_off_loop(self, mock_stt_cls, mock_factory, _tts, user):
        loop_thread = threading.get_ident()
        seen = []

        def transcribe(**kwargs):
            seen.append(threading.get_ident())
            return MagicMock(transcription="salut")

        def generate(**kwargs):
            seen.append(threading.get_ident())
            return LLMResponse(content="reponse", provider="t", tokens_used=1)

        mock_stt_cls.return_value.transcribe.side_effect = transcribe
        mock_factory.return_value.generate.side_effect = generate
        context = await self._conversation(user)
        update = make_update()
        voice = MagicMock()
        file_obj = MagicMock()

        async def download():
            return bytearray(b"ogg")

        file_obj.download_as_bytearray = download

        async def get_file():
            return file_obj

        voice.get_file = get_file
        update.message.voice = voice
        await chat_voice(update, context)
        assert len(seen) == 2 and all(t != loop_thread for t in seen)

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.agents.create_llm_router")
    async def test_agent_run_chunks_long_reply(self, mock_factory):
        await Agent.objects.acreate(slug="a", name="A", emoji="x", system_prompt="p")
        mock_factory.return_value.generate.return_value = LLMResponse(
            content="mot\n" * 3000, provider="t", tokens_used=1
        )
        context = make_context()
        context.user_data["pending_agent_slug"] = "a"
        update = make_update("texte")
        await agent_run(update, context)
        texts = sent_texts(update)
        assert len(texts) > 1 and all(len(t) <= MAX_LEN for t in texts)
