import io
from unittest.mock import patch, MagicMock

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.assistant.models import ImageQuery, Conversation
from apps.users.models import User
from services.llm.base import LLMResponse


def _make_image_file(name="test.jpg", fmt="JPEG"):
    """Create a minimal valid image file for upload tests."""
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color="red").save(buf, format=fmt)
    buf.seek(0)
    content_type = "image/jpeg" if fmt == "JPEG" else "image/png"
    return SimpleUploadedFile(name, buf.read(), content_type=content_type)


class TestImageQueryModel(TestCase):
    """Test ImageQuery model creation and relationships."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="imguser", password="testpass123",
        )

    def test_create_image_query_without_conversation(self):
        """ImageQuery can be created without a conversation."""
        query = ImageQuery.objects.create(
            user=self.user,
            image_file=SimpleUploadedFile(
                "test.jpg", b"fake-image-data", content_type="image/jpeg",
            ),
            extracted_text="Plat du jour",
            ai_response="This means 'dish of the day'.",
        )
        self.assertIsNotNone(query.id)
        self.assertIsNone(query.conversation)
        self.assertEqual(query.user, self.user)

    def test_create_image_query_with_conversation(self):
        """ImageQuery can be linked to an existing conversation."""
        conv = Conversation.objects.create(user=self.user, title="Image chat")
        query = ImageQuery.objects.create(
            user=self.user,
            conversation=conv,
            image_file=SimpleUploadedFile(
                "menu.jpg", b"fake-image", content_type="image/jpeg",
            ),
            ai_response="French menu analysis.",
        )
        self.assertEqual(query.conversation, conv)

    def test_str_representation(self):
        """String representation is meaningful."""
        query = ImageQuery.objects.create(
            user=self.user,
            image_file=SimpleUploadedFile(
                "test.jpg", b"data", content_type="image/jpeg",
            ),
            ai_response="Some response.",
        )
        self.assertIn("ImageQuery", str(query))


class TestImageQueryAPI(TestCase):
    """Test POST /api/assistant/image-query/ endpoint."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="imgapi", password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.url = "/api/assistant/image-query/"

    @patch("apps.assistant.views.create_llm_router")
    def test_image_query_success(self, mock_create_router):
        """Upload image, get AI analysis back."""
        mock_router = MagicMock()
        mock_router.generate_with_image.return_value = LLMResponse(
            content="This sign says 'Sortie' which means 'Exit'.",
            provider="gemini",
            tokens_used=120,
        )
        mock_create_router.return_value = mock_router

        image = _make_image_file("sign.jpg")
        response = self.client.post(
            self.url,
            {"image": image, "question": "What does this sign say?"},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Sortie", response.data["ai_response"])
        self.assertIn("image_query_id", response.data)
        self.assertIn("conversation_id", response.data)

        # Verify DB record created
        query = ImageQuery.objects.get(pk=response.data["image_query_id"])
        self.assertEqual(query.user, self.user)
        self.assertIn("Sortie", query.ai_response)

    @patch("apps.assistant.views.create_llm_router")
    def test_image_query_with_existing_conversation(self, mock_create_router):
        """Image query linked to an existing conversation."""
        mock_router = MagicMock()
        mock_router.generate_with_image.return_value = LLMResponse(
            content="A French menu.", provider="gemini", tokens_used=80,
        )
        mock_create_router.return_value = mock_router

        conv = Conversation.objects.create(user=self.user, title="Chat")

        image = _make_image_file("menu.jpg")
        response = self.client.post(
            self.url,
            {"image": image, "conversation_id": conv.id},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["conversation_id"], conv.id)

    def test_image_query_no_image_returns_400(self):
        """Request without image file returns 400."""
        response = self.client.post(self.url, {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("apps.assistant.views.create_llm_router")
    def test_image_query_no_question(self, mock_create_router):
        """Image without question text still works (pure image analysis)."""
        mock_router = MagicMock()
        mock_router.generate_with_image.return_value = LLMResponse(
            content="French text found in image.", provider="gemini", tokens_used=90,
        )
        mock_create_router.return_value = mock_router

        image = _make_image_file("page.png", fmt="PNG")
        response = self.client.post(
            self.url, {"image": image}, format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch("apps.assistant.views.create_llm_router")
    def test_image_query_llm_failure_returns_503(self, mock_create_router):
        """LLM failure returns 503."""
        mock_router = MagicMock()
        mock_router.generate_with_image.side_effect = Exception("Gemini down")
        mock_create_router.return_value = mock_router

        image = _make_image_file("test.jpg")
        response = self.client.post(
            self.url, {"image": image}, format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    def test_image_query_requires_auth(self):
        """Unauthenticated request returns 401."""
        anon_client = APIClient()
        image = _make_image_file("test.jpg")
        response = anon_client.post(
            self.url, {"image": image}, format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
