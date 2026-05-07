import logging

from asgiref.sync import sync_to_async
from telegram import Update
from telegram.ext import (
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from apps.content.models import Vocabulary
from services.stt.scoring import calculate_accuracy, generate_feedback
from services.tts.service import get_or_create_audio

logger = logging.getLogger(__name__)

# Conversation states
WAITING_FOR_ANSWER = 0


async def dictation_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle /dictation — start a dictation exercise."""
    vocab = await sync_to_async(
        lambda: Vocabulary.objects.exclude(example_sentence="").order_by("?").first()
    )()

    if vocab is None:
        await update.message.reply_text(
            "No sentences available for dictation yet. Check back later!"
        )
        return ConversationHandler.END

    sentence = vocab.example_sentence
    clip = await sync_to_async(get_or_create_audio)(text=sentence, language="fr")

    # Store the clip ID and expected text in context for later comparison
    context.user_data["dictation_clip_id"] = clip.id
    context.user_data["dictation_expected"] = sentence

    # Send audio file
    audio_path = clip.audio_file.path
    await update.message.reply_text("Listen to the following sentence and type what you hear:")
    with open(audio_path, "rb") as audio_file:
        await update.message.reply_audio(audio=audio_file)

    return WAITING_FOR_ANSWER


async def dictation_answer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle the user's typed answer for a dictation exercise."""
    user_text = update.message.text.strip()
    expected = context.user_data.get("dictation_expected", "")

    if not expected:
        await update.message.reply_text("Something went wrong. Try /dictation again.")
        return ConversationHandler.END

    accuracy = calculate_accuracy(expected, user_text)
    feedback = generate_feedback(accuracy, expected, user_text)
    is_correct = accuracy >= 0.9

    emoji = "\u2705" if is_correct else "\u274c"
    parts = [
        f"{emoji} **Accuracy: {int(accuracy * 100)}%**",
        f"Expected: _{expected}_",
        f"You wrote: _{user_text}_",
        "",
        feedback,
    ]

    await update.message.reply_text("\n".join(parts), parse_mode="Markdown")

    # Clean up context
    context.user_data.pop("dictation_clip_id", None)
    context.user_data.pop("dictation_expected", None)

    return ConversationHandler.END


async def dictation_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Cancel the dictation exercise."""
    await update.message.reply_text("Dictation cancelled.")
    context.user_data.pop("dictation_clip_id", None)
    context.user_data.pop("dictation_expected", None)
    return ConversationHandler.END


def dictation_conversation_handler() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CommandHandler("dictation", dictation_command)],
        states={
            WAITING_FOR_ANSWER: [
                MessageHandler(
                    filters.TEXT & ~filters.COMMAND,
                    dictation_answer,
                ),
            ],
        },
        fallbacks=[CommandHandler("cancel", dictation_cancel)],
    )
