import io
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

from apps.bot.handlers.start import get_or_create_telegram_user
from apps.assistant.models import Conversation, ImageQuery, Message
from services.llm.factory import create_llm_router
from services.llm.prompts import SYSTEM_PROMPTS
from services.stt.groq_whisper import GroqWhisperProvider
from services.tts.service import get_or_create_audio

logger = logging.getLogger(__name__)

# Conversation states
CHATTING = 0


def _create_conversation(user):
    """Create a new Conversation (sync ORM call)."""
    return Conversation.objects.create(
        user=user,
        title="Telegram chat",
        context="telegram",
    )


def _get_conversation(conversation_id):
    """Fetch a Conversation by pk (sync ORM call)."""
    return Conversation.objects.get(pk=conversation_id)


def _save_user_message(conversation, text):
    """Save a user message to the conversation (sync ORM call)."""
    Message.objects.create(
        conversation=conversation,
        role="user",
        content=text,
    )


def _save_assistant_message(conversation, content, provider, tokens_used):
    """Save an assistant message to the conversation (sync ORM call)."""
    Message.objects.create(
        conversation=conversation,
        role="assistant",
        content=content,
        provider=provider,
        tokens_used=tokens_used,
    )


def _get_message_history(conversation):
    """Build the message history list for the LLM (sync ORM call)."""
    prior_messages = Message.objects.filter(
        conversation=conversation,
    ).order_by("created_at")
    return [
        {"role": msg.role, "content": msg.content}
        for msg in prior_messages
    ]


def _save_image_query(user, conversation, image_data, caption, ai_response):
    """Save an ImageQuery record (sync ORM call)."""
    from django.core.files.base import ContentFile

    image_file = ContentFile(image_data, name="telegram_photo.jpg")
    return ImageQuery.objects.create(
        user=user,
        conversation=conversation,
        image_file=image_file,
        question=caption or "",
        ai_response=ai_response,
    )


async def _download_telegram_file(file_obj):
    """Download a file from Telegram and return (bytes, mime_type)."""
    byte_array = await file_obj.download_as_bytearray()
    return bytes(byte_array), "image/jpeg"


async def chat_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle /chat — start an AI conversation."""
    tg_user = update.effective_user
    user, _ = await sync_to_async(get_or_create_telegram_user)(
        telegram_id=tg_user.id,
        first_name=tg_user.first_name or "",
        username=tg_user.username,
    )

    conversation = await sync_to_async(_create_conversation)(user)

    context.user_data["conversation_id"] = conversation.id
    context.user_data["user_id"] = user.id

    await update.message.reply_text(
        "AI chat started! Send me messages in French and I'll help you practice.\n"
        "You can also send photos or voice messages!\n"
        "Use /endchat to end the conversation."
    )

    return CHATTING


async def chat_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle a user message during an AI chat session."""
    user_text = update.message.text
    conversation_id = context.user_data.get("conversation_id")

    if not conversation_id:
        await update.message.reply_text(
            "No active chat. Use /chat to start one."
        )
        return ConversationHandler.END

    try:
        conversation = await sync_to_async(_get_conversation)(conversation_id)
    except Conversation.DoesNotExist:
        await update.message.reply_text("Chat session lost. Use /chat to start a new one.")
        return ConversationHandler.END

    # Save user message
    await sync_to_async(_save_user_message)(conversation, user_text)

    # Build message history
    messages = await sync_to_async(_get_message_history)(conversation)

    # Call LLM
    try:
        router = create_llm_router()
        llm_response = router.generate(
            messages=messages,
            system_prompt=SYSTEM_PROMPTS["conversation"],
        )
    except Exception as exc:
        logger.error("LLM call failed in Telegram chat: %s", exc)
        await update.message.reply_text(
            "Sorry, the AI assistant is temporarily unavailable. "
            "Please try again in a moment."
        )
        return CHATTING

    # Save assistant message
    await sync_to_async(_save_assistant_message)(
        conversation, llm_response.content,
        llm_response.provider, llm_response.tokens_used,
    )

    await update.message.reply_text(llm_response.content)
    return CHATTING


