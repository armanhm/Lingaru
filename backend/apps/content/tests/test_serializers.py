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
            pronunciation="b\u0254\u0303\u0292u\u0281", example_sentence="Bonjour!",
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
            pronunciation="m\u025b\u0281si", example_sentence="Merci beaucoup!",
            gender="n", part_of_speech="interjection",
            audio_url="https://example.com/merci.mp3",
        )
        serializer = VocabularySerializer(vocab)
        data = serializer.data
        assert data["french"] == "merci"
        assert data["english"] == "thank you"
        assert data["pronunciation"] == "m\u025b\u0281si"
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
