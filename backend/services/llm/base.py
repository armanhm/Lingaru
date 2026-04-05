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
