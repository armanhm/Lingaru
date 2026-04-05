import logging

from django.contrib.auth import get_user_model
from telegram import Update
from telegram.ext import ContextTypes

logger = logging.getLogger(__name__)

User = get_user_model()


def get_or_create_telegram_user(
    telegram_id: int,
    first_name: str,
    username: str | None,
) -> tuple:
    """Find or create a Django user linked to a Telegram account.

    Returns (user, created) tuple.
    """
    try:
        user = User.objects.get(telegram_id=telegram_id)
        return user, False
    except User.DoesNotExist:
        pass

    # Build a unique username
    base_username = f"tg_{telegram_id}"
    final_username = base_username

    if User.objects.filter(username=base_username).exists():
        import uuid
        suffix = uuid.uuid4().hex[:6]
        final_username = f"{base_username}_{suffix}"

    user = User(
        username=final_username,
        email=f"{final_username}@telegram.local",
        telegram_id=telegram_id,
        first_name=first_name,
    )
    user.set_unusable_password()
    user.save()

    return user, True


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /start command — register or link Telegram account."""
    tg_user = update.effective_user
    user, created = get_or_create_telegram_user(
        telegram_id=tg_user.id,
        first_name=tg_user.first_name or "",
        username=tg_user.username,
    )

    if created:
        await update.message.reply_text(
            f"Bienvenue, {user.first_name}! Your Lingaru account has been created.\n"
            f"Use /help to see available commands."
        )
        logger.info("New user created via Telegram: %s (tg_id=%d)", user.username, tg_user.id)
    else:
        await update.message.reply_text(
            f"Welcome back, {user.first_name}! You are already registered.\n"
            f"Use /help to see available commands."
        )
        logger.info("Returning user via Telegram: %s (tg_id=%d)", user.username, tg_user.id)
