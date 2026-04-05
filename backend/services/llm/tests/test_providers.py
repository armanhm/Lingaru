import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.llm.base import BaseProvider, LLMResponse
from services.llm.gemini import GeminiProvider
from services.llm.groq_provider import GroqProvider
from services.llm.router import ProviderRouter


class TestLLMResponse:
    def test_llm_response_fields(self):
        resp = LLMResponse(
            content="Bonjour!",
            provider="gemini",
            tokens_used=42,
        )
        assert resp.content == "Bonjour!"
        assert resp.provider == "gemini"
        assert resp.tokens_used == 42


class TestBaseProvider:
    def test_cannot_instantiate_abstract(self):
        with pytest.raises(TypeError):
            BaseProvider(api_key="key", model="model")


class TestGeminiProvider:
    @patch("services.llm.gemini.genai")
    def test_generate_success(self, mock_genai):
        # Set up the mock chain
        mock_model = MagicMock()
        mock_genai.GenerativeModel.return_value = mock_model

        mock_response = MagicMock()
        mock_response.text = "Bonjour, comment allez-vous?"
        mock_response.usage_metadata.total_token_count = 25
        mock_model.generate_content.return_value = mock_response

        provider = GeminiProvider(api_key="fake-key", model="gemini-2.0-flash")
        result = provider.generate(
            messages=[{"role": "user", "content": "Hello"}],
            system_prompt="You are a French tutor.",
        )

        assert result.content == "Bonjour, comment allez-vous?"
        assert result.provider == "gemini"
        assert result.tokens_used == 25
        mock_genai.configure.assert_called_once_with(api_key="fake-key")

    @patch("services.llm.gemini.genai")
    def test_generate_raises_on_api_error(self, mock_genai):
        mock_model = MagicMock()
        mock_genai.GenerativeModel.return_value = mock_model
        mock_model.generate_content.side_effect = Exception("Rate limit exceeded")

        provider = GeminiProvider(api_key="fake-key", model="gemini-2.0-flash")
        with pytest.raises(Exception, match="Rate limit exceeded"):
            provider.generate(
                messages=[{"role": "user", "content": "Hello"}],
                system_prompt="You are a French tutor.",
            )


class TestGroqProvider:
    @patch("services.llm.groq_provider.Groq")
    def test_generate_success(self, MockGroq):
        mock_client = MagicMock()
        MockGroq.return_value = mock_client

        mock_choice = MagicMock()
        mock_choice.message.content = "Voici la correction."
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage.total_tokens = 30
        mock_client.chat.completions.create.return_value = mock_response

        provider = GroqProvider(api_key="fake-key", model="llama-3.3-70b-versatile")
        result = provider.generate(
            messages=[{"role": "user", "content": "Correct this"}],
            system_prompt="You are a grammar corrector.",
        )

        assert result.content == "Voici la correction."
        assert result.provider == "groq"
        assert result.tokens_used == 30

    @patch("services.llm.groq_provider.Groq")
    def test_generate_raises_on_api_error(self, MockGroq):
        mock_client = MagicMock()
        MockGroq.return_value = mock_client
        mock_client.chat.completions.create.side_effect = Exception("Service unavailable")

        provider = GroqProvider(api_key="fake-key", model="llama-3.3-70b-versatile")
        with pytest.raises(Exception, match="Service unavailable"):
            provider.generate(
                messages=[{"role": "user", "content": "Hello"}],
                system_prompt="Tutor prompt.",
            )


class TestProviderRouter:
    def test_generate_uses_primary(self):
        primary = MagicMock()
        primary.generate.return_value = LLMResponse(
            content="From primary", provider="gemini", tokens_used=10,
        )
        fallback = MagicMock()

        router = ProviderRouter(primary=primary, fallback=fallback)
        result = router.generate(
            messages=[{"role": "user", "content": "Hi"}],
            system_prompt="Prompt.",
        )

        assert result.content == "From primary"
        assert result.provider == "gemini"
        primary.generate.assert_called_once()
        fallback.generate.assert_not_called()

    def test_generate_falls_back_on_primary_error(self):
        primary = MagicMock()
        primary.generate.side_effect = Exception("Rate limit")
        fallback = MagicMock()
        fallback.generate.return_value = LLMResponse(
            content="From fallback", provider="groq", tokens_used=20,
        )

        router = ProviderRouter(primary=primary, fallback=fallback)
        result = router.generate(
            messages=[{"role": "user", "content": "Hi"}],
            system_prompt="Prompt.",
        )

        assert result.content == "From fallback"
        assert result.provider == "groq"
        primary.generate.assert_called_once()
        fallback.generate.assert_called_once()

    def test_generate_raises_when_both_fail(self):
        primary = MagicMock()
        primary.generate.side_effect = Exception("Primary down")
        fallback = MagicMock()
        fallback.generate.side_effect = Exception("Fallback down")

        router = ProviderRouter(primary=primary, fallback=fallback)
        with pytest.raises(Exception, match="Fallback down"):
            router.generate(
                messages=[{"role": "user", "content": "Hi"}],
                system_prompt="Prompt.",
            )

    def test_generate_works_without_fallback(self):
        primary = MagicMock()
        primary.generate.return_value = LLMResponse(
            content="Solo", provider="gemini", tokens_used=5,
        )

        router = ProviderRouter(primary=primary, fallback=None)
        result = router.generate(
            messages=[{"role": "user", "content": "Hi"}],
            system_prompt="Prompt.",
        )

        assert result.content == "Solo"

    def test_raises_when_no_fallback_and_primary_fails(self):
        primary = MagicMock()
        primary.generate.side_effect = Exception("Down")

        router = ProviderRouter(primary=primary, fallback=None)
        with pytest.raises(Exception, match="Down"):
            router.generate(
                messages=[{"role": "user", "content": "Hi"}],
                system_prompt="Prompt.",
            )
