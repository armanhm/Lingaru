import logging

from django.conf import settings

from apps.documents.models import DocumentChunk
from services.rag.embedder import GeminiEmbedder
from services.rag.retriever import rank_chunks

logger = logging.getLogger(__name__)


def retrieve_context_for_query(user_id: int, query: str) -> str | None:
    """Retrieve relevant document chunks for a user's query.

    Args:
        user_id: The ID of the user whose documents to search.
        query: The user's chat message to find relevant context for.

    Returns:
        Formatted context string, or None if no relevant chunks found.
    """
    # Check if user has any processed documents with chunks
    user_chunks = DocumentChunk.objects.filter(
        document__user_id=user_id,
        document__processed=True,
    ).exclude(embedding=[])

    if not user_chunks.exists():
        return None

    # Generate query embedding
    try:
        embedder = GeminiEmbedder(
            api_key=settings.GEMINI_API_KEY,
            model=getattr(
                settings, "GEMINI_EMBEDDING_MODEL", "models/text-embedding-004",
            ),
        )
        query_embedding = embedder.embed_query(query)
    except Exception as exc:
        logger.error("Failed to embed query for RAG: %s", exc)
        return None

    # Load chunks with embeddings into memory for ranking
    chunk_data = list(
        user_chunks.values("id", "content", "embedding", "document__title")
    )

    # Rank by similarity
    top_k = getattr(settings, "RAG_TOP_K", 5)
    min_similarity = getattr(settings, "RAG_MIN_SIMILARITY", 0.3)

    ranked = rank_chunks(
        query_embedding=query_embedding,
        chunks=chunk_data,
        top_k=top_k,
        min_similarity=min_similarity,
    )

    if not ranked:
        return None

    # Format context string
    context_parts = []
    for i, chunk in enumerate(ranked, 1):
        source = chunk.get("document__title", "Document")
        context_parts.append(
            f"[Excerpt {i} from \"{source}\"]:\n{chunk['content']}"
        )

    context = "\n\n".join(context_parts)
    logger.info(
        "Retrieved %d RAG chunks for user %d (query: %.50s...)",
        len(ranked), user_id, query,
    )
    return context
