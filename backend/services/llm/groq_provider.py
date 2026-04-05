import logging

from groq import Groq

from .base import BaseProvider, LLMResponse

logger = logging.getLogger(__name__)


class GroqProvider(BaseProvider):
    """Groq LLM provider (Llama models)."""

    def __init__(self, api_key: str, model: str):
        super().__init__(api_key, model)
        self.client = Groq(api_key=api_key)

    def generate(
        self,
        messages: list[dict],
        system_prompt: str,
    ) -> LLMResponse:
        # Prepend system message
        all_messages = [{"role": "system", "content": system_prompt}]
        all_messages.extend(messages)

        response = self.client.chat.completions.create(
            model=self.model,
            messages=all_messages,
        )

        content = response.choices[0].message.content
        tokens_used = getattr(response.usage, "total_tokens", 0)

        logger.info(
            "Groq response: model=%s, tokens=%d", self.model, tokens_used,
        )

        return LLMResponse(
            content=content,
            provider="groq",
            tokens_used=tokens_used,
        )