async def chat_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle a photo message during an AI chat session -- image query."""
    conversation_id = context.user_data.get("conversation_id")

    if not conversation_id:
        await update.message.reply_text("No active chat. Use /chat to start one.")
        return ConversationHandler.END

    try:
        conversation = await sync_to_async(_get_conversation)(conversation_id)
    except Conversation.DoesNotExist:
        await update.message.reply_text("Chat session lost. Use /chat to start a new one.")
        return ConversationHandler.END

    await update.message.reply_text("Analyzing your image...")

    # Download the largest photo
    photo = update.message.photo[-1]
    file_obj = await photo.get_file()
    image_data, mime_type = await _download_telegram_file(file_obj)

    caption = update.message.caption or ""
    messages = []
    if caption:
        messages.append({"role": "user", "content": caption})

    try:
        router = create_llm_router()
        llm_response = router.generate_with_image(
            messages=messages,
            image_data=image_data,
            image_mime_type=mime_type,
            system_prompt=SYSTEM_PROMPTS["image_query"],
        )
    except Exception as exc:
        logger.error("Vision LLM failed in Telegram: %s", exc)
        await update.message.reply_text(
            "Sorry, image analysis is temporarily unavailable."
        )
        return CHATTING

    # Save records
    from apps.users.models import User

    user = await sync_to_async(User.objects.get)(pk=context.user_data.get("user_id"))
    await sync_to_async(_save_image_query)(
        user, conversation, image_data, caption, llm_response.content,
    )

    content_label = f"[Image] {caption}" if caption else "[Image uploaded]"
    await sync_to_async(_save_user_message)(conversation, content_label)
    await sync_to_async(_save_assistant_message)(
        conversation, llm_response.content,
        llm_response.provider, llm_response.tokens_used,
    )

    await update.message.reply_text(llm_response.content)
    return CHATTING


async def chat_voice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle a voice message during an AI chat session -- STT + LLM + TTS."""
    conversation_id = context.user_data.get("conversation_id")

    if not conversation_id:
        await update.message.reply_text("No active chat. Use /chat to start one.")
        return ConversationHandler.END

    try:
        conversation = await sync_to_async(_get_conversation)(conversation_id)
    except Conversation.DoesNotExist:
        await update.message.reply_text("Chat session lost. Use /chat to start a new one.")
        return ConversationHandler.END

    # Download voice file
    voice = update.message.voice
    file_obj = await voice.get_file()
    audio_bytes = await file_obj.download_as_bytearray()

    # STT: transcribe
    try:
        stt = GroqWhisperProvider()
        audio_io = io.BytesIO(bytes(audio_bytes))
        audio_io.name = "voice.ogg"
        stt_result = stt.transcribe(audio_file=audio_io, language="fr")
    except Exception as exc:
        logger.error("STT failed in Telegram voice chat: %s", exc)
        await update.message.reply_text(
            "Sorry, I couldn't understand the audio. Please try again."
        )
        return CHATTING

    user_text = stt_result.transcription
    await update.message.reply_text(f'I heard: "{user_text}"')

    # Save user message and build history
    await sync_to_async(_save_user_message)(conversation, user_text)
    messages = await sync_to_async(_get_message_history)(conversation)

    # LLM: generate response
    try:
        router = create_llm_router()
        llm_response = router.generate(
            messages=messages,
            system_prompt=SYSTEM_PROMPTS["conversation"],
        )
    except Exception as exc:
        logger.error("LLM failed in Telegram voice chat: %s", exc)
        await update.message.reply_text(
            "Sorry, the AI assistant is temporarily unavailable."
        )
        return CHATTING

    await sync_to_async(_save_assistant_message)(
        conversation, llm_response.content,
        llm_response.provider, llm_response.tokens_used,
    )

    # TTS: generate audio response
    try:
        clip = await sync_to_async(get_or_create_audio)(
            text=llm_response.content, language="fr",
        )
        with open(clip.audio_file.path, "rb") as audio_file:
            await update.message.reply_voice(voice=audio_file)
    except Exception as exc:
        logger.warning("TTS failed in Telegram voice chat: %s", exc)

    # Always send text too
    await update.message.reply_text(llm_response.content)
    return CHATTING


async def chat_end(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle /endchat — end the AI conversation."""
    context.user_data.pop("conversation_id", None)
    context.user_data.pop("user_id", None)
    await update.message.reply_text(
        "Chat ended. Use /chat to start a new conversation!"
    )
    return ConversationHandler.END


def chat_conversation_handler() -> ConversationHandler:
    """Build the ConversationHandler for the /chat flow."""
    return ConversationHandler(
        entry_points=[CommandHandler("chat", chat_start)],
        states={
            CHATTING: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, chat_message),
                MessageHandler(filters.PHOTO, chat_photo),
                MessageHandler(filters.VOICE, chat_voice),
            ],
        },
        fallbacks=[CommandHandler("endchat", chat_end)],
    )
