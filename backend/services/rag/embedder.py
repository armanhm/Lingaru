import logging

from google import genai
from google.genai import types

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
        self._client = genai.Client(api_key=api_key)

    def embed(self, text: str) -> list[float]:
        result = self._client.models.embed_content(
            model=self.model,
            contents=text,
            config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
        )
        embedding = result.embeddings[0].values
        logger.debug("Generated embedding: %d dimensions", len(embedding))
        return list(embedding)

    def embed_query(self, text: str) -> list[float]:
        result = self._client.models.embed_content(
            model=self.model,
            contents=text,
            config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
        )
        return list(result.embeddings[0].values)

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        result = self._client.models.embed_content(
            model=self.model,
            contents=texts,
            config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
        )
        embeddings = [list(e.values) for e in result.embeddings]
        logger.info("Generated %d embeddings in batch", len(embeddings))
        return embeddings
