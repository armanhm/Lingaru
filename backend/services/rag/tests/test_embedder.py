from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase

from services.rag.embedder import GeminiEmbedder


def _embed_response(*vectors):
    """Shape of google-genai's EmbedContentResponse: .embeddings[i].values."""
    return SimpleNamespace(embeddings=[SimpleNamespace(values=v) for v in vectors])


class TestGeminiEmbedder(TestCase):
    """Test embedding generation via Gemini API."""

    @patch("services.rag.embedder.genai.Client")
    def test_embed_single_text(self, mock_client_cls):
        """Embedding a single text returns a list of floats."""
        mock_embed = mock_client_cls.return_value.models.embed_content
        mock_embed.return_value = _embed_response([0.1, 0.2, 0.3] * 256)  # 768 dims

        embedder = GeminiEmbedder(api_key="fake-key")
        result = embedder.embed("Bonjour le monde")

        self.assertEqual(len(result), 768)
        self.assertIsInstance(result[0], float)
        mock_client_cls.assert_called_once_with(api_key="fake-key")
        mock_embed.assert_called_once()
        self.assertEqual(mock_embed.call_args.kwargs["contents"], "Bonjour le monde")

    @patch("services.rag.embedder.genai.Client")
    def test_embed_batch(self, mock_client_cls):
        """Embedding multiple texts returns a list of embeddings."""
        single_embedding = [0.1, 0.2, 0.3] * 256
        mock_embed = mock_client_cls.return_value.models.embed_content
        mock_embed.return_value = _embed_response(
            single_embedding, single_embedding, single_embedding
        )

        embedder = GeminiEmbedder(api_key="fake-key")
        results = embedder.embed_batch(["text1", "text2", "text3"])

        self.assertEqual(len(results), 3)
        for emb in results:
            self.assertEqual(len(emb), 768)
        self.assertEqual(mock_embed.call_args.kwargs["contents"], ["text1", "text2", "text3"])

    @patch("services.rag.embedder.genai.Client")
    def test_embed_uses_correct_model(self, mock_client_cls):
        """Embedder uses the configured model name."""
        mock_embed = mock_client_cls.return_value.models.embed_content
        mock_embed.return_value = _embed_response([0.0] * 768)

        embedder = GeminiEmbedder(
            api_key="fake-key",
            model="models/text-embedding-004",
        )
        embedder.embed("test")

        self.assertEqual(mock_embed.call_args.kwargs["model"], "models/text-embedding-004")
