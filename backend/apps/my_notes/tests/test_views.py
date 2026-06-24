from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.my_notes.models import MyNote
from apps.my_notes.views import _extract_suggested_tags
from services.llm.base import LLMResponse

User = get_user_model()


def _llm(text):
    return LLMResponse(content=text, provider="gemini", tokens_used=5)


@pytest.fixture
def make_user(db):
    def _make(target_language="fr", username=None):
        username = username or f"u_{User.objects.count()}"
        return User.objects.create_user(
            username=username,
            email=f"{username}@x.com",
            password="x",
            target_language=target_language,
        )

    return _make


@pytest.fixture
def authed_client(make_user):
    def _make(target_language="fr", username=None):
        user = make_user(target_language=target_language, username=username)
        c = APIClient()
        c.force_authenticate(user)
        return c, user

    return _make


@pytest.mark.django_db
def test_anonymous_blocked_on_list():
    client = APIClient()
    assert client.get("/api/my-notes/").status_code in (401, 403)


@pytest.mark.django_db
def test_anonymous_blocked_on_detail(make_user):
    user = make_user()
    note = MyNote.objects.create(user=user, title="A")
    client = APIClient()
    assert client.get(f"/api/my-notes/{note.id}/").status_code in (401, 403)


@pytest.mark.django_db
def test_anonymous_blocked_on_public(make_user):
    user = make_user()
    note = MyNote.objects.create(user=user, title="A", is_public=True)
    client = APIClient()
    assert client.get(f"/api/my-notes/public/{note.id}/").status_code in (401, 403)


@pytest.mark.django_db
def test_list_returns_only_own_notes(authed_client, make_user):
    client, user_a = authed_client(username="alice")
    user_b = make_user(username="bob")
    MyNote.objects.create(user=user_a, title="alice's note")
    MyNote.objects.create(user=user_b, title="bob's note")

    response = client.get("/api/my-notes/")
    assert response.status_code == 200
    titles = [n["title"] for n in response.json()]
    assert titles == ["alice's note"]


@pytest.mark.django_db
def test_retrieve_other_users_note_returns_404(authed_client, make_user):
    client, _ = authed_client(username="alice")
    user_b = make_user(username="bob")
    note = MyNote.objects.create(user=user_b, title="bob's note")

    assert client.get(f"/api/my-notes/{note.id}/").status_code == 404


