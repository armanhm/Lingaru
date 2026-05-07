import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.documents.models import Document, DocumentChunk
from apps.users.models import User


class TestDocumentUploadView(TestCase):
    """Test document upload endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)

    def test_upload_txt_file(self):
        """Uploading a .txt file creates a Document."""
        file = SimpleUploadedFile(
            "notes.txt",
            b"Bonjour le monde. C'est un texte en francais.",
            content_type="text/plain",
        )

        response = self.client.post(
            "/api/documents/upload/",
            {"file": file, "title": "My French Notes"},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Document.objects.count(), 1)
        doc = Document.objects.first()
        self.assertEqual(doc.title, "My French Notes")
        self.assertEqual(doc.file_type, "txt")

    def test_upload_pdf_file(self):
        """Uploading a .pdf file creates a Document with pdf file_type."""
        file = SimpleUploadedFile(
            "textbook.pdf",
            b"%PDF-1.4 fake pdf content",
            content_type="application/pdf",
        )

        response = self.client.post(
            "/api/documents/upload/",
            {"file": file, "title": "Grammar Textbook"},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        doc = Document.objects.first()
        self.assertEqual(doc.file_type, "pdf")

    def test_upload_requires_authentication(self):
        """Unauthenticated requests are rejected."""
        self.client.force_authenticate(user=None)
        file = SimpleUploadedFile("test.txt", b"content", content_type="text/plain")

        response = self.client.post(
            "/api/documents/upload/",
            {"file": file, "title": "Test"},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_upload_unsupported_file_type(self):
        """Unsupported file types are rejected."""
        file = SimpleUploadedFile(
            "doc.docx",
            b"fake docx",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

        response = self.client.post(
            "/api/documents/upload/",
            {"file": file, "title": "Word Doc"},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TestDocumentListView(TestCase):
    """Test document list endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)

    def test_list_own_documents(self):
        """User sees only their own documents."""
        Document.objects.create(
            user=self.user,
            title="Doc 1",
            file_type="txt",
        )
        other_user = User.objects.create_user(
            username="other",
            email="other@test.com",
            password="testpass123",
        )
        Document.objects.create(
            user=other_user,
            title="Other Doc",
            file_type="txt",
        )

        response = self.client.get("/api/documents/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["title"], "Doc 1")


class TestDocumentDeleteView(TestCase):
    """Test document delete endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)

    def test_delete_own_document(self):
        """User can delete their own document."""
        doc = Document.objects.create(
            user=self.user,
            title="To Delete",
            file_type="txt",
        )

        response = self.client.delete(f"/api/documents/{doc.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Document.objects.count(), 0)

    def test_cannot_delete_other_users_document(self):
        """User cannot delete another user's document."""
        other_user = User.objects.create_user(
            username="other",
            email="other@test.com",
            password="testpass123",
        )
        doc = Document.objects.create(
            user=other_user,
            title="Not Mine",
            file_type="txt",
        )

        response = self.client.delete(f"/api/documents/{doc.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Document.objects.count(), 1)
