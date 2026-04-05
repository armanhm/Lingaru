import logging

import google.generativeai as genai

from .base import BaseProvider, LLMResponse

logger = logging.getLogger(__name__)


class GeminiProvider(BaseProvider):
    """Google Gemini LLM provider."""

    def __init__(self, api_key: str, model: str):
        super().__init__(api_key, model)
        genai.configure(api_key=api_key)

    def generate(
        self,
        messages: list[dict],
        system_prompt: str,
    ) -> LLMResponse:
        model = genai.GenerativeModel(
            self.model,
            system_instruction=system_prompt,
        )

        # Convert messages to Gemini's content format
        contents = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            contents.append({"role": role, "parts": [msg["content"]]})

        response = model.generate_content(contents)

        tokens_used = 0
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            tokens_used = getattr(response.usage_metadata, "total_token_count", 0)

        logger.info(
            "Gemini response: model=%s, tokens=%d", self.model, tokens_used,
        )

        return LLMResponse(
            content=response.text,
            provider="gemini",
            tokens_used=tokens_used,
        )

    def generate_with_image(
        self,
        messages: list[dict],
        image_data: bytes,
        image_mime_type: str,
        system_prompt: str,
    ) -> LLMResponse:
        """Generate a response from Gemini given an image and optional text.

        Uses Gemini's native multimodal input: sends the image as an inline
        blob alongside any user text.
        """
        model = genai.GenerativeModel(
            self.model,
            system_instruction=system_prompt,
        )

        # Build content parts: image first, then the latest user text
        image_part = {
            "inline_data": {
                "mime_type": image_mime_type,
                "data": image_data,
            }
        }

        # Combine: image + user question (if any)
        user_text = ""
        if messages:
            user_text = messages[-1].get("content", "")

        if user_text:
            contents = [image_part, user_text]
        else:
            contents = [image_part]

        response = model.generate_content(contents)

        tokens_used = 0
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            tokens_used = getattr(response.usage_metadata, "total_token_count", 0)

        logger.info(
            "Gemini vision response: model=%s, tokens=%d", self.model, tokens_used,
        )

        return LLMResponse(
            content=response.text,
            provider="gemini",
            tokens_used=tokens_used,
        )
