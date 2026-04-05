import logging

from django.conf import settings
from telegram.ext import ApplicationBuilder, CommandHandler

from apps.bot.handlers.start import start_command
from apps.bot.handlers.help import help_command
from apps.bot.handlers.word import word_command
from apps.bot.handlers.stats import stats_command
from apps.bot.handlers.quiz import quiz_conversation_handler
from apps.bot.handlers.chat import chat_conversation_handler
from apps.bot.handlers.dictation import dictation_conversation_handler

logger = logging.getLogger(__name__)


def create_bot_application():
    """Build and configure the Telegram bot application."""
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        raise RuntimeError(
            "TELEGRAM_BOT_TOKEN is not set. "
            "Add it to your .env file or environment variables."
        )

    application = ApplicationBuilder().token(token).build()

    # Register command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("word", word_command))
    application.add_handler(CommandHandler("stats", stats_command))
    application.add_handler(quiz_conversation_handler())
    application.add_handler(chat_conversation_handler())
    application.add_handler(dictation_conversation_handler())

    logger.info("Telegram bot application configured successfully.")
    return application
