import io
import logging

from PyPDF2 import PdfReader

logger = logging.getLogger(__name__)


class UnsupportedFileTypeError(Exception):
    pass


def extract_text(
    file: io.BytesIO,
    file_type: str,
    return_page_count: bool = False,
) -> str | tuple[str, int]:
    """Extract text content from a file.

    Args:
        file: File-like object to read from.
        file_type: One of "pdf" or "txt".
        return_page_count: If True, return (text, page_count) tuple.

    Returns:
        Extracted text string, or (text, page_count) if return_page_count=True.

    Raises:
        UnsupportedFileTypeError: If file_type is not supported.
    """
    if file_type == "txt":
        text = file.read()
        if isinstance(text, bytes):
            text = text.decode("utf-8")
        if return_page_count:
            return text, 1
        return text

    if file_type == "pdf":
        reader = PdfReader(file)
        pages = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                pages.append(page_text.strip())

        text = "\n\n".join(pages)
        page_count = len(reader.pages)

        logger.info("Extracted %d characters from %d PDF pages", len(text), page_count)

        if return_page_count:
            return text, page_count
        return text

    raise UnsupportedFileTypeError(f"Unsupported file type: {file_type}. Supported: pdf, txt")
