from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.bot.handlers.news import get_random_discover_card, news_command
from apps.discover.models import DiscoverCard

User = get_user_model()


@pytest.fixture
def discover_cards(db):
    now = timezone.now()
    news = DiscoverCard.objects.create(
        type="news",
        title="Les Jeux Olympiques",
        summary="Big sports event in French",
        content_json={
            "article_fr": "Les Jeux Olympiques de 2028 auront lieu a Los Angeles.",
            "article_en": "The 2028 Olympics will take place in Los Angeles.",
            "key_vocabulary": [{"french": "les jeux", "english": "the games"}],
        },
        generated_at=now,
    )
    trivia = DiscoverCard.objects.create(
        type="trivia",
        title="French Tongue Twister",
        summary="A fun fact about French",
        content_json={
            "fact_fr": "Les chaussettes de l'archiduchesse sont-elles seches?",
            "fact_en": "Are the archduchess's socks dry? — a famous French tongue twister.",
        },
        generated_at=now,
    )
    word = DiscoverCard.objects.create(
        type="word",
        title="Bonjour",
        content_json={"french": "bonjour", "english": "hello"},
        generated_at=now,
    )
    return {"news": news, "trivia": trivia, "word": word}


@pytest.mark.django_db
class TestGetRandomDiscoverCard:
    def test_prefers_news_over_trivia(self, discover_cards):
        card = get_random_discover_card()
        assert card is not None
        # When both news and trivia exist, news always wins.
        assert card.type == "news"

    def test_falls_back_to_trivia_when_no_news(self, db):
        DiscoverCard.objects.create(
            type="trivia",
            title="Trivia only",
            content_json={"fact_fr": "x", "fact_en": "y"},
        )
        card = get_random_discover_card()
        assert card is not None
        assert card.type == "trivia"

    def test_returns_none_when_no_matching_cards(self, db):
        # Only word cards exist
        DiscoverCard.objects.create(
            type="word",
            title="Bonjour",
            content_json={},
        )
        card = get_random_discover_card()
        assert card is None

    def test_returns_none_when_empty(self, db):
        card = get_random_discover_card()
        assert card is None


@pytest.fixture
def tg_update():
    mock = AsyncMock()
    mock.message = AsyncMock()
    mock.message.reply_text = AsyncMock()
    return mock


@pytest.fixture
def tg_context():
    return MagicMock()


@pytest.mark.django_db
class TestNewsCommand:
    @pytest.mark.asyncio
    @patch("apps.bot.handlers.news.get_random_discover_card")
    async def test_sends_news_card(self, mock_get_card, tg_update, tg_context):
        mock_card = MagicMock()
        mock_card.type = "news"
        mock_card.title = "Les Jeux Olympiques"
        mock_card.summary = "Big sports event"
        mock_card.content_json = {
            "article_fr": "Les Jeux Olympiques de 2028...",
            "article_en": "The 2028 Olympics...",
            "key_vocabulary": [{"french": "les jeux", "english": "the games"}],
        }
        mock_get_card.return_value = mock_card

        await news_command(tg_update, tg_context)

        tg_update.message.reply_text.assert_called_once()
        text = tg_update.message.reply_text.call_args[0][0]
        assert "Les Jeux Olympiques" in text
        assert "Les Jeux Olympiques de 2028" in text

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.news.get_random_discover_card")
    async def test_sends_trivia_card(self, mock_get_card, tg_update, tg_context):
        mock_card = MagicMock()
        mock_card.type = "trivia"
        mock_card.title = "French Fun Fact"
        mock_card.summary = "Interesting fact"
        mock_card.content_json = {
            "fact_fr": "Le francais est parle dans 29 pays.",
            "fact_en": "French is spoken in 29 countries.",
        }
        mock_get_card.return_value = mock_card

        await news_command(tg_update, tg_context)

        tg_update.message.reply_text.assert_called_once()
        text = tg_update.message.reply_text.call_args[0][0]
        assert "French Fun Fact" in text

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.news.get_random_discover_card")
    async def test_handles_no_cards(self, mock_get_card, tg_update, tg_context):
        mock_get_card.return_value = None

        await news_command(tg_update, tg_context)

        tg_update.message.reply_text.assert_called_once()
        text = tg_update.message.reply_text.call_args[0][0]
        assert "No news" in text or "no discover" in text.lower() or "not available" in text.lower()

    @pytest.mark.asyncio
    @patch("apps.bot.handlers.news.get_random_discover_card")
    async def test_renders_rss_pipeline_card_with_source(
        self,
        mock_get_card,
        tg_update,
        tg_context,
    ):
        # Cards saved by the RSS pipeline put vocab under `vocabulary`
        # and set source_url + source_name.
        mock_card = MagicMock()
        mock_card.type = "news"
        mock_card.title = "L'inflation ralentit en France"
        mock_card.source_url = "https://www.lemonde.fr/article/x"
        mock_card.content_json = {
            "article_fr": "Selon l'INSEE, l'inflation a baissé...",
            "article_en": "According to INSEE, inflation has dropped...",
            "vocabulary": [
                {"french": "l'inflation", "english": "inflation"},
                {"french": "ralentir", "english": "to slow down"},
            ],
            "source_name": "Le Monde · Économie",
        }
        mock_get_card.return_value = mock_card

        await news_command(tg_update, tg_context)

        text = tg_update.message.reply_text.call_args[0][0]
        assert "L'inflation ralentit en France" in text
        assert "Le Monde · Économie" in text
        assert "l'inflation" in text
        assert "Lire l'article original" in text
        assert "https://www.lemonde.fr/article/x" in text
