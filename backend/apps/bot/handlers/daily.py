import logging

from asgiref.sync import sync_to_async
from telegram import Update
from telegram.ext import ContextTypes

from apps.progress.services import get_due_cards
from apps.users.models import User

logger = logging.getLogger(__name__)


def _get_user_by_telegram_id(telegram_id: int):
    """Look up a User by telegram_id. Returns None if not found."""
    try:
        return User.objects.get(telegram_id=telegram_id)
    except User.DoesNotExist:
        return None


def _get_due_card_list(user, limit: int = 10):
    """Return a list of due SRS cards (evaluated queryset)."""
    return list(get_due_cards(user, limit=limit))


async def daily_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /daily — send the user's due SRS review cards."""
    telegram_id = update.effective_user.id

    user = await sync_to_async(_get_user_by_telegram_id)(telegram_id)

    if user is None:
        await update.message.reply_text("You haven't linked your account yet. Use /start first.")
        return

    cards = await sync_to_async(_get_due_card_list)(user)

    if not cards:
        await update.message.reply_text("No cards due for review today. You're all caught up!")
        return

    lines = [f"You have {len(cards)} card(s) due for review:\n"]
    for i, card in enumerate(cards, 1):
        lines.append(f"{i}. **{card.vocabulary.french}** — {card.vocabulary.english}")

    lines.append("\nVisit the app to start your review session.")

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
