from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class LLMResponse:
    content: str
    provider: str
    tokens_used: int


class BaseProvider(ABC):
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    @abstractmethod
    def generate(
        self,
        messages: list[dict],
        system_prompt: str,
    ) -> LLMResponse:
        """Generate a response from the LLM.

        Args:
            messages: List of {"role": "user"|"assistant", "content": "..."} dicts.
            system_prompt: System instruction for the model.

        Returns:
            LLMResponse with the generated content, provider name, and token usage.
        """

    def generate_with_image(
        self,
        messages: list[dict],
        image_data: bytes,
        image_mime_type: str,
        system_prompt: str,
    ) -> LLMResponse:
        """Generate a response from the LLM given an image + text.

        Default implementation raises NotImplementedError.
        Providers that support vision (e.g. Gemini) override this.

        Args:
            messages: List of {"role": "user"|"assistant", "content": "..."} dicts.
            image_data: Raw image bytes (JPEG, PNG, etc.).
            image_mime_type: MIME type of the image (e.g. "image/jpeg").
            system_prompt: System instruction for the model.

        Returns:
            LLMResponse with the generated content, provider name, and token usage.
        """
        raise NotImplementedError(f"{self.__class__.__name__} does not support vision/image input.")
