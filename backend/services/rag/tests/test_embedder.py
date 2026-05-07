from unittest.mock import MagicMock, patch

from django.test import TestCase

from services.rag.embedder import GeminiEmbedder


class TestGeminiEmbedder(TestCase):
    """Test embedding generation via Gemini API."""

    @patch("services.rag.embedder.genai")
    def test_embed_single_text(self, mock_genai):
        """Embedding a single text returns a list of floats."""
        mock_genai.embed_content.return_value = {
            "embedding": [0.1, 0.2, 0.3] * 256,  # 768 dims
        }

        embedder = GeminiEmbedder(api_key="fake-key")
        result = embedder.embed("Bonjour le monde")

        self.assertEqual(len(result), 768)
        self.assertIsInstance(result[0], float)
        mock_genai.embed_content.assert_called_once()

    @patch("services.rag.embedder.genai")
    def test_embed_batch(self, mock_genai):
        """Embedding multiple texts returns a list of embeddings."""
        single_embedding = [0.1, 0.2, 0.3] * 256
        mock_genai.embed_content.return_value = {
            "embedding": [single_embedding, single_embedding, single_embedding],
        }

        embedder = GeminiEmbedder(api_key="fake-key")
        results = embedder.embed_batch(["text1", "text2", "text3"])

        self.assertEqual(len(results), 3)
        for emb in results:
            self.assertEqual(len(emb), 768)

    @patch("services.rag.embedder.genai")
    def test_embed_uses_correct_model(self, mock_genai):
        """Embedder uses the configured model name."""
        mock_genai.embed_content.return_value = {
            "embedding": [0.0] * 768,
        }

        embedder = GeminiEmbedder(
            api_key="fake-key",
            model="models/text-embedding-004",
        )
        embedder.embed("test")

        call_kwargs = mock_genai.embed_content.call_args
        self.assertEqual(call_kwargs[1]["model"], "models/text-embedding-004")
