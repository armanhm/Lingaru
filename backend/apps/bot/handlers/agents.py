"""`/agents` Telegram command — list the active assistant agents and let
the user run one with a single follow-up message.

Conversation flow:
  1. /agents              → shows list with inline-keyboard "Run" buttons.
  2. user taps a button   → bot asks for input: "Send me text to run
                            <agent> on."
  3. user replies with text → bot calls services.llm with the agent's
                            system prompt and replies with the result.
  4. user can /cancel at any step.

This is intentionally lightweight — for full multi-turn chat the user
should keep using /chat. /agents is for one-shot specialist queries
("correct this sentence", "explain this grammar").
"""

import logging

from asgiref.sync import sync_to_async
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from apps.agents.models import Agent
from services.llm.factory import create_llm_router

logger = logging.getLogger(__name__)

ASK_INPUT = 1


def _list_active_agents() -> list[Agent]:
    return list(Agent.objects.filter(is_active=True).order_by("order", "name"))


def _get_agent_by_slug(slug: str) -> Agent | None:
    return Agent.objects.filter(slug=slug, is_active=True).first()


def _run_agent_sync(agent: Agent, user_text: str) -> str:
    """Synchronous wrapper around the LLM call so we can dispatch with
    `sync_to_async`. Returns the LLM's text reply (or a friendly error).

    The web app renders structured blocks (audio, vocab cards, quizzes)
    that the agent prompt may include in a fenced ```blocks segment.
    Telegram can't render those, so we strip the fence and only send
    the prose. The blocks are simply discarded for now — when we want
    bot-side block rendering, this is the place to map them onto
    Telegram primitives (reply_audio, formatted markdown, etc.).
    """
    from apps.assistant.blocks import extract_blocks

    try:
        router = create_llm_router()
        response = router.generate(
            messages=[{"role": "user", "content": user_text}],
            system_prompt=agent.system_prompt,
        )
        prose, _blocks = extract_blocks(response.content or "")
        return prose.strip() or "(empty response)"
    except Exception as exc:
        logger.warning("Agent %s LLM call failed: %s", agent.slug, exc)
        return f"⚠️ Agent failed: {exc.__class__.__name__}. Try again later."


async def agents_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """List all active agents with inline-keyboard run buttons."""
    agents = await sync_to_async(_list_active_agents)()

    if not agents:
        await update.message.reply_text(
            "No agents configured yet. Run `python manage.py seed_agents` "
            "on the server to populate the gallery."
        )
        return

    lines = ["*Specialist agents*", ""]
    keyboard_rows = []
    row = []
    for agent in agents:
        lines.append(f"{agent.emoji} *{agent.name}* — {agent.tagline or agent.description[:80]}")
        row.append(
            InlineKeyboardButton(
                f"{agent.emoji} {agent.name}",
                callback_data=f"agent:{agent.slug}",
            )
        )
        if len(row) == 2:
            keyboard_rows.append(row)
            row = []
    if row:
        keyboard_rows.append(row)

    await update.message.reply_text(
        "\n".join(lines),
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(keyboard_rows),
    )


async def agent_picked(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """User tapped a 'Run agent' button — ask them for the input text."""
    query = update.callback_query
    await query.answer()

    slug = query.data.split(":", 1)[1]
    agent = await sync_to_async(_get_agent_by_slug)(slug)
    if agent is None:
        await query.edit_message_text("That agent is no longer available.")
        return ConversationHandler.END

    context.user_data["pending_agent_slug"] = slug
    await query.edit_message_text(
        f"{agent.emoji} *{agent.name}* — send me the text you'd like me to run "
        f"this on. Use /cancel to abort.",
        parse_mode="Markdown",
    )
    return ASK_INPUT


async def agent_run(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """User sent the input text — execute the agent's LLM call and reply."""
    slug = context.user_data.pop("pending_agent_slug", None)
    if not slug:
        await update.message.reply_text("No agent in flight. Try /agents again.")
        return ConversationHandler.END

    agent = await sync_to_async(_get_agent_by_slug)(slug)
    if agent is None:
        await update.message.reply_text("Agent went away. Try /agents again.")
        return ConversationHandler.END

    user_text = (update.message.text or "").strip()
    if not user_text:
        await update.message.reply_text("Please send the text to process.")
        return ASK_INPUT

    await update.message.chat.send_action("typing")
    reply = await sync_to_async(_run_agent_sync)(agent, user_text)

    # Telegram caps messages at 4096 chars; chunk if longer.
    chunks = [reply[i : i + 3800] for i in range(0, len(reply), 3800)] or ["(no response)"]
    for chunk in chunks:
        await update.message.reply_text(chunk)

    return ConversationHandler.END


async def agent_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.pop("pending_agent_slug", None)
    await update.message.reply_text("Cancelled. Use /agents to start over.")
    return ConversationHandler.END


def agents_conversation_handler() -> ConversationHandler:
    """Wires up the /agents flow: list → pick → input → run."""
    return ConversationHandler(
        entry_points=[CallbackQueryHandler(agent_picked, pattern=r"^agent:")],
        states={
            ASK_INPUT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, agent_run),
            ],
        },
        fallbacks=[CommandHandler("cancel", agent_cancel)],
        per_message=False,
    )
