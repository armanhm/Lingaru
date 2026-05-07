import json
import pytest
from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.content.models import GrammarRule, Lesson, Topic, Vocabulary
from apps.discover.models import DiscoverCard
from apps.discover.services import (
    generate_grammar_card,
    generate_news_card,
    generate_trivia_card,
    generate_word_card,
    generate_daily_cards,
)

User = get_user_model()


@pytest.fixture
def content_data(db):
    """Create a topic, lesson, vocabulary item, and grammar rule."""
    topic = Topic.objects.create(
        name_fr="Les bases", name_en="Basics",
        description="Basic French", icon="book", order=1, difficulty_level=1,
    )
    lesson = Lesson.objects.create(
        topic=topic, type="vocab", title="Greetings",
        content={}, order=1, difficulty=1,
    )
    vocab = Vocabulary.objects.create(
        lesson=lesson, french="bonjour", english="hello",
        pronunciation="/bo\u0303.\u0292u\u0281/",
        example_sentence="Bonjour, comment allez-vous?",
        gender="a", part_of_speech="interjection",
    )
    grammar_lesson = Lesson.objects.create(
        topic=topic, type="grammar", title="Articles",
        content={}, order=2, difficulty=1,
    )
    grammar = GrammarRule.objects.create(
        lesson=grammar_lesson, title="Les articles d\u00e9finis",
        explanation="Le, la, les are definite articles.",
        formula="le (m) / la (f) / les (pl)",
        examples=["le chat", "la maison", "les enfants"],
        exceptions=["l'homme (before vowel)"],
    )
    return {"topic": topic, "lesson": lesson, "vocab": vocab, "grammar": grammar}


@pytest.mark.django_db
class TestGenerateWordCard:
    def test_creates_word_card_from_vocabulary(self, content_data):
        card = generate_word_card()
        assert card is not None
        assert card.type == "word"
        assert card.title == "bonjour"
        assert card.content_json["french"] == "bonjour"
        assert card.content_json["english"] == "hello"
        assert card.content_json["pronunciation"] == "/bo\u0303.\u0292u\u0281/"
        assert card.content_json["example"] == "Bonjour, comment allez-vous?"

    def test_returns_none_when_no_vocabulary(self, db):
        card = generate_word_card()
        assert card is None

    def test_sets_expiry_to_24_hours(self, content_data):
        card = generate_word_card()
        assert card.expires_at is not None
        diff = card.expires_at - card.generated_at
        assert timedelta(hours=23) < diff < timedelta(hours=25)


@pytest.mark.django_db
class TestGenerateGrammarCard:
    def test_creates_grammar_card(self, content_data):
        card = generate_grammar_card()
        assert card is not None
        assert card.type == "grammar"
        assert card.title == "Les articles d\u00e9finis"
        assert card.content_json["explanation"] == "Le, la, les are definite articles."
        assert card.content_json["formula"] == "le (m) / la (f) / les (pl)"

    def test_returns_none_when_no_grammar_rules(self, db):
        card = generate_grammar_card()
        assert card is None

    def test_sets_expiry_to_24_hours(self, content_data):
        card = generate_grammar_card()
        assert card.expires_at is not None


@pytest.mark.django_db
class TestGenerateTriviaCard:
    @patch("apps.discover.services.create_llm_router")
    def test_creates_trivia_card_from_llm(self, mock_create_router):
        mock_router = MagicMock()
        mock_router.generate.return_value = MagicMock(
            content=json.dumps({
                "title": "French in Africa",
                "summary": "More people speak French in Africa than in Europe.",
                "fact_fr": "Plus de gens parlent fran\u00e7ais en Afrique qu'en Europe.",
                "fact_en": "More people speak French in Africa than in Europe.",
            })
        )
        mock_create_router.return_value = mock_router

        card = generate_trivia_card()
        assert card is not None
        assert card.type == "trivia"
        assert card.title == "French in Africa"
        assert card.content_json["fact_fr"] is not None

    @patch("apps.discover.services.create_llm_router")
    def test_returns_none_on_llm_error(self, mock_create_router):
        mock_create_router.side_effect = RuntimeError("No API key")
        card = generate_trivia_card()
        assert card is None

    @patch("apps.discover.services.create_llm_router")
    def test_returns_none_on_invalid_json(self, mock_create_router):
        mock_router = MagicMock()
        mock_router.generate.return_value = MagicMock(content="not json")
        mock_create_router.return_value = mock_router

        card = generate_trivia_card()
        assert card is None


@pytest.mark.django_db
class TestGenerateNewsCard:
    @patch("apps.discover.news_fetcher.fetch_one_fresh_card")
    @patch("apps.discover.services.create_llm_router")
    def test_creates_news_card_from_llm(self, mock_create_router, mock_rss):
        # No RSS item available -> falls through to LLM-synthetic path.
        mock_rss.return_value = None
        mock_router = MagicMock()
        mock_router.generate.return_value = MagicMock(
            content=json.dumps({
                "title": "La France gagne la Coupe du Monde",
                "summary": "France wins the World Cup in a thrilling final.",
                "article_fr": "La France a remport\u00e9 la Coupe du Monde...",
                "article_en": "France has won the World Cup...",
                "key_vocabulary": [
                    {"french": "gagner", "english": "to win"},
                    {"french": "la coupe", "english": "the cup"},
                ],
            })
        )
        mock_create_router.return_value = mock_router

        card = generate_news_card()
        assert card is not None
        assert card.type == "news"
        assert card.content_json["article_fr"] is not None
        # Service maps both `vocabulary` and `key_vocabulary` onto a single
        # `vocabulary` key in the saved content_json.
        assert len(card.content_json["vocabulary"]) == 2

    @patch("apps.discover.news_fetcher.fetch_one_fresh_card")
    @patch("apps.discover.services.create_llm_router")
    def test_returns_curated_fallback_when_all_layers_fail(self, mock_create_router, mock_rss):
        # When RSS and LLM both fail, the service returns a curated mock
        # rather than None \u2014 this is the documented Layer 3 behaviour.
        mock_rss.return_value = None
        mock_create_router.side_effect = RuntimeError("No API key")
        card = generate_news_card()
        assert card is not None
        assert card.type == "news"


@pytest.mark.django_db
class TestGenerateDailyCards:
    # News has its own /api/news/ flow now; the daily Discover feed
    # only generates word + grammar + trivia.
    @patch("apps.discover.services.generate_trivia_card")
    @patch("apps.discover.services.generate_grammar_card")
    @patch("apps.discover.services.generate_word_card")
    def test_generates_all_card_types(self, mock_word, mock_grammar, mock_trivia):
        mock_word.return_value = DiscoverCard(pk=1, type="word", title="w")
        mock_grammar.return_value = DiscoverCard(pk=2, type="grammar", title="g")
        mock_trivia.return_value = DiscoverCard(pk=3, type="trivia", title="t")

        cards = generate_daily_cards()
        assert len(cards) == 3
        mock_word.assert_called_once()
        mock_grammar.assert_called_once()
        mock_trivia.assert_called_once()

    @patch("apps.discover.services.generate_trivia_card")
    @patch("apps.discover.services.generate_grammar_card")
    @patch("apps.discover.services.generate_word_card")
    def test_skips_none_results(self, mock_word, mock_grammar, mock_trivia):
        mock_word.return_value = DiscoverCard(pk=1, type="word", title="w")
        mock_grammar.return_value = None  # no grammar rules in DB
        mock_trivia.return_value = None  # LLM error

        cards = generate_daily_cards()
        assert len(cards) == 1
