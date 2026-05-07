import io
from unittest.mock import MagicMock, patch

from django.test import TestCase

from services.rag.extractor import UnsupportedFileTypeError, extract_text


class TestTextExtraction(TestCase):
    """Test text extraction from different file types."""

    def test_extract_text_from_txt_file(self):
        """Plain text files are read directly."""
        content = "Bonjour, je suis un texte en francais."
        file = io.BytesIO(content.encode("utf-8"))

        result = extract_text(file, file_type="txt")

        self.assertEqual(result, content)

    def test_extract_text_from_txt_handles_encoding(self):
        """UTF-8 encoded text with accents is handled correctly."""
        content = "Les eleves etudient le francais a l'ecole."
        file = io.BytesIO(content.encode("utf-8"))

        result = extract_text(file, file_type="txt")

        self.assertEqual(result, content)

    @patch("services.rag.extractor.PdfReader")
    def test_extract_text_from_pdf(self, mock_reader_cls):
        """PDF files are read page by page."""
        page1 = MagicMock()
        page1.extract_text.return_value = "Page one text."
        page2 = MagicMock()
        page2.extract_text.return_value = "Page two text."

        mock_reader = MagicMock()
        mock_reader.pages = [page1, page2]
        mock_reader_cls.return_value = mock_reader

        file = io.BytesIO(b"fake-pdf-bytes")

        result = extract_text(file, file_type="pdf")

        self.assertEqual(result, "Page one text.\n\nPage two text.")

    @patch("services.rag.extractor.PdfReader")
    def test_extract_text_returns_page_count(self, mock_reader_cls):
        """Extraction returns page count for PDFs."""
        page1 = MagicMock()
        page1.extract_text.return_value = "Text."
        mock_reader = MagicMock()
        mock_reader.pages = [page1]
        mock_reader_cls.return_value = mock_reader

        file = io.BytesIO(b"fake-pdf-bytes")

        result, page_count = extract_text(file, file_type="pdf", return_page_count=True)

        self.assertEqual(page_count, 1)

    def test_extract_text_unsupported_type_raises(self):
        """Unsupported file types raise UnsupportedFileTypeError."""
        file = io.BytesIO(b"data")

        with self.assertRaises(UnsupportedFileTypeError):
            extract_text(file, file_type="docx")
