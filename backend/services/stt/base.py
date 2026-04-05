from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class STTResult:
    transcription: str
    provider: str
    language: str


class BaseSTTProvider(ABC):
    @abstractmethod
    def transcribe(self, audio_file, language: str = "fr") -> STTResult:
        """Transcribe an audio file to text.

        Args:
            audio_file: A file-like object containing audio data.
            language: BCP-47 language code hint.

        Returns:
            STTResult with the transcription, provider name, and detected language.
        """
