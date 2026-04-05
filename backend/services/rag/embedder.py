import logging

import google.generativeai as genai

logger = logging.getLogger(__name__)

DEFAULT_EMBEDDING_MODEL = "models/text-embedding-004"


class GeminiEmbedder:
    """Generate text embeddings using Gemini's embedding API."""

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_EMBEDDING_MODEL,
    ):
        self.model = model
        genai.configure(api_key=api_key)

    def embed(self, text: str) -> list[float]:
        """Generate an embedding for a single text.

        Args:
            text: The text to embed.

        Returns:
            List of floats (768-dimensional vector).
        """
        result = genai.embed_content(
            model=self.model,
            content=text,
            task_type="retrieval_document",
        )
        embedding = result["embedding"]
        logger.debug("Generated embedding: %d dimensions", len(embedding))
        return embedding

    def embed_query(self, text: str) -> list[float]:
        """Generate an embedding for a search query.

        Uses task_type="retrieval_query" for better retrieval performance.

        Args:
            text: The query text to embed.

        Returns:
            List of floats (768-dimensional vector).
        """
        result = genai.embed_content(
            model=self.model,
            content=text,
            task_type="retrieval_query",
        )
        return result["embedding"]

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts in one API call.

        Args:
            texts: List of texts to embed.

        Returns:
            List of embeddings (each a list of floats).
        """
        result = genai.embed_content(
            model=self.model,
            content=texts,
            task_type="retrieval_document",
        )
        embeddings = result["embedding"]
        logger.info("Generated %d embeddings in batch", len(embeddings))
        return embeddings
