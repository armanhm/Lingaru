from django.test import TestCase

from services.rag.retriever import cosine_similarity, rank_chunks


class TestCosineSimilarity(TestCase):
    """Test cosine similarity computation."""

    def test_identical_vectors(self):
        """Identical vectors have similarity 1.0."""
        v = [1.0, 0.0, 0.0]
        self.assertAlmostEqual(cosine_similarity(v, v), 1.0, places=5)

    def test_orthogonal_vectors(self):
        """Orthogonal vectors have similarity 0.0."""
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        self.assertAlmostEqual(cosine_similarity(a, b), 0.0, places=5)

    def test_opposite_vectors(self):
        """Opposite vectors have similarity -1.0."""
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        self.assertAlmostEqual(cosine_similarity(a, b), -1.0, places=5)


class TestRankChunks(TestCase):
    """Test chunk ranking by similarity."""

    def test_rank_returns_top_k(self):
        """rank_chunks returns top_k most similar chunks."""
        query_embedding = [1.0, 0.0, 0.0]
        chunks = [
            {"id": 1, "content": "close", "embedding": [0.9, 0.1, 0.0]},
            {"id": 2, "content": "far", "embedding": [0.0, 1.0, 0.0]},
            {"id": 3, "content": "closest", "embedding": [0.95, 0.05, 0.0]},
        ]

        results = rank_chunks(query_embedding, chunks, top_k=2)

        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["id"], 3)  # closest first
        self.assertEqual(results[1]["id"], 1)

    def test_rank_with_empty_chunks(self):
        """Empty chunk list returns empty results."""
        results = rank_chunks([1.0, 0.0], [], top_k=5)
        self.assertEqual(len(results), 0)

    def test_rank_top_k_larger_than_chunks(self):
        """If top_k > len(chunks), return all chunks."""
        query_embedding = [1.0, 0.0]
        chunks = [
            {"id": 1, "content": "a", "embedding": [0.9, 0.1]},
        ]

        results = rank_chunks(query_embedding, chunks, top_k=10)

        self.assertEqual(len(results), 1)
