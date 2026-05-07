"""`/news` Telegram command — surfaces a real French headline rewritten at
B1-B2, sourced from the RSS pipeline first and falling back to whatever
news/trivia DiscoverCards already exist.

Pipeline alignment with the web app:
  1. Try to grab the freshest unread *news* card from the DB.
  2. If none, fall back to any news or trivia card (legacy path).
  3. Show source attribution + link when available so the learner can
     read the original article.
"""

import logging

from asgiref.sync import sync_to_async
from telegram import Update
from telegram.ext import ContextTypes

from apps.discover.models import DiscoverCard

logger = logging.getLogger(__name__)


def get_random_discover_card():
    """Return a random news or trivia DiscoverCard, or None.

    Prefers fresh news (RSS pipeline) over older content; falls back to
    trivia if no news cards exist. Used by both the bot and the tests.
    """
    news = DiscoverCard.objects.filter(type="news").order_by("-generated_at").first()
    if news is not None:
        return news

    return DiscoverCard.objects.filter(type__in=["news", "trivia"]).order_by("?").first()


def _format_news_card(card) -> str:
    """Format a news-type card for Telegram (Markdown)."""
    content = card.content_json or {}
    parts = [f"*{card.title}*"]

    source_name = content.get("source_name")
    if source_name:
        parts.append(f"_{source_name}_")

    if content.get("article_fr"):
        parts.append(f"\n{content['article_fr']}")
    if content.get("article_en"):
        parts.append(f"\n_{content['article_en']}_")

    # The RSS pipeline saves under `vocabulary`; older synthetic cards used
    # `key_vocabulary`. Read both so we don't break on legacy rows.
    vocab = content.get("vocabulary") or content.get("key_vocabulary") or []
    if vocab:
        vocab_lines = [f"  • {v.get('french', '')} — {v.get('english', '')}" for v in vocab[:5]]
        parts.append("\n*Vocabulaire:*\n" + "\n".join(vocab_lines))

    if card.source_url:
        parts.append(f"\n[Lire l'article original →]({card.source_url})")

    return "\n".join(parts)


def _format_trivia_card(card) -> str:
    """Format a trivia-type card for Telegram (Markdown)."""
    content = card.content_json or {}
    parts = [f"*{card.title}*"]

    if content.get("fact_fr"):
        parts.append(f"\n{content['fact_fr']}")
    if content.get("fact_en"):
        parts.append(f"\n_{content['fact_en']}_")

    return "\n".join(parts)


async def news_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /news command — send the freshest news card we have."""
    card = await sync_to_async(get_random_discover_card)()

    if card is None:
        await update.message.reply_text(
            "No news cards yet — the RSS pipeline runs at 07:00 and 19:00 UTC. "
            "Try again in a bit, or run `python manage.py fetch_news` on the server."
        )
        return

    if card.type == "news":
        text = _format_news_card(card)
    else:
        text = _format_trivia_card(card)

    await update.message.reply_text(
        text,
        parse_mode="Markdown",
        disable_web_page_preview=False,
    )
