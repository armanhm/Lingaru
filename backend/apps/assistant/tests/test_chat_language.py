"""Pin per-language chat + agent prompt routing (v2.0.0)."""

from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.agents.models import Agent
from services.llm.base import LLMResponse

User = get_user_model()


def _llm(text):
    return LLMResponse(content=text, provider="gemini", tokens_used=10)


@pytest.fixture
def authed_client(db):
    def make(target_language):
        user = User.objects.create_user(
            username=f"u_{target_language}",
            email=f"u_{target_language}@x.com",
            password="x",
            target_language=target_language,
        )
        c = APIClient()
        c.force_authenticate(user)
        return c, user

    return make


@pytest.mark.django_db
def test_chat_uses_en_system_prompt_when_target_language_en(authed_client):
    """The chat router receives an EN-flavored prompt for EN users."""
    client, _ = authed_client("en")
    fake = mock.Mock()
    fake.generate.return_value = _llm("Hello!")
    with mock.patch("apps.assistant.views.create_llm_router", return_value=fake):
        response = client.post(
            "/api/assistant/chat/",
            {"message": "Hi", "mode": "conversation"},
            format="json",
        )
    assert response.status_code == 200
    sys_prompt = fake.generate.call_args.kwargs["system_prompt"]
    # The EN prompt should mention English-flavored content; it should NOT
    # be the French tutor prompt.
    assert "French tutor" not in sys_prompt
    assert "English" in sys_prompt


@pytest.mark.django_db
def test_chat_uses_fr_system_prompt_when_target_language_fr(authed_client):
    client, _ = authed_client("fr")
    fake = mock.Mock()
    fake.generate.return_value = _llm("Bonjour!")
    with mock.patch("apps.assistant.views.create_llm_router", return_value=fake):
        response = client.post(
            "/api/assistant/chat/",
            {"message": "Salut", "mode": "conversation"},
            format="json",
        )
    assert response.status_code == 200
    sys_prompt = fake.generate.call_args.kwargs["system_prompt"]
    # The FR prompt should be the French tutor prompt.
    assert "French tutor" in sys_prompt
    assert "English tutor" not in sys_prompt


@pytest.mark.django_db
def test_chat_agent_with_en_prompt_used_for_en_user(authed_client):
    Agent.objects.create(
        slug="grammar-en-test",
        name="Grammar",
        system_prompt="Tu es un tuteur de grammaire française.",
        system_prompt_en="You are an English grammar tutor.",
    )
    client, _ = authed_client("en")
    fake = mock.Mock()
    fake.generate.return_value = _llm("ok")
    with mock.patch("apps.assistant.views.create_llm_router", return_value=fake):
        response = client.post(
            "/api/assistant/chat/",
            {"message": "Hi", "mode": "conversation", "agent_slug": "grammar-en-test"},
            format="json",
        )
    assert response.status_code == 200
    sys_prompt = fake.generate.call_args.kwargs["system_prompt"]
    assert "English grammar tutor" in sys_prompt


@pytest.mark.django_db
def test_chat_agent_with_empty_en_prompt_falls_back_to_fr(authed_client):
    """If system_prompt_en is empty, EN users get the FR prompt (graceful fallback)."""
    Agent.objects.create(
        slug="vocab-fallback-test",
        name="Vocab",
        system_prompt="Tu es un tuteur de vocabulaire.",
        system_prompt_en="",
    )
    client, _ = authed_client("en")
    fake = mock.Mock()
    fake.generate.return_value = _llm("ok")
    with mock.patch("apps.assistant.views.create_llm_router", return_value=fake):
        response = client.post(
            "/api/assistant/chat/",
            {"message": "Hi", "mode": "conversation", "agent_slug": "vocab-fallback-test"},
            format="json",
        )
    assert response.status_code == 200
    sys_prompt = fake.generate.call_args.kwargs["system_prompt"]
    assert "tuteur de vocabulaire" in sys_prompt
