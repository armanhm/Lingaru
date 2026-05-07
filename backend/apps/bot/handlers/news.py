import logging

from telegram import Update
from telegram.ext import ContextTypes

from apps.discover.models import DiscoverCard

logger = logging.getLogger(__name__)


def get_random_discover_card():
    """Return a random news or trivia DiscoverCard, or None."""
    card = (
        DiscoverCard.objects.filter(
            type__in=["news", "trivia"],
        )
        .order_by("?")
        .first()
    )
    return card


def _format_news_card(card) -> str:
    """Format a news-type card for Telegram."""
    content = card.content_json
    parts = [f"*{card.title}*"]

    if content.get("article_fr"):
        parts.append(f"\n{content['article_fr']}")
    if content.get("article_en"):
        parts.append(f"\n_{content['article_en']}_")
    if content.get("key_vocabulary"):
        vocab_lines = [f"  {v['french']} — {v['english']}" for v in content["key_vocabulary"][:5]]
        parts.append("\nVocabulary:\n" + "\n".join(vocab_lines))

    return "\n".join(parts)


def _format_trivia_card(card) -> str:
    """Format a trivia-type card for Telegram."""
    content = card.content_json
    parts = [f"*{card.title}*"]

    if content.get("fact_fr"):
        parts.append(f"\n{content['fact_fr']}")
    if content.get("fact_en"):
        parts.append(f"\n_{content['fact_en']}_")

    return "\n".join(parts)


async def news_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /news command — send a random news or trivia card."""
    card = get_random_discover_card()

    if card is None:
        await update.message.reply_text(
            "No news or trivia cards available yet. "
            "Try again after the daily feed has been generated!"
        )
        return

    if card.type == "news":
        text = _format_news_card(card)
    else:
        text = _format_trivia_card(card)

    await update.message.reply_text(text, parse_mode="Markdown")
