import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.content.models import Lesson, Question, Topic
from apps.practice.models import QuizAnswer, QuizSession

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="quizuser",
        email="quiz@example.com",
        password="testpass123!",
    )


@pytest.fixture
def sample_lesson(db):
    topic = Topic.objects.create(
        name_fr="Les salutations",
        name_en="Greetings",
        description="Basic greetings",
        icon="wave",
        order=1,
        difficulty_level=1,
    )
    return Lesson.objects.create(
        topic=topic,
        type="vocab",
        title="Hello & Goodbye",
        content={"intro": "Greetings"},
        order=1,
        difficulty=1,
    )


@pytest.fixture
def sample_questions(sample_lesson):
    q1 = Question.objects.create(
        lesson=sample_lesson,
        type="mcq",
        prompt="What does bonjour mean?",
        correct_answer="hello",
        wrong_answers=["goodbye", "thanks", "please"],
        explanation="Bonjour means hello.",
        difficulty=1,
    )
    q2 = Question.objects.create(
        lesson=sample_lesson,
        type="fill_blank",
        prompt="___jour!",
        correct_answer="Bon",
        wrong_answers=[],
        explanation="Bonjour = good day.",
        difficulty=1,
    )
    q3 = Question.objects.create(
        lesson=sample_lesson,
        type="translate",
        prompt="Translate: goodbye",
        correct_answer="au revoir",
        wrong_answers=[],
        explanation="Au revoir means goodbye.",
        difficulty=1,
    )
    return [q1, q2, q3]


@pytest.mark.django_db
class TestQuizSessionModel:
    def test_create_session(self, user, sample_lesson):
        session = QuizSession.objects.create(
            user=user,
            lesson=sample_lesson,
            total_questions=5,
        )
        assert session.user == user
        assert session.lesson == sample_lesson
        assert session.total_questions == 5
        assert session.score is None
        assert session.completed_at is None
        assert session.started_at is not None

    def test_session_str(self, user, sample_lesson):
        session = QuizSession.objects.create(
            user=user,
            lesson=sample_lesson,
            total_questions=3,
        )
        assert str(session) == f"{user.username} — {sample_lesson.title}"

    def test_complete_session(self, user, sample_lesson):
        session = QuizSession.objects.create(
            user=user,
            lesson=sample_lesson,
            total_questions=5,
        )
        now = timezone.now()
        session.score = 4
        session.completed_at = now
        session.save()
        session.refresh_from_db()
        assert session.score == 4
        assert session.completed_at is not None

    def test_session_ordering(self, user, sample_lesson):
        s1 = QuizSession.objects.create(
            user=user,
            lesson=sample_lesson,
            total_questions=3,
        )
        s2 = QuizSession.objects.create(
            user=user,
            lesson=sample_lesson,
            total_questions=3,
        )
        sessions = list(QuizSession.objects.all())
        # Most recent first
        assert sessions[0].id == s2.id
        assert sessions[1].id == s1.id

    def test_session_cascade_delete_user(self, user, sample_lesson):
        QuizSession.objects.create(
            user=user,
            lesson=sample_lesson,
            total_questions=3,
        )
        user.delete()
        assert QuizSession.objects.count() == 0

    def test_session_cascade_delete_lesson(self, user, sample_lesson):
        QuizSession.objects.create(
            user=user,
            lesson=sample_lesson,
            total_questions=3,
        )
        sample_lesson.delete()
        assert QuizSession.objects.count() == 0


@pytest.mark.django_db
class TestQuizAnswerModel:
    def test_create_answer(self, user, sample_lesson, sample_questions):
        session = QuizSession.objects.create(
            user=user,
            lesson=sample_lesson,
            total_questions=3,
        )
        answer = QuizAnswer.objects.create(
            session=session,
            question=sample_questions[0],
            user_answer="hello",
            is_correct=True,
        )
        assert answer.session == session
        assert answer.question == sample_questions[0]
        assert answer.user_answer == "hello"
        assert answer.is_correct is True
        assert answer.answered_at is not None

    def test_answer_str(self, user, sample_lesson, sample_questions):
        session = QuizSession.objects.create(
            user=user,
            lesson=sample_lesson,
            total_questions=3,
        )
        answer = QuizAnswer.objects.create(
            session=session,
            question=sample_questions[0],
            user_answer="hello",
            is_correct=True,
        )
        expected = f"Q{sample_questions[0].id} — hello (correct)"
        assert str(answer) == expected

    def test_incorrect_answer_str(self, user, sample_lesson, sample_questions):
        session = QuizSession.objects.create(
            user=user,
            lesson=sample_lesson,
            total_questions=3,
        )
        answer = QuizAnswer.objects.create(
            session=session,
            question=sample_questions[0],
            user_answer="goodbye",
            is_correct=False,
        )
        expected = f"Q{sample_questions[0].id} — goodbye (wrong)"
        assert str(answer) == expected

    def test_answer_cascade_delete_session(self, user, sample_lesson, sample_questions):
        session = QuizSession.objects.create(
            user=user,
            lesson=sample_lesson,
            total_questions=3,
        )
        QuizAnswer.objects.create(
            session=session,
            question=sample_questions[0],
            user_answer="hello",
            is_correct=True,
        )
        session.delete()
        assert QuizAnswer.objects.count() == 0

    def test_unique_together_session_question(self, user, sample_lesson, sample_questions):
        session = QuizSession.objects.create(
            user=user,
            lesson=sample_lesson,
            total_questions=3,
        )
        QuizAnswer.objects.create(
            session=session,
            question=sample_questions[0],
            user_answer="hello",
            is_correct=True,
        )
        from django.db import IntegrityError

        with pytest.raises(IntegrityError):
            QuizAnswer.objects.create(
                session=session,
                question=sample_questions[0],
                user_answer="goodbye",
                is_correct=False,
            )
