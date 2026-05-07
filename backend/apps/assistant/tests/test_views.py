from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.assistant.models import Conversation, Message
from services.llm.base import LLMResponse

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="chatuser",
        email="chat@example.com",
        password="testpass123!",
    )


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def conversation(user):
    return Conversation.objects.create(user=user, title="Existing chat")


@pytest.fixture
def mock_llm_response():
    return LLMResponse(
        content="Bonjour! Comment allez-vous?",
        provider="gemini",
        tokens_used=25,
    )


@pytest.mark.django_db
class TestChatView:
    @patch("apps.assistant.views.create_llm_router")
    def test_chat_creates_new_conversation(
        self,
        mock_factory,
        authenticated_client,
        mock_llm_response,
    ):
        mock_router = MagicMock()
        mock_router.generate.return_value = mock_llm_response
        mock_factory.return_value = mock_router

        response = authenticated_client.post(
            "/api/assistant/chat/",
            {"message": "Bonjour!", "mode": "conversation"},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["reply"] == "Bonjour! Comment allez-vous?"
        assert response.data["provider"] == "gemini"
        assert response.data["tokens_used"] == 25
        assert "conversation_id" in response.data
        assert Conversation.objects.count() == 1
        assert Message.objects.count() == 2  # user + assistant

    @patch("apps.assistant.views.create_llm_router")
    def test_chat_extracts_blocks_from_fenced_reply(
        self,
        mock_factory,
        authenticated_client,
    ):
        # When the LLM returns prose + a ```blocks fence, the view should
        # split them: prose goes to .reply, parsed blocks go to .blocks,
        # and the fence is stripped from what's persisted on the Message.
        from apps.assistant.models import Message
        from services.llm.base import LLMResponse

        fenced = (
            "Voici la conjugaison.\n"
            "```blocks\n"
            '[{"type":"audio","text":"je vais"},'
            ' {"type":"vocab_card","french":"aller","english":"to go"}]\n'
            "```"
        )
        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content=fenced,
            provider="gemini",
            tokens_used=12,
        )
        mock_factory.return_value = mock_router

        resp = authenticated_client.post(
            "/api/assistant/chat/",
            {"message": "Conjugue 'aller'", "mode": "conversation"},
            format="json",
        )

        assert resp.status_code == 200
        assert resp.data["reply"] == "Voici la conjugaison."
        assert len(resp.data["blocks"]) == 2
        assert resp.data["blocks"][0]["type"] == "audio"
        assert resp.data["blocks"][1]["type"] == "vocab_card"

        # Persisted message has the same shape — fence stripped from content.
        assistant_msg = Message.objects.get(role="assistant")
        assert "```blocks" not in assistant_msg.content
        assert assistant_msg.content == "Voici la conjugaison."
        assert len(assistant_msg.blocks) == 2

    @patch("apps.assistant.views.create_llm_router")
    def test_chat_continues_existing_conversation(
        self,
        mock_factory,
        authenticated_client,
        conversation,
        mock_llm_response,
    ):
        # Add prior messages
        Message.objects.create(
            conversation=conversation,
            role="user",
            content="Salut!",
        )
        Message.objects.create(
            conversation=conversation,
            role="assistant",
            content="Salut!",
            provider="gemini",
            tokens_used=10,
        )

        mock_router = MagicMock()
        mock_router.generate.return_value = mock_llm_response
        mock_factory.return_value = mock_router

        response = authenticated_client.post(
            "/api/assistant/chat/",
            {
                "message": "Comment vas-tu?",
                "mode": "conversation",
                "conversation_id": conversation.id,
            },
            format="json",
        )

        assert response.status_code == 200
        assert response.data["conversation_id"] == conversation.id
        # 2 prior + 2 new = 4 messages
        assert Message.objects.filter(conversation=conversation).count() == 4
        # Should pass prior messages to the LLM
        call_args = mock_router.generate.call_args
        messages = call_args[1]["messages"] if "messages" in call_args[1] else call_args[0][0]
        assert len(messages) == 3  # 2 prior + 1 new user message

    @patch("apps.assistant.views.create_llm_router")
    def test_chat_grammar_correction_mode(
        self,
        mock_factory,
        authenticated_client,
    ):
        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="Corrected text here.",
            provider="groq",
            tokens_used=30,
        )
        mock_factory.return_value = mock_router

        response = authenticated_client.post(
            "/api/assistant/chat/",
            {"message": "Je suis alle au magasin", "mode": "grammar_correction"},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["reply"] == "Corrected text here."
        # Should use grammar_correction system prompt
        call_args = mock_router.generate.call_args
        system_prompt = (
            call_args[1]["system_prompt"] if "system_prompt" in call_args[1] else call_args[0][1]
        )
        assert "correct" in system_prompt.lower() or "Correct" in system_prompt

    @patch("apps.assistant.views.create_llm_router")
    def test_chat_llm_error_returns_503(
        self,
        mock_factory,
        authenticated_client,
    ):
        mock_router = MagicMock()
        mock_router.generate.side_effect = Exception("All providers failed")
        mock_factory.return_value = mock_router

        response = authenticated_client.post(
            "/api/assistant/chat/",
            {"message": "Bonjour!", "mode": "conversation"},
            format="json",
        )

        assert response.status_code == 503
        assert "error" in response.data or "detail" in response.data

    def test_chat_unauthenticated(self, api_client):
        response = api_client.post(
            "/api/assistant/chat/",
            {"message": "Bonjour!", "mode": "conversation"},
            format="json",
        )
        assert response.status_code == 401

    @patch("apps.assistant.views.create_llm_router")
    def test_chat_invalid_conversation_id(
        self,
        mock_factory,
        authenticated_client,
    ):
        response = authenticated_client.post(
            "/api/assistant/chat/",
            {
                "message": "Hi",
                "mode": "conversation",
                "conversation_id": 99999,
            },
            format="json",
        )
        assert response.status_code == 404

    @patch("apps.assistant.views.create_llm_router")
    def test_chat_other_users_conversation(
        self,
        mock_factory,
        authenticated_client,
    ):
        other_user = User.objects.create_user(
            username="other",
            email="other@example.com",
            password="testpass123!",
        )
        other_conv = Conversation.objects.create(
            user=other_user,
            title="Private",
        )
        response = authenticated_client.post(
            "/api/assistant/chat/",
            {
                "message": "Hi",
                "mode": "conversation",
                "conversation_id": other_conv.id,
            },
            format="json",
        )
        assert response.status_code == 404


@pytest.mark.django_db
class TestConversationListView:
    def test_list_conversations(self, authenticated_client, user):
        Conversation.objects.create(user=user, title="Chat 1")
        Conversation.objects.create(user=user, title="Chat 2")

        response = authenticated_client.get("/api/assistant/conversations/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 2

    def test_list_only_own_conversations(self, authenticated_client, user):
        Conversation.objects.create(user=user, title="My chat")
        other_user = User.objects.create_user(
            username="other2",
            email="other2@example.com",
            password="testpass123!",
        )
        Conversation.objects.create(user=other_user, title="Their chat")

        response = authenticated_client.get("/api/assistant/conversations/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["title"] == "My chat"

    def test_list_unauthenticated(self, api_client):
        response = api_client.get("/api/assistant/conversations/")
        assert response.status_code == 401


@pytest.mark.django_db
class TestConversationDetailView:
    def test_get_conversation_with_messages(self, authenticated_client, conversation):
        Message.objects.create(
            conversation=conversation,
            role="user",
            content="Bonjour",
        )
        Message.objects.create(
            conversation=conversation,
            role="assistant",
            content="Salut!",
            provider="gemini",
            tokens_used=10,
        )

        response = authenticated_client.get(
            f"/api/assistant/conversations/{conversation.id}/",
        )
        assert response.status_code == 200
        assert response.data["title"] == "Existing chat"
        assert len(response.data["messages"]) == 2

    def test_get_other_users_conversation(self, authenticated_client):
        other_user = User.objects.create_user(
            username="other3",
            email="other3@example.com",
            password="testpass123!",
        )
        other_conv = Conversation.objects.create(
            user=other_user,
            title="Secret",
        )
        response = authenticated_client.get(
            f"/api/assistant/conversations/{other_conv.id}/",
        )
        assert response.status_code == 404

    def test_get_nonexistent_conversation(self, authenticated_client):
        response = authenticated_client.get(
            "/api/assistant/conversations/99999/",
        )
        assert response.status_code == 404
