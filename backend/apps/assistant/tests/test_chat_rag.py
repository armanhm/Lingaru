from unittest.mock import MagicMock, patch

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User
from services.llm.base import LLMResponse


class TestChatViewRAGIntegration(TestCase):
    """Test that ChatView integrates RAG context when available."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)

    @patch("apps.assistant.views.retrieve_context_for_query")
    @patch("apps.assistant.views.create_llm_router")
    def test_chat_uses_rag_prompt_when_context_found(
        self,
        mock_router_fn,
        mock_retrieve,
    ):
        """When RAG context is found, rag_conversation prompt is used."""
        mock_retrieve.return_value = "Le subjonctif suit 'il faut que'."

        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="Oui, le subjonctif...",
            provider="gemini",
            tokens_used=50,
        )
        mock_router_fn.return_value = mock_router

        response = self.client.post(
            "/api/assistant/chat/",
            {
                "message": "Explain the subjunctive",
                "mode": "conversation",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify the system prompt contained RAG context
        call_args = mock_router.generate.call_args
        system_prompt = call_args[1]["system_prompt"]
        self.assertIn("Le subjonctif", system_prompt)

    @patch("apps.assistant.views.retrieve_context_for_query")
    @patch("apps.assistant.views.create_llm_router")
    def test_chat_uses_normal_prompt_when_no_context(
        self,
        mock_router_fn,
        mock_retrieve,
    ):
        """When no RAG context, normal conversation prompt is used."""
        mock_retrieve.return_value = None

        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="Bonjour!",
            provider="gemini",
            tokens_used=20,
        )
        mock_router_fn.return_value = mock_router

        response = self.client.post(
            "/api/assistant/chat/",
            {
                "message": "Bonjour",
                "mode": "conversation",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Normal prompt, no RAG context
        call_args = mock_router.generate.call_args
        system_prompt = call_args[1]["system_prompt"]
        self.assertNotIn("excerpts", system_prompt.lower())

    @patch("apps.assistant.views.retrieve_context_for_query")
    @patch("apps.assistant.views.create_llm_router")
    def test_chat_skips_rag_for_non_conversation_modes(
        self,
        mock_router_fn,
        mock_retrieve,
    ):
        """RAG retrieval is not called for grammar_correction mode."""
        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="Corrected text.",
            provider="gemini",
            tokens_used=30,
        )
        mock_router_fn.return_value = mock_router

        response = self.client.post(
            "/api/assistant/chat/",
            {
                "message": "Je suis alle au magasin",
                "mode": "grammar_correction",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_retrieve.assert_not_called()

    @patch("apps.assistant.views.retrieve_context_for_query")
    @patch("apps.assistant.views.create_llm_router")
    def test_chat_response_includes_rag_used_flag(
        self,
        mock_router_fn,
        mock_retrieve,
    ):
        """Response includes rag_used=True when context was injected."""
        mock_retrieve.return_value = "Some context from documents."

        mock_router = MagicMock()
        mock_router.generate.return_value = LLMResponse(
            content="Response.",
            provider="gemini",
            tokens_used=40,
        )
        mock_router_fn.return_value = mock_router

        response = self.client.post(
            "/api/assistant/chat/",
            {
                "message": "Help me",
                "mode": "conversation",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["rag_used"])
