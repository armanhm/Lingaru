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
        pronunciation="/\u0254\u0303.\u0292u\u0281/", example_sentence="Bonjour, comment allez-vous?",
        gender="a", part_of_speech="interjection",
    )
    v2 = Vocabulary.objects.create(
        lesson=lesson, french="au revoir", english="goodbye",
        pronunciation="/o \u0281\u0259.vwa\u0281/", example_sentence="Au revoir, a bientot!",
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
