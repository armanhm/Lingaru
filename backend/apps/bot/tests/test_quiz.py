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
