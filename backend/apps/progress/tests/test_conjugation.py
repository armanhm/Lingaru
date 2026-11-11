import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.content.models import Lesson, Question, Topic
from apps.progress.models import MistakeEntry

User = get_user_model()


@pytest.fixture(autouse=True)
def _clear_cache():
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="conjuser",
        email="conj@example.com",
        password="testpass123!",
    )


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def conjugation_questions(db):
    topic = Topic.objects.create(
        name_fr="Conjugaison",
        name_en="Conjugation",
        description="",
        icon="pen",
        order=1,
        difficulty_level=2,
    )
    lesson = Lesson.objects.create(
        topic=topic,
        type="grammar",
        title="Verb Drills",
        content={},
        order=1,
        difficulty=2,
    )
    q1 = Question.objects.create(
        lesson=lesson,
        type="conjugation",
        prompt="Conjugate manger (present, je)",
        correct_answer="mange",
        wrong_answers=[],
        explanation="je mange (manger, present)",
        difficulty=2,
    )
    q2 = Question.objects.create(
        lesson=lesson,
        type="conjugation",
        prompt="Conjugate avoir (present, nous)",
        correct_answer="avons",
        wrong_answers=[],
        explanation="nous avons (avoir, present)",
        difficulty=2,
    )
    return [q1, q2]


@pytest.mark.django_db
class TestConjugationCheck:
    def test_correct_answer(self, authenticated_client, conjugation_questions):
        response = authenticated_client.post(
            "/api/progress/conjugation/check/",
            {"verb": "manger", "tense": "present", "subject": "je", "answer": "mange"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["is_correct"] is True

    def test_wrong_answer(self, authenticated_client, conjugation_questions, user):
        response = authenticated_client.post(
            "/api/progress/conjugation/check/",
            {"verb": "manger", "tense": "present", "subject": "je", "answer": "mangez"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["is_correct"] is False
        assert response.data["correct_answer"] == "mange"
        # Should auto-record mistake
        assert MistakeEntry.objects.filter(user=user, mistake_type="conjugation").count() == 1

    def test_missing_fields(self, authenticated_client, conjugation_questions):
        response = authenticated_client.post(
            "/api/progress/conjugation/check/",
            {"verb": "manger"},
            format="json",
        )
        assert response.status_code == 400

    def test_unknown_verb(self, authenticated_client, conjugation_questions):
        response = authenticated_client.post(
            "/api/progress/conjugation/check/",
            {"verb": "dormir", "tense": "present", "subject": "je", "answer": "dors"},
            format="json",
        )
        assert response.status_code == 404


@pytest.mark.django_db
class TestConjugationList:
    def test_returns_verbs_and_tenses(self, authenticated_client, conjugation_questions):
        response = authenticated_client.get("/api/progress/conjugation/verbs/")
        assert response.status_code == 200
        assert "manger" in response.data["verbs"]
        assert "avoir" in response.data["verbs"]
        assert "present" in response.data["tenses"]


@pytest.fixture
def colliding_questions(conjugation_questions):
    lesson = conjugation_questions[0].lesson
    rows = [
        ("Conjugate avoir (present, tu)", "as", "fr"),
        ("Conjugate voir (present, tu)", "vois", "fr"),
        ("Conjugate prendre (present, je)", "prends", "fr"),
        ("Conjugate comprendre (present, je)", "comprends", "fr"),
        ("Conjugate manger (futur_simple, tu)", "mangeras", "fr"),
        ("Conjugate manger (present, tu)", "manges", "fr"),
        ("Conjugate voir (present, tu)", "EN-voir", "en"),
    ]
    for prompt, answer, lang in rows:
        Question.objects.create(
            lesson=lesson,
            type="conjugation",
            prompt=prompt,
            correct_answer=answer,
            wrong_answers=[],
            explanation="",
            difficulty=2,
            language=lang,
        )


@pytest.mark.django_db
class TestConjugationExactMatch:
    def _check(self, client, verb, tense, subject, answer):
        return client.post(
            "/api/progress/conjugation/check/",
            {"verb": verb, "tense": tense, "subject": subject, "answer": answer},
            format="json",
        )

    def test_voir_does_not_resolve_avoir(self, authenticated_client, colliding_questions, user):
        response = self._check(authenticated_client, "voir", "present", "tu", "vois")
        assert response.status_code == 200
        assert response.data["is_correct"] is True
        assert MistakeEntry.objects.filter(user=user).count() == 0

    def test_prendre_does_not_resolve_comprendre(self, authenticated_client, colliding_questions):
        response = self._check(authenticated_client, "prendre", "present", "je", "prends")
        assert response.data["is_correct"] is True
        assert response.data["correct_answer"] == "prends"

    def test_tu_futur_simple_does_not_match_other_tense(
        self, authenticated_client, colliding_questions
    ):
        response = self._check(authenticated_client, "manger", "present", "tu", "manges")
        assert response.data["is_correct"] is True

    def test_partial_verb_is_404(self, authenticated_client, colliding_questions):
        response = self._check(authenticated_client, "oir", "present", "tu", "x")
        assert response.status_code == 404

    def test_lookup_filters_by_user_language(self, authenticated_client, colliding_questions, user):
        user.target_language = "en"
        user.save()
        response = self._check(authenticated_client, "voir", "present", "tu", "EN-voir")
        assert response.status_code == 200
        assert response.data["is_correct"] is True


@pytest.mark.django_db
class TestConjugationListCached:
    def test_second_call_hits_cache(
        self, authenticated_client, conjugation_questions, django_assert_num_queries
    ):
        authenticated_client.get("/api/progress/conjugation/verbs/")
        with django_assert_num_queries(0):
            response = authenticated_client.get("/api/progress/conjugation/verbs/")
        assert "manger" in response.data["verbs"]

    def test_list_is_per_language(self, authenticated_client, conjugation_questions, user):
        authenticated_client.get("/api/progress/conjugation/verbs/")
        user.target_language = "en"
        user.save()
        response = authenticated_client.get("/api/progress/conjugation/verbs/")
        assert response.data["verbs"] == []
