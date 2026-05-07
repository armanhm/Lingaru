from django.test import TestCase

from services.rag.chunker import Chunk, chunk_text


class TestTextChunking(TestCase):
    """Test text chunking with overlap."""

    def test_short_text_single_chunk(self):
        """Text shorter than chunk_size produces a single chunk."""
        text = "Short text."

        chunks = chunk_text(text, chunk_size=2000, overlap=200)

        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0].content, "Short text.")
        self.assertEqual(chunks[0].index, 0)

    def test_long_text_produces_multiple_chunks(self):
        """Text longer than chunk_size is split into overlapping chunks."""
        text = "A" * 5000

        chunks = chunk_text(text, chunk_size=2000, overlap=200)

        self.assertGreater(len(chunks), 1)
        # Each chunk should be <= chunk_size
        for chunk in chunks:
            self.assertLessEqual(len(chunk.content), 2000)

    def test_chunks_have_overlap(self):
        """Adjacent chunks share overlapping text."""
        # Build text where we can verify overlap
        text = "word " * 1000  # 5000 chars

        chunks = chunk_text(text, chunk_size=2000, overlap=200)

        # The end of chunk 0 should overlap with the start of chunk 1
        if len(chunks) > 1:
            end_of_first = chunks[0].content[-200:]
            start_of_second = chunks[1].content[:200]
            self.assertEqual(end_of_first, start_of_second)

    def test_chunks_have_sequential_indices(self):
        """Chunks are numbered sequentially starting from 0."""
        text = "A" * 5000

        chunks = chunk_text(text, chunk_size=2000, overlap=200)

        for i, chunk in enumerate(chunks):
            self.assertEqual(chunk.index, i)

    def test_empty_text_returns_empty_list(self):
        """Empty text returns no chunks."""
        chunks = chunk_text("", chunk_size=2000, overlap=200)

        self.assertEqual(len(chunks), 0)

    def test_whitespace_only_text_returns_empty_list(self):
        """Whitespace-only text returns no chunks."""
        chunks = chunk_text("   \n\n  ", chunk_size=2000, overlap=200)

        self.assertEqual(len(chunks), 0)
