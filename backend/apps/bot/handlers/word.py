import logging

from asgiref.sync import sync_to_async
from telegram import Update
from telegram.ext import ContextTypes

from apps.content.models import Vocabulary
from services.tts.service import get_or_create_audio

logger = logging.getLogger(__name__)


def get_random_vocabulary():
    """Return a random Vocabulary item, or None if the table is empty."""
    item = Vocabulary.objects.order_by("?").first()
    return item


async def word_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /word command — send a random vocabulary item."""
    vocab = await sync_to_async(get_random_vocabulary)()

    if vocab is None:
        await update.message.reply_text("No vocabulary items available yet. Check back later!")
        return

    parts = [
        f"**{vocab.french}** — {vocab.english}",
    ]
    if vocab.pronunciation:
        parts.append(f"Pronunciation: {vocab.pronunciation}")
    if vocab.part_of_speech:
        parts.append(f"Part of speech: {vocab.part_of_speech}")
    if vocab.gender and vocab.gender != "a":
        gender_map = {"m": "masculine", "f": "feminine", "n": "neutral"}
        parts.append(f"Gender: {gender_map.get(vocab.gender, vocab.gender)}")
    if vocab.example_sentence:
        parts.append(f"\nExample: _{vocab.example_sentence}_")

    message = "\n".join(parts)
    await update.message.reply_text(message, parse_mode="Markdown")

    # Send audio of the French word (TTS + ORM both sync — wrap them)
    try:
        clip = await sync_to_async(get_or_create_audio)(text=vocab.french, language="fr")
        audio_path = clip.audio_file.path
        with open(audio_path, "rb") as audio_file:
            await update.message.reply_audio(audio=audio_file)
    except Exception as exc:
        logger.warning("Failed to send audio for /word: %s", exc)
