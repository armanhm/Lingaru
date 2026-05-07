from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from django.contrib.auth import get_user_model

from apps.bot.handlers.word import get_random_vocabulary, word_command
from apps.content.models import Lesson, Topic, Vocabulary

User = get_user_model()


@pytest.fixture
def vocab_data(db):
    topic = Topic.objects.create(
        name_fr="Les salutations",
        name_en="Greetings",
        description="Basic greetings",
        icon="wave",
        order=1,
        difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic,
        type="vocab",
        title="Hello & Goodbye",
        content={},
        order=1,
        difficulty=1,
    )
    v1 = Vocabulary.objects.create(
        lesson=lesson,
        french="bonjour",
        english="hello",
        pronunciation="/\u0254\u0303.\u0292u\u0281/",
        example_sentence="Bonjour, comment allez-vous?",
        gender="a",
        part_of_speech="interjection",
    )
    v2 = Vocabulary.objects.create(
        lesson=lesson,
        french="au revoir",
        english="goodbye",
        pronunciation="/o \u0281\u0259.vwa\u0281/",
        example_sentence="Au revoir, a bientot!",
        gender="a",
        part_of_speech="interjection",
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


@pytest.fixture
def tg_update():
    mock = AsyncMock()
    mock.message = AsyncMock()
    mock.message.reply_text = AsyncMock()
    mock.message.reply_audio = AsyncMock()
    return mock


@pytest.fixture
def tg_context():
    return MagicMock()


@pytest.mark.django_db
class TestWordCommandAudio:
    @pytest.mark.asyncio
    @patch("apps.bot.handlers.word.get_or_create_audio")
    @patch("apps.bot.handlers.word.get_random_vocabulary")
    async def test_word_sends_audio(self, mock_get_vocab, mock_audio, tg_update, tg_context):
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
            await word_command(tg_update, tg_context)

        tg_update.message.reply_text.assert_called_once()
        mock_audio.assert_called_once_with(text="Bonjour", language="fr")

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.word.get_random_vocabulary")
    async def test_word_no_vocab(self, mock_get_vocab, tg_update, tg_context):
        mock_get_vocab.return_value = None

        await word_command(tg_update, tg_context)

        tg_update.message.reply_text.assert_called_once()
        assert "No vocabulary" in tg_update.message.reply_text.call_args[0][0]
