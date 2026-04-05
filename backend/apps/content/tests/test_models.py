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
            pronunciation="l\u0259 p\u025b\u0303",
            example_sentence="Je mange du pain.",
            gender="m",
            part_of_speech="noun",
        )
        assert vocab.french == "le pain"
        assert vocab.english == "bread"
        assert vocab.gender == "m"
        assert vocab.audio_url is None
        assert str(vocab) == "le pain \u2014 bread"

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
            pronunciation="b\u0254\u0303\u0292u\u0281",
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
            pronunciation="p\u025b\u0303", example_sentence=".", gender="m", part_of_speech="noun",
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
