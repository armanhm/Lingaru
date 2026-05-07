import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.content.models import Topic, Lesson, Question
from apps.practice.models import QuizSession, QuizAnswer

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="quizuser", email="quiz@example.com", password="testpass123!",
    )


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


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
    q3 = Question.objects.create(
        lesson=sample_lesson, type="translate", prompt="Translate: goodbye",
        correct_answer="au revoir", wrong_answers=[],
        explanation="Au revoir means goodbye.", difficulty=2,
    )
    return [q1, q2, q3]


@pytest.mark.django_db
class TestQuizStartView:
    def test_start_quiz_success(self, authenticated_client, sample_lesson, sample_questions):
        response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        assert response.status_code == 201
        assert "session_id" in response.data
        assert "questions" in response.data
        assert len(response.data["questions"]) == 3
        # correct_answer is exposed (frontend enhancer relies on it).
        for q in response.data["questions"]:
            assert "id" in q
            assert "type" in q
            assert "prompt" in q
            assert "correct_answer" in q
        assert QuizSession.objects.count() == 1

    def test_start_quiz_no_questions(self, authenticated_client, sample_lesson):
        response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        assert response.status_code == 400
        assert "no questions" in response.data["detail"].lower()

    def test_start_quiz_invalid_lesson(self, authenticated_client):
        response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": 99999},
            format="json",
        )
        assert response.status_code == 400

    def test_start_quiz_unauthenticated(self, api_client, sample_lesson, sample_questions):
        response = api_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        assert response.status_code == 401


@pytest.mark.django_db
class TestQuizAnswerView:
    def test_submit_correct_answer(self, authenticated_client, sample_lesson, sample_questions):
        # Start quiz first
        start_response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]

        response = authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "hello"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["is_correct"] is True
        assert response.data["correct_answer"] == "hello"
        assert response.data["explanation"] == "Bonjour means hello."
        assert QuizAnswer.objects.count() == 1

    def test_submit_incorrect_answer(self, authenticated_client, sample_lesson, sample_questions):
        start_response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]

        response = authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "goodbye"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["is_correct"] is False
        assert response.data["correct_answer"] == "hello"

    def test_submit_case_insensitive_answer(self, authenticated_client, sample_lesson, sample_questions):
        start_response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]

        response = authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "Hello"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["is_correct"] is True

    def test_submit_duplicate_answer(self, authenticated_client, sample_lesson, sample_questions):
        start_response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]

        authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "hello"},
            format="json",
        )
        response = authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "goodbye"},
            format="json",
        )
        assert response.status_code == 400
        assert "already answered" in response.data["detail"].lower()

    def test_submit_answer_wrong_session(self, authenticated_client, sample_lesson, sample_questions):
        response = authenticated_client.post(
            "/api/practice/quiz/99999/answer/",
            {"question_id": sample_questions[0].id, "answer": "hello"},
            format="json",
        )
        assert response.status_code == 404

    def test_submit_answer_completed_session(self, authenticated_client, user, sample_lesson, sample_questions):
        start_response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]
        # Complete the session
        authenticated_client.post(
            f"/api/practice/quiz/{session_id}/complete/",
            format="json",
        )
        response = authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "hello"},
            format="json",
        )
        assert response.status_code == 400
        assert "already completed" in response.data["detail"].lower()

    def test_submit_answer_other_users_session(self, api_client, user, sample_lesson, sample_questions):
        # Start quiz as user
        api_client.force_authenticate(user=user)
        start_response = api_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]

        # Try to answer as different user
        other_user = User.objects.create_user(
            username="otheruser", email="other@example.com", password="testpass123!",
        )
        api_client.force_authenticate(user=other_user)
        response = api_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "hello"},
            format="json",
        )
        assert response.status_code == 404


@pytest.mark.django_db
class TestQuizCompleteView:
    def test_complete_quiz(self, authenticated_client, sample_lesson, sample_questions):
        start_response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]

        # Answer two questions correctly, one wrong
        authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[0].id, "answer": "hello"},
            format="json",
        )
        authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[1].id, "answer": "Bon"},
            format="json",
        )
        authenticated_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": sample_questions[2].id, "answer": "wrong"},
            format="json",
        )

        response = authenticated_client.post(
            f"/api/practice/quiz/{session_id}/complete/",
            format="json",
        )
        assert response.status_code == 200
        assert response.data["score"] == 2
        assert response.data["total_questions"] == 3
        assert response.data["completed_at"] is not None
        assert response.data["lesson_title"] == "Hello & Goodbye"

    def test_complete_already_completed(self, authenticated_client, sample_lesson, sample_questions):
        start_response = authenticated_client.post(
            "/api/practice/quiz/start/",
            {"lesson_id": sample_lesson.id},
            format="json",
        )
        session_id = start_response.data["session_id"]

        authenticated_client.post(
            f"/api/practice/quiz/{session_id}/complete/", format="json",
        )
        response = authenticated_client.post(
            f"/api/practice/quiz/{session_id}/complete/", format="json",
        )
        assert response.status_code == 400
        assert "already completed" in response.data["detail"].lower()


@pytest.mark.django_db
class TestQuizHistoryView:
    def test_list_history(self, authenticated_client, user, sample_lesson):
        QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=5, score=4,
        )
        QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=5, score=3,
        )
        response = authenticated_client.get("/api/practice/quiz/history/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 2

    def test_history_only_own_sessions(self, api_client, user, sample_lesson):
        QuizSession.objects.create(
            user=user, lesson=sample_lesson, total_questions=5, score=4,
        )
        other_user = User.objects.create_user(
            username="other", email="other@example.com", password="testpass123!",
        )
        QuizSession.objects.create(
            user=other_user, lesson=sample_lesson, total_questions=5, score=5,
        )
        api_client.force_authenticate(user=user)
        response = api_client.get("/api/practice/quiz/history/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 1

    def test_history_unauthenticated(self, api_client):
        response = api_client.get("/api/practice/quiz/history/")
        assert response.status_code == 401
