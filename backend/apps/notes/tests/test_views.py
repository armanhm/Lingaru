from datetime import date
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.content.models import Lesson, Question
from apps.notes.models import Note, NoteWord
from apps.progress.models import SRSCard
from services.llm.base import LLMResponse

User = get_user_model()


@pytest.fixture
def make_user(db):
    def _make(target_language="en", username=None):
        username = username or f"u_{target_language}_{User.objects.count()}"
        return User.objects.create_user(
            username=username,
            email=f"{username}@x.com",
            password="x",
            target_language=target_language,
        )

    return _make


@pytest.fixture
def authed_client(make_user):
    def _make(target_language="en", username=None):
        user = make_user(target_language=target_language, username=username)
        c = APIClient()
        c.force_authenticate(user)
        return c, user

    return _make


@pytest.fixture
def en_note(db):
    note = Note.objects.create(note_number=1, date=date(2022, 8, 5), language="en")
    NoteWord.objects.create(note=note, word="call off", definition="cancel", order=0)
    NoteWord.objects.create(note=note, word="speak up", definition="be louder", order=1)
    return note


@pytest.fixture
def fr_note(db):
    return Note.objects.create(note_number=99, date=date(2022, 8, 5), language="fr")


def _llm(text):
    return LLMResponse(content=text, provider="gemini", tokens_used=5)


@pytest.mark.django_db
def test_list_returns_only_user_target_language(authed_client, en_note, fr_note):
    client, _ = authed_client("en")
    response = client.get("/api/notes/")
    assert response.status_code == 200
    ids = [item["id"] for item in response.json()["results"]]
    assert en_note.id in ids
    assert fr_note.id not in ids


@pytest.mark.django_db
def test_list_requires_authentication(en_note):
    client = APIClient()
    response = client.get("/api/notes/")
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_detail_returns_words(authed_client, en_note):
    client, _ = authed_client("en")
    response = client.get(f"/api/notes/{en_note.id}/")
    assert response.status_code == 200
    body = response.json()
    assert body["note_number"] == 1
    assert len(body["words"]) == 2
    assert body["words"][0]["word"] == "call off"


@pytest.mark.django_db
def test_detail_404s_for_wrong_language(authed_client, fr_note):
    client, _ = authed_client("en")
    response = client.get(f"/api/notes/{fr_note.id}/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_ask_returns_401_for_anonymous(en_note):
    client = APIClient()
    response = client.post(
        f"/api/notes/{en_note.id}/ask/",
        {"question": "what does call off mean?"},
        format="json",
    )
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_ask_returns_answer_and_includes_words_in_prompt(authed_client, en_note):
    client, _ = authed_client("en")
    fake = mock.Mock()
    fake.generate.return_value = _llm("'call off' means to cancel.")
    with mock.patch("apps.notes.views.create_llm_router", return_value=fake):
        response = client.post(
            f"/api/notes/{en_note.id}/ask/",
            {"question": "what does call off mean?"},
            format="json",
        )
    assert response.status_code == 200
    assert response.json()["answer"] == "'call off' means to cancel."
    sys_prompt = fake.generate.call_args.kwargs["system_prompt"]
    assert "call off" in sys_prompt
    assert "speak up" in sys_prompt


@pytest.mark.django_db
def test_ask_requires_question(authed_client, en_note):
    client, _ = authed_client("en")
    response = client.post(f"/api/notes/{en_note.id}/ask/", {}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_add_to_srs_creates_cards(authed_client, en_note):
    client, user = authed_client("en")
    response = client.post(f"/api/notes/{en_note.id}/add-to-srs/")
    assert response.status_code == 200
    body = response.json()
    assert body["created"] == 2
    assert body["existing"] == 0
    assert SRSCard.objects.filter(user=user).count() == 2


@pytest.mark.django_db
def test_add_to_srs_is_idempotent(authed_client, en_note):
    client, user = authed_client("en")
    client.post(f"/api/notes/{en_note.id}/add-to-srs/")
    response = client.post(f"/api/notes/{en_note.id}/add-to-srs/")
    body = response.json()
    assert body["created"] == 0
    assert body["existing"] == 2
    assert SRSCard.objects.filter(user=user).count() == 2


@pytest.mark.django_db
def test_generate_quiz_creates_lesson_and_questions(authed_client, en_note):
    client, _ = authed_client("en")
    quiz_json = (
        '[{"prompt": "What does \'call off\' mean?", '
        '"correct_answer": "cancel", '
        '"wrong_answers": ["speak", "leave", "hide"], '
        '"explanation": "to call off = to cancel"}, '
        '{"prompt": "What does \'speak up\' mean?", '
        '"correct_answer": "be louder", '
        '"wrong_answers": ["whisper", "sit", "leave"], '
        '"explanation": "to speak more loudly"}]'
    )
    fake = mock.Mock()
    fake.generate.return_value = _llm(quiz_json)
    with mock.patch("apps.notes.views.create_llm_router", return_value=fake):
        response = client.post(f"/api/notes/{en_note.id}/generate-quiz/")
    assert response.status_code == 201
    body = response.json()
    assert "lesson_id" in body
    assert body["question_count"] == 2

    lesson = Lesson.objects.get(pk=body["lesson_id"])
    assert lesson.language == "en"
    assert lesson.type == "vocab"
    assert Question.objects.filter(lesson=lesson).count() == 2


@pytest.mark.django_db
def test_generate_quiz_handles_fenced_json(authed_client, en_note):
    client, _ = authed_client("en")
    fenced = (
        "```json\n"
        '[{"prompt": "p", "correct_answer": "c", '
        '"wrong_answers": ["a", "b", "d"], "explanation": ""}]\n'
        "```"
    )
    fake = mock.Mock()
    fake.generate.return_value = _llm(fenced)
    with mock.patch("apps.notes.views.create_llm_router", return_value=fake):
        response = client.post(f"/api/notes/{en_note.id}/generate-quiz/")
    assert response.status_code == 201
    assert response.json()["question_count"] == 1


@pytest.mark.django_db
def test_generate_quiz_returns_500_when_llm_output_is_invalid(authed_client, en_note):
    client, _ = authed_client("en")
    fake = mock.Mock()
    fake.generate.return_value = _llm("not json at all")
    with mock.patch("apps.notes.views.create_llm_router", return_value=fake):
        response = client.post(f"/api/notes/{en_note.id}/generate-quiz/")
    assert response.status_code == 500


@pytest.mark.django_db
def test_generate_quiz_returns_503_when_llm_fails(authed_client, en_note):
    client, _ = authed_client("en")
    fake = mock.Mock()
    fake.generate.side_effect = RuntimeError("LLM down")
    with mock.patch("apps.notes.views.create_llm_router", return_value=fake):
        response = client.post(f"/api/notes/{en_note.id}/generate-quiz/")
    assert response.status_code == 503
