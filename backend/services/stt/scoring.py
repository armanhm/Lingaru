"""Pronunciation accuracy scoring -- compares expected text to transcription."""

import re
import unicodedata


def normalize_text(text: str) -> str:
    """Normalize text for comparison: lowercase, strip punctuation, normalize unicode."""
    text = text.lower().strip()
    # Normalize unicode (e.g., accented characters)
    text = unicodedata.normalize("NFC", text)
    # Remove punctuation except apostrophes (important in French: l'homme, j'ai)
    text = re.sub(r"[^\w\s']", "", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def calculate_accuracy(expected: str, transcription: str) -> float:
    """Calculate word-level accuracy between expected text and transcription.

    Returns a float between 0.0 (no match) and 1.0 (perfect match).
    Uses simple word overlap -- Jaccard similarity on word sets would
    over-count repeated words, so we use ordered comparison.
    """
    expected_words = normalize_text(expected).split()
    transcription_words = normalize_text(transcription).split()

    if not expected_words:
        return 1.0 if not transcription_words else 0.0

    # Count matching words in order (longest common subsequence approach is overkill;
    # simple sequential matching works well for short utterances)
    matches = 0
    t_index = 0
    for e_word in expected_words:
        for i in range(t_index, len(transcription_words)):
            if transcription_words[i] == e_word:
                matches += 1
                t_index = i + 1
                break

    return round(matches / len(expected_words), 2)


def generate_feedback(accuracy: float, expected: str, transcription: str) -> str:
    """Generate human-readable feedback based on accuracy score."""
    if accuracy >= 0.95:
        return "Excellent! Your pronunciation is nearly perfect."
    elif accuracy >= 0.8:
        return (
            f"Good job! Most words were correct. "
            f"Expected: \"{expected}\" — You said: \"{transcription}\""
        )
    elif accuracy >= 0.5:
        return (
            f"Keep practicing! Some words need work. "
            f"Expected: \"{expected}\" — You said: \"{transcription}\""
        )
    else:
        return (
            f"Let's try again. Listen carefully and repeat. "
            f"Expected: \"{expected}\" — You said: \"{transcription}\""
        )
