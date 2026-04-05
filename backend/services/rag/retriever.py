import logging
import math

logger = logging.getLogger(__name__)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors.

    Uses pure math (no numpy dependency for this function).

    Args:
        a: First vector.
        b: Second vector.

    Returns:
        Cosine similarity in range [-1, 1].
    """
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return dot / (norm_a * norm_b)


def rank_chunks(
    query_embedding: list[float],
    chunks: list[dict],
    top_k: int = 5,
    min_similarity: float = 0.3,
) -> list[dict]:
    """Rank chunks by cosine similarity to the query embedding.

    Args:
        query_embedding: The embedding of the search query.
        chunks: List of dicts with "id", "content", "embedding" keys.
        top_k: Maximum number of chunks to return.
        min_similarity: Minimum similarity threshold.

    Returns:
        Top-K chunks sorted by descending similarity, each with added
        "similarity" key.
    """
    if not chunks:
        return []

    scored = []
    for chunk in chunks:
        sim = cosine_similarity(query_embedding, chunk["embedding"])
        if sim >= min_similarity:
            scored.append({**chunk, "similarity": sim})

    scored.sort(key=lambda x: x["similarity"], reverse=True)

    results = scored[:top_k]
    logger.info(
        "Ranked %d chunks, returning top %d (min_sim=%.2f)",
        len(chunks), len(results), min_similarity,
    )
    return results
