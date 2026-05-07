from telegram import Update
from telegram.ext import ContextTypes

HELP_TEXT = (
    "Lingaru Bot — French Learning\n\n"
    "Available commands:\n"
    "/start — Register or link your account\n"
    "/quiz [topic] — Start a quick quiz\n"
    "/word — Random vocabulary word\n"
    "/news — Real French headline rewritten at B1-B2\n"
    "/daily — Your spaced-repetition review summary\n"
    "/chat — Talk to the AI tutor (text, voice, photo)\n"
    "/dictation — Listen-and-type drill\n"
    "/agents — Specialist assistants (correct, conjugate, translate…)\n"
    "/stats — Your quiz statistics, XP, streak\n"
    "/upload — Document management info\n"
    "/help — Show this help message\n"
)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /help command — list available commands."""
    await update.message.reply_text(HELP_TEXT)
