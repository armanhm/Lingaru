import io
from unittest.mock import patch, MagicMock

from django.core.files.base import ContentFile
from django.test import TestCase

from apps.documents.models import Document, DocumentChunk
from apps.users.models import User
from services.rag.pipeline import process_document


class TestProcessDocumentPipeline(TestCase):
    """Test the full RAG processing pipeline."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123",
        )
        self.document = Document.objects.create(
            user=self.user,
            title="Test Document",
            file=ContentFile(
                b"This is a test document with some French content. "
                b"Bonjour le monde.",
                name="test.txt",
            ),
            file_type="txt",
        )

    @patch("services.rag.pipeline.GeminiEmbedder")
    def test_process_document_creates_chunks(self, mock_embedder_cls):
        """Processing a document creates chunks with embeddings."""
        mock_embedder = MagicMock()
        mock_embedder.embed_batch.return_value = [[0.1] * 768]
        mock_embedder_cls.return_value = mock_embedder

        process_document(self.document.id)

        self.document.refresh_from_db()
        self.assertTrue(self.document.processed)
        self.assertIsNone(self.document.processing_error)
        self.assertGreater(DocumentChunk.objects.filter(document=self.document).count(), 0)

    @patch("services.rag.pipeline.GeminiEmbedder")
    def test_process_document_sets_page_count(self, mock_embedder_cls):
        """Processing sets the page count on the document."""
        mock_embedder = MagicMock()
        mock_embedder.embed_batch.return_value = [[0.1] * 768]
        mock_embedder_cls.return_value = mock_embedder

        process_document(self.document.id)

        self.document.refresh_from_db()
        self.assertEqual(self.document.page_count, 1)  # txt = 1 page

    @patch("services.rag.pipeline.GeminiEmbedder")
    def test_process_document_handles_empty_text(self, mock_embedder_cls):
        """Document with no extractable text is marked processed with error."""
        empty_doc = Document.objects.create(
            user=self.user,
            title="Empty",
            file=ContentFile(b"", name="empty.txt"),
            file_type="txt",
        )

        process_document(empty_doc.id)

        empty_doc.refresh_from_db()
        self.assertTrue(empty_doc.processed)
        self.assertIn("No text", empty_doc.processing_error)

    @patch("services.rag.pipeline.GeminiEmbedder")
    def test_process_document_records_error_on_failure(self, mock_embedder_cls):
        """Embedding API failure records error on document."""
        mock_embedder = MagicMock()
        mock_embedder.embed_batch.side_effect = Exception("API rate limit")
        mock_embedder_cls.return_value = mock_embedder

        with self.assertRaises(Exception):
            process_document(self.document.id)

        self.document.refresh_from_db()
        self.assertFalse(self.document.processed)
        self.assertIn("API rate limit", self.document.processing_error)
