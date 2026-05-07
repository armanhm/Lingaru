from unittest.mock import MagicMock, patch

from django.core.files.base import ContentFile
from django.test import TestCase

from apps.documents.models import Document, DocumentChunk
from apps.users.models import User
from services.rag.context import retrieve_context_for_query


class TestRetrieveContextForQuery(TestCase):
    """Test RAG context retrieval for chat."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.document = Document.objects.create(
            user=self.user,
            title="French Grammar",
            file_type="txt",
            processed=True,
        )

    def test_returns_none_when_no_documents(self):
        """No processed documents returns None."""
        other_user = User.objects.create_user(
            username="other",
            email="other@test.com",
            password="testpass123",
        )

        result = retrieve_context_for_query(other_user.id, "some query")

        self.assertIsNone(result)

    def test_returns_none_when_no_chunks_with_embeddings(self):
        """Documents with empty embeddings return None."""
        DocumentChunk.objects.create(
            document=self.document,
            content="Text",
            chunk_index=0,
            embedding=[],
        )

        result = retrieve_context_for_query(self.user.id, "some query")

        self.assertIsNone(result)

    @patch("services.rag.context.GeminiEmbedder")
    def test_returns_formatted_context(self, mock_embedder_cls):
        """Relevant chunks are returned as formatted context string."""
        # Create chunk with embedding
        DocumentChunk.objects.create(
            document=self.document,
            content="Le subjonctif est utilise apres certains verbes.",
            chunk_index=0,
            embedding=[1.0] + [0.0] * 767,
        )

        # Mock embedder to return similar embedding
        mock_embedder = MagicMock()
        mock_embedder.embed_query.return_value = [1.0] + [0.0] * 767
        mock_embedder_cls.return_value = mock_embedder

        result = retrieve_context_for_query(
            self.user.id,
            "How do I use the subjunctive?",
        )

        self.assertIsNotNone(result)
        self.assertIn("subjonctif", result)
        self.assertIn("French Grammar", result)

    @patch("services.rag.context.GeminiEmbedder")
    def test_returns_none_when_embedding_fails(self, mock_embedder_cls):
        """Embedding API failure returns None gracefully."""
        DocumentChunk.objects.create(
            document=self.document,
            content="Some text",
            chunk_index=0,
            embedding=[0.5] * 768,
        )

        mock_embedder = MagicMock()
        mock_embedder.embed_query.side_effect = Exception("API error")
        mock_embedder_cls.return_value = mock_embedder

        result = retrieve_context_for_query(self.user.id, "test query")

        self.assertIsNone(result)
