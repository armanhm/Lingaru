from unittest.mock import MagicMock, patch
from django.test import TestCase

from services.llm.base import LLMResponse
from services.llm.gemini import GeminiProvider
from services.llm.router import ProviderRouter


class TestGeminiVisionGeneration(TestCase):
    """Test generate_with_image on GeminiProvider."""

    @patch("services.llm.gemini.genai")
    def test_generate_with_image_returns_response(self, mock_genai):
        """Image + text prompt returns an LLMResponse with extracted content."""
        # Arrange
        mock_response = MagicMock()
        mock_response.text = "This is a French menu. It says 'Plat du jour: Poulet roti'."
        mock_response.usage_metadata = MagicMock(total_token_count=150)

        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model_instance

        provider = GeminiProvider(api_key="fake-key", model="gemini-2.0-flash")

        messages = [{"role": "user", "content": "What does this menu say?"}]
        image_data = b"fake-image-bytes"

        # Act
        result = provider.generate_with_image(
            messages=messages,
            image_data=image_data,
            image_mime_type="image/jpeg",
            system_prompt="Analyze this French image.",
        )

        # Assert
        self.assertIsInstance(result, LLMResponse)
        self.assertEqual(result.provider, "gemini")
        self.assertIn("French menu", result.content)
        self.assertEqual(result.tokens_used, 150)

        # Verify the model was constructed with a system instruction
        mock_genai.GenerativeModel.assert_called_once_with(
            "gemini-2.0-flash",
            system_instruction="Analyze this French image.",
        )

        # Verify generate_content was called with image part + text
        call_args = mock_model_instance.generate_content.call_args
        contents = call_args[0][0]
        # Should have the image part and the user text
        self.assertEqual(len(contents), 2)

    @patch("services.llm.gemini.genai")
    def test_generate_with_image_no_question(self, mock_genai):
        """Image with empty messages still works (just image analysis)."""
        mock_response = MagicMock()
        mock_response.text = "A French street sign reading 'Rue de la Paix'."
        mock_response.usage_metadata = MagicMock(total_token_count=80)

        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model_instance

        provider = GeminiProvider(api_key="fake-key", model="gemini-2.0-flash")

        result = provider.generate_with_image(
            messages=[],
            image_data=b"fake-image-bytes",
            image_mime_type="image/jpeg",
            system_prompt="Analyze this French image.",
        )

        self.assertIn("Rue de la Paix", result.content)

    @patch("services.llm.gemini.genai")
    def test_generate_with_image_token_count_fallback(self, mock_genai):
        """Handles missing usage_metadata gracefully."""
        mock_response = MagicMock()
        mock_response.text = "Some response"
        mock_response.usage_metadata = None

        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model_instance

        provider = GeminiProvider(api_key="fake-key", model="gemini-2.0-flash")

        result = provider.generate_with_image(
            messages=[{"role": "user", "content": "What is this?"}],
            image_data=b"fake-bytes",
            image_mime_type="image/png",
            system_prompt="Analyze.",
        )

        self.assertEqual(result.tokens_used, 0)


class TestProviderRouterVision(TestCase):
    """Test that ProviderRouter delegates generate_with_image correctly."""

    def test_router_calls_primary_for_vision(self):
        """Router delegates to primary provider's generate_with_image."""
        mock_primary = MagicMock()
        mock_primary.generate_with_image.return_value = LLMResponse(
            content="analyzed", provider="gemini", tokens_used=100,
        )

        router = ProviderRouter(primary=mock_primary, fallback=None)
        result = router.generate_with_image(
            messages=[{"role": "user", "content": "Explain"}],
            image_data=b"bytes",
            image_mime_type="image/jpeg",
            system_prompt="Analyze.",
        )

        self.assertEqual(result.content, "analyzed")
        mock_primary.generate_with_image.assert_called_once()

    def test_router_raises_if_primary_lacks_vision(self):
        """Router raises NotImplementedError if primary has no vision support."""
        mock_primary = MagicMock()
        mock_primary.generate_with_image.side_effect = NotImplementedError(
            "This provider does not support vision.",
        )

        router = ProviderRouter(primary=mock_primary, fallback=None)

        with self.assertRaises(NotImplementedError):
            router.generate_with_image(
                messages=[], image_data=b"bytes",
                image_mime_type="image/jpeg", system_prompt="Analyze.",
            )

    def test_router_does_not_fallback_for_vision(self):
        """Vision does not fall back -- only Gemini supports it."""
        mock_primary = MagicMock()
        mock_primary.generate_with_image.side_effect = Exception("Gemini down")
        mock_fallback = MagicMock()

        router = ProviderRouter(primary=mock_primary, fallback=mock_fallback)

        with self.assertRaises(Exception):
            router.generate_with_image(
                messages=[], image_data=b"bytes",
                image_mime_type="image/jpeg", system_prompt="Analyze.",
            )

        # Fallback should NOT be called for vision
        mock_fallback.generate_with_image.assert_not_called()
