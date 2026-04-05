import logging

from .base import BaseProvider, LLMResponse

logger = logging.getLogger(__name__)


class ProviderRouter:
    """Routes LLM calls to primary provider, falls back on error."""

    def __init__(self, primary: BaseProvider, fallback: BaseProvider | None = None):
        self.primary = primary
        self.fallback = fallback

    def generate(
        self,
        messages: list[dict],
        system_prompt: str,
    ) -> LLMResponse:
        try:
            return self.primary.generate(messages, system_prompt)
        except Exception as exc:
            if self.fallback is None:
                raise

            logger.warning(
                "Primary provider failed (%s), falling back. Error: %s",
                type(exc).__name__,
                exc,
            )
            return self.fallback.generate(messages, system_prompt)

    def generate_with_image(
        self,
        messages: list[dict],
        image_data: bytes,
        image_mime_type: str,
        system_prompt: str,
    ) -> LLMResponse:
        """Route image+text generation to the primary provider.

        No fallback -- vision is Gemini-only. Raises directly on failure.
        """
        return self.primary.generate_with_image(
            messages=messages,
            image_data=image_data,
            image_mime_type=image_mime_type,
            system_prompt=system_prompt,
        )