@pytest.mark.django_db
def test_update_other_users_note_returns_404(authed_client, make_user):
    client, _ = authed_client(username="alice")
    user_b = make_user(username="bob")
    note = MyNote.objects.create(user=user_b, title="bob's note")

    response = client.patch(
        f"/api/my-notes/{note.id}/",
        {"title": "hijacked"},
        format="json",
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_delete_other_users_note_returns_404(authed_client, make_user):
    client, _ = authed_client(username="alice")
    user_b = make_user(username="bob")
    note = MyNote.objects.create(user=user_b, title="bob's note")

    assert client.delete(f"/api/my-notes/{note.id}/").status_code == 404


@pytest.mark.django_db
def test_create_assigns_user_from_request(authed_client, make_user):
    client, user_a = authed_client(target_language="fr", username="alice")
    user_b = make_user(username="bob")

    response = client.post(
        "/api/my-notes/",
        {"title": "My grammar log", "user": user_b.id},
        format="json",
    )
    assert response.status_code == 201
    note = MyNote.objects.get(pk=response.json()["id"])
    assert note.user_id == user_a.id


@pytest.mark.django_db
def test_create_defaults_language_to_user_target_language(authed_client):
    client, _ = authed_client(target_language="en")
    response = client.post(
        "/api/my-notes/",
        {"title": "English study"},
        format="json",
    )
    assert response.status_code == 201
    assert response.json()["language"] == "en"


@pytest.mark.django_db
def test_create_respects_explicit_language(authed_client):
    client, _ = authed_client(target_language="en")
    response = client.post(
        "/api/my-notes/",
        {"title": "French study", "language": "fr"},
        format="json",
    )
    assert response.status_code == 201
    assert response.json()["language"] == "fr"


@pytest.mark.django_db
def test_filter_q_searches_title_body_and_tags(authed_client):
    client, user = authed_client()
    MyNote.objects.create(user=user, title="Subjunctive", body_markdown="practice")
    MyNote.objects.create(user=user, title="Vocab", body_markdown="useful subjunctive sentences")
    MyNote.objects.create(user=user, title="Random", tags=["subjunctive"])
    MyNote.objects.create(user=user, title="Other", body_markdown="unrelated")

    response = client.get("/api/my-notes/?q=subjunctive")
    assert response.status_code == 200
    titles = sorted(n["title"] for n in response.json())
    assert titles == ["Random", "Subjunctive", "Vocab"]


@pytest.mark.django_db
def test_filter_kind(authed_client):
    client, user = authed_client()
    MyNote.objects.create(user=user, title="A", kind="grammar")
    MyNote.objects.create(user=user, title="B", kind="dialog")

    response = client.get("/api/my-notes/?kind=grammar")
    assert response.status_code == 200
    titles = [n["title"] for n in response.json()]
    assert titles == ["A"]


@pytest.mark.django_db
def test_filter_tag(authed_client):
    client, user = authed_client()
    MyNote.objects.create(user=user, title="A", tags=["b1", "subjunctive"])
    MyNote.objects.create(user=user, title="B", tags=["a2"])

    response = client.get("/api/my-notes/?tag=subjunctive")
    assert response.status_code == 200
    titles = [n["title"] for n in response.json()]
    assert titles == ["A"]


@pytest.mark.django_db
def test_filter_favorite(authed_client):
    client, user = authed_client()
    MyNote.objects.create(user=user, title="fav", is_favorite=True)
    MyNote.objects.create(user=user, title="not fav", is_favorite=False)

    response = client.get("/api/my-notes/?favorite=1")
    assert response.status_code == 200
    titles = [n["title"] for n in response.json()]
    assert titles == ["fav"]


@pytest.mark.django_db
def test_filter_language(authed_client):
    client, user = authed_client()
    MyNote.objects.create(user=user, title="fr-note", language="fr")
    MyNote.objects.create(user=user, title="en-note", language="en")

    response = client.get("/api/my-notes/?language=fr")
    assert response.status_code == 200
    titles = [n["title"] for n in response.json()]
    assert titles == ["fr-note"]

    response = client.get("/api/my-notes/?language=all")
    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.django_db
def test_filters_compose(authed_client):
    client, user = authed_client()
    MyNote.objects.create(user=user, title="g-fav", kind="grammar", is_favorite=True)
    MyNote.objects.create(user=user, title="g-not", kind="grammar", is_favorite=False)
    MyNote.objects.create(user=user, title="d-fav", kind="dialog", is_favorite=True)

    response = client.get("/api/my-notes/?kind=grammar&favorite=1")
    assert response.status_code == 200
    titles = [n["title"] for n in response.json()]
    assert titles == ["g-fav"]


@pytest.mark.django_db
def test_tag_normalization(authed_client):
    client, _ = authed_client()
    response = client.post(
        "/api/my-notes/",
        {"title": "t", "tags": ["  Subjunctive ", "subjunctive", "B1", ""]},
        format="json",
    )
    assert response.status_code == 201
    assert response.json()["tags"] == ["subjunctive", "b1"]


@pytest.mark.django_db
def test_tag_validation_max_count(authed_client):
    client, _ = authed_client()
    tags = [f"tag{i}" for i in range(21)]
    response = client.post(
        "/api/my-notes/",
        {"title": "t", "tags": tags},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_tag_validation_max_length(authed_client):
    client, _ = authed_client()
    response = client.post(
        "/api/my-notes/",
        {"title": "t", "tags": ["x" * 41]},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_tag_validation_must_be_list(authed_client):
    client, _ = authed_client()
    response = client.post(
        "/api/my-notes/",
        {"title": "t", "tags": "not-a-list"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_public_retrieve_succeeds_when_public(authed_client, make_user):
    user_a = make_user(username="alice")
    note = MyNote.objects.create(user=user_a, title="shared", is_public=True)
    client_b, _ = authed_client(username="bob")

    response = client_b.get(f"/api/my-notes/public/{note.id}/")
    assert response.status_code == 200
    assert response.json()["title"] == "shared"


@pytest.mark.django_db
def test_public_retrieve_404_when_not_public(authed_client, make_user):
    user_a = make_user(username="alice")
    note = MyNote.objects.create(user=user_a, title="private", is_public=False)
    client_b, _ = authed_client(username="bob")

    response = client_b.get(f"/api/my-notes/public/{note.id}/")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# AI action endpoint
# ---------------------------------------------------------------------------


@pytest.fixture
def note_with_body(make_user):
    user = make_user(username="alice")
    note = MyNote.objects.create(
        user=user,
        title="Subjunctive review",
        kind="grammar",
        body_markdown="Use the subjunctive after que. Il faut que je parte.",
        tags=["subjunctive"],
        language="fr",
    )
    return note, user


@pytest.mark.django_db
def test_ai_action_requires_authentication(note_with_body):
    note, _ = note_with_body
    client = APIClient()
    response = client.post(
        f"/api/my-notes/{note.id}/ai-action/",
        {"action": "summarize"},
        format="json",
    )
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_ai_action_returns_404_for_other_users_note(authed_client, note_with_body):
    note, _ = note_with_body
    client, _ = authed_client(username="bob")
    response = client.post(
        f"/api/my-notes/{note.id}/ai-action/",
        {"action": "summarize"},
        format="json",
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_ai_action_rejects_unknown_action(authed_client, make_user):
    user = make_user(username="alice")
    note = MyNote.objects.create(user=user, title="t", body_markdown="hello")
    client = APIClient()
    client.force_authenticate(user)
    response = client.post(
        f"/api/my-notes/{note.id}/ai-action/",
        {"action": "explode"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_ai_action_rejects_empty_body_for_text_actions(authed_client, make_user):
    user = make_user(username="alice")
    note = MyNote.objects.create(user=user, title="empty", body_markdown="   ")
    client = APIClient()
    client.force_authenticate(user)
    response = client.post(
        f"/api/my-notes/{note.id}/ai-action/",
        {"action": "summarize"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_ai_action_allows_empty_body_for_suggest_tags(authed_client, make_user):
    user = make_user(username="alice")
    note = MyNote.objects.create(user=user, title="empty", body_markdown="")
    client = APIClient()
    client.force_authenticate(user)
    fake = mock.Mock()
    fake.generate.return_value = _llm("grammar, subjunctive, b1")
    with mock.patch("apps.my_notes.views.create_llm_router", return_value=fake):
        response = client.post(
            f"/api/my-notes/{note.id}/ai-action/",
            {"action": "suggest_tags"},
            format="json",
        )
    assert response.status_code == 200
    assert response.json() == {"tags": ["grammar", "subjunctive", "b1"]}


@pytest.mark.parametrize(
    "action",
    [
        "summarize",
        "enhance_format",
        "fix_grammar",
        "more_examples",
        "ice_breakers",
        "practice_questions",
    ],
)
@pytest.mark.django_db
def test_ai_action_text_actions_return_result(authed_client, note_with_body, action):
    note, user = note_with_body
    client = APIClient()
    client.force_authenticate(user)
    fake = mock.Mock()
    fake.generate.return_value = _llm("  AI result content  ")
    with mock.patch("apps.my_notes.views.create_llm_router", return_value=fake):
        response = client.post(
            f"/api/my-notes/{note.id}/ai-action/",
            {"action": action},
            format="json",
        )
    assert response.status_code == 200
    assert response.json() == {"result": "AI result content"}
    sys_prompt = fake.generate.call_args.kwargs["system_prompt"]
    assert "French" in sys_prompt


@pytest.mark.django_db
def test_ai_action_suggest_tags_parses_response(authed_client, note_with_body):
    note, user = note_with_body
    client = APIClient()
    client.force_authenticate(user)
    fake = mock.Mock()
    fake.generate.return_value = _llm("Subjunctive, Grammar, B1, subjunctive")
    with mock.patch("apps.my_notes.views.create_llm_router", return_value=fake):
        response = client.post(
            f"/api/my-notes/{note.id}/ai-action/",
            {"action": "suggest_tags"},
            format="json",
        )
    assert response.status_code == 200
    assert response.json() == {"tags": ["subjunctive", "grammar", "b1"]}


@pytest.mark.django_db
def test_ai_action_returns_503_when_llm_fails(authed_client, note_with_body):
    note, user = note_with_body
    client = APIClient()
    client.force_authenticate(user)
    fake = mock.Mock()
    fake.generate.side_effect = RuntimeError("llm down")
    with mock.patch("apps.my_notes.views.create_llm_router", return_value=fake):
        response = client.post(
            f"/api/my-notes/{note.id}/ai-action/",
            {"action": "summarize"},
            format="json",
        )
    assert response.status_code == 503


@pytest.mark.django_db
def test_ai_action_english_note_prompts_in_english(authed_client, make_user):
    user = make_user(username="alice", target_language="en")
    note = MyNote.objects.create(
        user=user,
        title="Phrasal verbs",
        body_markdown="call off = cancel",
        language="en",
    )
    client = APIClient()
    client.force_authenticate(user)
    fake = mock.Mock()
    fake.generate.return_value = _llm("- ok")
    with mock.patch("apps.my_notes.views.create_llm_router", return_value=fake):
        response = client.post(
            f"/api/my-notes/{note.id}/ai-action/",
            {"action": "summarize"},
            format="json",
        )
    assert response.status_code == 200
    sys_prompt = fake.generate.call_args.kwargs["system_prompt"]
    assert "English" in sys_prompt
    assert "French" not in sys_prompt


def test_extract_suggested_tags_handles_commas_newlines_hashes_dupes():
    raw = "  Grammar, #subjunctive\n\nB1 ,grammar , , #B1, vocab\n"
    tags = _extract_suggested_tags(raw)
    assert tags == ["grammar", "subjunctive", "b1", "vocab"]


def test_extract_suggested_tags_caps_at_five_and_drops_overlong():
    raw = "a, b, c, d, e, f, " + ("x" * 41)
    tags = _extract_suggested_tags(raw)
    assert tags == ["a", "b", "c", "d", "e"]


def test_extract_suggested_tags_empty_input():
    assert _extract_suggested_tags("") == []
    assert _extract_suggested_tags("   ,  ,\n\n") == []
