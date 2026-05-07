import pytest

from services.stt.scoring import calculate_accuracy, generate_feedback, normalize_text


class TestNormalizeText:
    def test_lowercase(self):
        assert normalize_text("Bonjour") == "bonjour"

    def test_strip_punctuation(self):
        assert normalize_text("Bonjour!") == "bonjour"

    def test_preserve_apostrophes(self):
        assert normalize_text("L'homme") == "l'homme"

    def test_collapse_whitespace(self):
        assert normalize_text("Bonjour   le   monde") == "bonjour le monde"

    def test_strip_edges(self):
        assert normalize_text("  Bonjour  ") == "bonjour"

    def test_unicode_normalization(self):
        # Ensure accented chars are preserved
        assert "e\u0301" not in normalize_text("caf\u00e9")
        assert "\u00e9" in normalize_text("caf\u00e9")


class TestCalculateAccuracy:
    def test_perfect_match(self):
        assert calculate_accuracy("Bonjour le monde", "Bonjour le monde") == 1.0

    def test_case_insensitive(self):
        assert calculate_accuracy("Bonjour", "bonjour") == 1.0

    def test_partial_match(self):
        score = calculate_accuracy("Bonjour le monde", "Bonjour monde")
        assert 0.5 <= score <= 0.7  # 2 of 3 words matched

    def test_no_match(self):
        assert calculate_accuracy("Bonjour", "Au revoir") == 0.0

    def test_empty_expected(self):
        assert calculate_accuracy("", "") == 1.0

    def test_empty_expected_nonempty_transcription(self):
        assert calculate_accuracy("", "hello") == 0.0

    def test_empty_transcription(self):
        assert calculate_accuracy("Bonjour", "") == 0.0

    def test_extra_words_in_transcription(self):
        # "Bonjour" is found, so 1/1 = 1.0
        assert calculate_accuracy("Bonjour", "Oui Bonjour monsieur") == 1.0


class TestGenerateFeedback:
    def test_excellent(self):
        feedback = generate_feedback(1.0, "Bonjour", "Bonjour")
        assert "Excellent" in feedback

    def test_good(self):
        feedback = generate_feedback(0.85, "Bonjour le monde", "bonjour monde")
        assert "Good" in feedback

    def test_keep_practicing(self):
        feedback = generate_feedback(0.6, "Bonjour le monde", "bonjour")
        assert "practicing" in feedback

    def test_try_again(self):
        feedback = generate_feedback(0.2, "Bonjour", "au revoir")
        assert "try again" in feedback.lower()
