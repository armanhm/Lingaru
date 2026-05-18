"""Integration tests for ChatView + memory layer.

Asserts the contract:
- When LINGARU_MEMORY_ENABLED is off, chat behaves exactly as before
  (no context injection, no extraction call).
- When on, context is prepended to system prompt AND extractor runs;
  if extractor returns a note, the chat response includes
  memory_saved={id, content, category}.
- An extractor failure does not break the chat turn.
"""

from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from apps.memory.models import MemoryNote
from services.llm.base import LLMResponse

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="alice", email="a@x.com", password="x", target_level="B2"
    )


@pytest.fixture
def authed_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _llm(text):
    return LLMResponse(content=text, provider="gemini", tokens_used=10)


@pytest.mark.django_db
@override_settings(LINGARU_MEMORY_ENABLED=False)
def test_flag_off_does_not_inject_or_extract(authed_client, user):
    """With the flag off, system_prompt is unchanged and extractor never runs."""
    fake_router = mock.Mock()
    fake_router.generate.return_value = _llm("Bonjour!")

    with (
        mock.patch("apps.assistant.views.create_llm_router", return_value=fake_router),
        mock.patch("services.memory.extractor._build_router") as fake_extractor_router,
    ):
        response = authed_client.post(
            "/api/assistant/chat/",
            {"message": "Salut", "mode": "conversation"},
            format="json",
        )

    assert response.status_code == 200
    body = response.json()
    assert "memory_saved" not in body
    # The extractor router should never have been built
    fake_extractor_router.assert_not_called()
    # The system prompt passed to the chat router does NOT contain LEARNER CONTEXT
    _, call_kwargs = fake_router.generate.call_args
    assert "LEARNER CONTEXT" not in call_kwargs["system_prompt"]


@pytest.mark.django_db
@override_settings(LINGARU_MEMORY_ENABLED=True)
def test_flag_on_injects_context_into_system_prompt(authed_client, user):
    """With the flag on and the user having a goal note, the assembled
    LEARNER CONTEXT block should appear in the system prompt sent to the
    chat LLM."""
    MemoryNote.objects.create(user=user, content="Prepping for TCF June 15", category="goal")

    fake_chat_router = mock.Mock()
    fake_chat_router.generate.return_value = _llm("Bonjour!")
    fake_extract_router = mock.Mock()
    fake_extract_router.generate.return_value = _llm('{"remember": false}')

    with (
        mock.patch("apps.assistant.views.create_llm_router", return_value=fake_chat_router),
        mock.patch("services.memory.extractor._build_router", return_value=fake_extract_router),
    ):
        response = authed_client.post(
            "/api/assistant/chat/",
            {"message": "Salut", "mode": "conversation"},
            format="json",
        )

    assert response.status_code == 200
    _, call_kwargs = fake_chat_router.generate.call_args
    assert "LEARNER CONTEXT" in call_kwargs["system_prompt"]
    assert "Prepping for TCF June 15" in call_kwargs["system_prompt"]


@pytest.mark.django_db
@override_settings(LINGARU_MEMORY_ENABLED=True)
def test_extractor_creates_note_returns_memory_saved(authed_client, user):
    """If the extractor's LLM returns remember=true, the chat response
    body must include memory_saved with the new note's id/content/category."""
    fake_chat_router = mock.Mock()
    fake_chat_router.generate.return_value = _llm("Got it.")
    fake_extract_router = mock.Mock()
    fake_extract_router.generate.return_value = _llm(
        '{"remember": true, "content": "User is preparing for the TCF on June 15", "category": "goal"}'
    )

    with (
        mock.patch("apps.assistant.views.create_llm_router", return_value=fake_chat_router),
        mock.patch("services.memory.extractor._build_router", return_value=fake_extract_router),
    ):
        response = authed_client.post(
            "/api/assistant/chat/",
            {"message": "Remember I'm prepping for TCF June 15", "mode": "conversation"},
            format="json",
        )

    assert response.status_code == 200
    body = response.json()
    assert "memory_saved" in body
    assert body["memory_saved"]["category"] == "goal"
    assert body["memory_saved"]["content"] == "User is preparing for the TCF on June 15"
    assert isinstance(body["memory_saved"]["id"], int)
    note = MemoryNote.objects.get(pk=body["memory_saved"]["id"])
    assert note.source == "assistant_detected"


@pytest.mark.django_db
@override_settings(LINGARU_MEMORY_ENABLED=True)
def test_extractor_failure_does_not_break_chat(authed_client, user):
    """If the extractor explodes, the chat response should still be 200
    and `memory_saved` should be absent. The chat reply is intact."""
    fake_chat_router = mock.Mock()
    fake_chat_router.generate.return_value = _llm("Reply intact.")

    with (
        mock.patch("apps.assistant.views.create_llm_router", return_value=fake_chat_router),
        mock.patch(
            "services.memory.extractor._build_router",
            side_effect=RuntimeError("disaster"),
        ),
    ):
        response = authed_client.post(
            "/api/assistant/chat/",
            {"message": "remember X", "mode": "conversation"},
            format="json",
        )

    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "Reply intact."
    assert "memory_saved" not in body


@pytest.mark.django_db
@override_settings(LINGARU_MEMORY_ENABLED=True)
def test_assembler_failure_does_not_break_chat(authed_client, user):
    """If assemble_user_context blows up, the chat turn still succeeds
    with no context injection."""
    fake_chat_router = mock.Mock()
    fake_chat_router.generate.return_value = _llm("Reply intact.")
    fake_extract_router = mock.Mock()
    fake_extract_router.generate.return_value = _llm('{"remember": false}')

    with (
        mock.patch(
            "apps.assistant.views.assemble_user_context",
            side_effect=RuntimeError("assembler died"),
        ),
        mock.patch("apps.assistant.views.create_llm_router", return_value=fake_chat_router),
        mock.patch("services.memory.extractor._build_router", return_value=fake_extract_router),
    ):
        response = authed_client.post(
            "/api/assistant/chat/",
            {"message": "hello", "mode": "conversation"},
            format="json",
        )

    assert response.status_code == 200
    assert response.json()["reply"] == "Reply intact."
