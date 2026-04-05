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
from apps.assistant.models import Conversation, Message
from services.llm.factory import create_llm_router
from services.llm.prompts import SYSTEM_PROMPTS

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

    await update.message.reply_text(
        "AI chat started! Send me messages in French and I'll help you practice.\n"
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


async def chat_end(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle /endchat — end the AI conversation."""
    context.user_data.pop("conversation_id", None)
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
            ],
        },
        fallbacks=[CommandHandler("endchat", chat_end)],
    )
