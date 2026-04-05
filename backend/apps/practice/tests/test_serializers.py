import pytest
from django.contrib.auth import get_user_model
from apps.content.models import Topic, Lesson, Question
from apps.practice.models import QuizSession, QuizAnswer
from apps.practice.serializers import (
    QuizStartSerializer,
    QuizQuestionSerializer,
    AnswerSubmitSerializer,
    AnswerResultSerializer,
    QuizCompleteSerializer,
    QuizHistorySerializer,
)

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="quizuser", email="quiz@example.com", password="testpass123!",
    )


@pytest.fixture
def sample_lesson(db):
    topic = Topic.objects.create(
        name_fr="Les salutations", name_en="Greetings",
        description="Basic greetings", icon="wave", order=1, difficulty_level=1,
    )
    return Lesson.objects.create(
        topic=topic, type="vocab", title="Hello & Goodbye",
        content={}, order=1, difficulty=1,
    )


@pytest.fixture
def sample_questions(sample_lesson):
    q1 = Question.objects.create(
        lesson=sample_lesson, type="mcq", prompt="What does bonjour mean?",
        correct_answer="hello", wrong_answers=["goodbye", "thanks", "please"],
        explanation="Bonjour means hello.", difficulty=1,
    )
    q2 = Question.objects.create(
        lesson=sample_lesson, type="fill_blank", prompt="___jour!",
        correct_answer="Bon", wrong_answers=[],
        explanation="Bonjour = good day.", difficulty=1,
    )
    return [q1, q2]


@pytest.mark.django_db
class TestQuizStartSerializer:
    def test_valid_lesson_id(self, sample_lesson):
        serializer = QuizStartSerializer(data={"lesson_id": sample_lesson.id})
        assert serializer.is_valid()

    def test_missing_lesson_id(self):
        serializer = QuizStartSerializer(data={})
        assert not serializer.is_valid()
        assert "lesson_id" in serializer.errors

    def test_invalid_lesson_id(self):
        serializer = QuizStartSerializer(data={"lesson_id": 99999})
        assert not serializer.is_valid()


@pytest.mark.django_db
class TestQuizQuestionSerializer:
    def test_mcq_question_has_options(self, sample_questions):
        q = sample_questions[0]  # MCQ
        serializer = QuizQuestionSerializer(q)
        data = serializer.data
        assert data["id"] == q.id
        assert data["type"] == "mcq"
        assert data["prompt"] == "What does bonjour mean?"
        assert "options" in data
        assert len(data["options"]) == 4  # correct + 3 wrong
        assert "hello" in data["options"]
        # Should NOT expose correct_answer or explanation
        assert "correct_answer" not in data
        assert "explanation" not in data

    def test_fill_blank_question_no_options(self, sample_questions):
        q = sample_questions[1]  # fill_blank
        serializer = QuizQuestionSerializer(q)
        data = serializer.data
        assert data["type"] == "fill_blank"
        assert data["options"] is None or data["options"] == []


@pytest.mark.django_db
class TestAnswerSubmitSerializer:
    def test_valid_answer(self, sample_questions):
        serializer = AnswerSubmitSerializer(data={
            "question_id": sample_questions[0].id,
            "answer": "hello",
        })
        assert serializer.is_valid()

    def test_missing_fields(self):
        serializer = AnswerSubmitSerializer(data={})
        assert not serializer.is_valid()
        assert "question_id" in serializer.errors
        assert "answer" in serializer.errors


@pytest.mark.django_db
class TestAnswerResultSerializer:
    def test_serializes_result(self, user, sample_lesson, sample_questions):
        session = QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=2,
        )
        answer = QuizAnswer.objects.create(
            session=session, question=sample_questions[0],
            user_answer="hello", is_correct=True,
        )
        serializer = AnswerResultSerializer(answer)
        data = serializer.data
        assert data["is_correct"] is True
        assert data["correct_answer"] == "hello"
        assert data["explanation"] == "Bonjour means hello."


@pytest.mark.django_db
class TestQuizCompleteSerializer:
    def test_serializes_completed_session(self, user, sample_lesson):
        session = QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=5, score=4,
        )
        serializer = QuizCompleteSerializer(session)
        data = serializer.data
        assert data["score"] == 4
        assert data["total_questions"] == 5
        assert "started_at" in data
        assert "lesson_title" in data


@pytest.mark.django_db
class TestQuizHistorySerializer:
    def test_serializes_history(self, user, sample_lesson):
        session = QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=5, score=3,
        )
        serializer = QuizHistorySerializer(session)
        data = serializer.data
        assert data["id"] == session.id
        assert data["lesson_title"] == "Hello & Goodbye"
        assert data["score"] == 3
        assert data["total_questions"] == 5
