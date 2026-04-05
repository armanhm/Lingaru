import pytest
from apps.practice.views import answers_match


class TestAnswersMatch:
    # Exact matches
    def test_exact_match(self):
        assert answers_match("réunion", "réunion")

    def test_case_insensitive(self):
        assert answers_match("Réunion", "réunion")
        assert answers_match("BONJOUR", "bonjour")

    # Accent tolerance
    def test_missing_accent_accepted(self):
        assert answers_match("reunion", "réunion")
        assert answers_match("cafe", "café")
        assert answers_match("ou", "où")
        assert answers_match("etudiant", "étudiant")

    def test_wrong_accent_accepted(self):
        assert answers_match("réunion", "reunion")

    # Article stripping
    def test_article_la_stripped(self):
        assert answers_match("la réunion", "réunion")
        assert answers_match("la reunion", "réunion")

    def test_article_le_stripped(self):
        assert answers_match("le chat", "chat")

    def test_article_les_stripped(self):
        assert answers_match("les chats", "chats")

    def test_article_elision_stripped(self):
        assert answers_match("l'eau", "eau")

    def test_article_un_stripped(self):
        assert answers_match("un livre", "livre")

    def test_article_une_stripped(self):
        assert answers_match("une table", "table")

    # Single-char typo tolerance (word ≥ 4 chars)
    def test_one_char_typo_accepted(self):
        assert answers_match("reunon", "réunion")    # missing 'i'
        assert answers_match("bojour", "bonjour")    # missing 'n'
        assert answers_match("bonjoors", "bonjours") # extra char

    def test_two_char_typo_rejected(self):
        assert not answers_match("bonjouur", "réunion")

    # Short answers are not fuzzy-matched
    def test_short_wrong_answer_rejected(self):
        assert not answers_match("ou", "et")   # both 2 chars, different

    # Completely wrong answers
    def test_wrong_answer_rejected(self):
        assert not answers_match("chat", "chien")
        assert not answers_match("maison", "voiture")
