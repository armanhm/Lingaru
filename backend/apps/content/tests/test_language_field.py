import pytest

from apps.content.models import (
    GrammarRule,
    Lesson,
    Question,
    ReadingText,
    Topic,
    VideoLesson,
    Vocabulary,
)


@pytest.mark.django_db
def test_topic_language_defaults_to_fr():
    t = Topic.objects.create(
        name_fr="Salutations", name_en="Greetings", order=1, difficulty_level=1
    )
    assert t.language == "fr"


@pytest.mark.django_db
def test_vocabulary_language_defaults_to_fr():
    t = Topic.objects.create(name_fr="x", name_en="x", order=1, difficulty_level=1)
    lesson = Lesson.objects.create(topic=t, title="L1", order=1, type="vocab", difficulty=1)
    v = Vocabulary.objects.create(lesson=lesson, french="bonjour", english="hello")
    assert v.language == "fr"


@pytest.mark.django_db
def test_lesson_can_set_language_en():
    t = Topic.objects.create(
        name_fr="Voyage", name_en="Travel", order=2, difficulty_level=1, language="en"
    )
    lesson = Lesson.objects.create(
        topic=t, title="L1", order=1, type="vocab", difficulty=1, language="en"
    )
    assert lesson.language == "en"


@pytest.mark.django_db
def test_grammar_rule_reading_text_question_video_lesson_default_fr():
    """All seven content models inherit the language=fr default."""
    t = Topic.objects.create(name_fr="x2", name_en="x2", order=3, difficulty_level=1)
    lesson = Lesson.objects.create(topic=t, title="L1", order=1, type="grammar", difficulty=1)
    rule = GrammarRule.objects.create(lesson=lesson, title="r", explanation="e")
    text = ReadingText.objects.create(lesson=lesson, title="t", content_fr="b", content_en="b")
    q = Question.objects.create(
        lesson=lesson, prompt="q", correct_answer="a", type="mcq", difficulty=1
    )
    video = VideoLesson.objects.create(lesson=lesson, youtube_url="https://x")
    assert rule.language == "fr"
    assert text.language == "fr"
    assert q.language == "fr"
    assert video.language == "fr"
