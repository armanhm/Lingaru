from django.test import TestCase

from apps.documents.models import Document, DocumentChunk
from apps.users.models import User


class TestDocumentModel(TestCase):
    """Test Document model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123",
        )

    def test_create_document(self):
        """Document can be created with required fields."""
        doc = Document.objects.create(
            user=self.user,
            title="French Grammar Book",
            file_type="pdf",
        )
        self.assertEqual(doc.title, "French Grammar Book")
        self.assertEqual(doc.file_type, "pdf")
        self.assertFalse(doc.processed)
        self.assertIsNone(doc.processing_error)

    def test_document_str(self):
        """Document string representation uses title."""
        doc = Document.objects.create(
            user=self.user,
            title="My Textbook",
            file_type="pdf",
        )
        self.assertEqual(str(doc), "My Textbook")

    def test_document_user_cascade_delete(self):
        """Deleting user deletes their documents."""
        Document.objects.create(
            user=self.user, title="Test", file_type="txt",
        )
        self.user.delete()
        self.assertEqual(Document.objects.count(), 0)


class TestDocumentChunkModel(TestCase):
    """Test DocumentChunk model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123",
        )
        self.document = Document.objects.create(
            user=self.user, title="Test Doc", file_type="txt",
        )

    def test_create_chunk(self):
        """DocumentChunk can be created with content and embedding."""
        chunk = DocumentChunk.objects.create(
            document=self.document,
            content="Some French text about grammar.",
            chunk_index=0,
            embedding=[0.1] * 768,
        )
        self.assertEqual(chunk.chunk_index, 0)
        self.assertEqual(len(chunk.embedding), 768)

    def test_chunk_document_cascade_delete(self):
        """Deleting document deletes its chunks."""
        DocumentChunk.objects.create(
            document=self.document,
            content="Text",
            chunk_index=0,
            embedding=[0.0] * 768,
        )
        self.document.delete()
        self.assertEqual(DocumentChunk.objects.count(), 0)

    def test_chunk_ordering(self):
        """Chunks are ordered by chunk_index."""
        DocumentChunk.objects.create(
            document=self.document, content="Second",
            chunk_index=1, embedding=[],
        )
        DocumentChunk.objects.create(
            document=self.document, content="First",
            chunk_index=0, embedding=[],
        )

        chunks = list(DocumentChunk.objects.filter(document=self.document))
        self.assertEqual(chunks[0].content, "First")
        self.assertEqual(chunks[1].content, "Second")
