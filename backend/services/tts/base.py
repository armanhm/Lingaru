from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class TTSResult:
    audio_path: str
    provider: str


class BaseTTSProvider(ABC):
    @abstractmethod
    def synthesize(self, text: str, language: str = "fr") -> TTSResult:
        """Generate an audio file from text.

        Args:
            text: The text to synthesize.
            language: BCP-47 language code (default "fr").

        Returns:
            TTSResult with the path to the generated audio file and provider name.
        """
