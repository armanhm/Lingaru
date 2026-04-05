from dataclasses import dataclass


@dataclass
class Chunk:
    content: str
    index: int


def chunk_text(
    text: str,
    chunk_size: int = 2000,
    overlap: int = 200,
) -> list[Chunk]:
    """Split text into overlapping chunks.

    Args:
        text: The full text to chunk.
        chunk_size: Maximum characters per chunk.
        overlap: Number of overlapping characters between adjacent chunks.

    Returns:
        List of Chunk objects with content and sequential index.
    """
    text = text.strip()
    if not text:
        return []

    chunks = []
    start = 0
    index = 0

    while start < len(text):
        end = start + chunk_size
        chunk_content = text[start:end]

        chunks.append(Chunk(content=chunk_content, index=index))

        # Move forward by chunk_size - overlap
        start += chunk_size - overlap
        index += 1

    return chunks
