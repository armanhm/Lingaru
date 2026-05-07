"""Tests for the /agents Telegram handler.

We mock the LLM call so the agent flow is verified end-to-end without
hitting an external API.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from telegram.ext import ConversationHandler

from apps.agents.models import Agent
from apps.bot.handlers.agents import (
    _list_active_agents,
    _run_agent_sync,
    agent_cancel,
    agent_picked,
    agent_run,
    agents_command,
)


@pytest.fixture
def sample_agents(db):
    return [
        Agent.objects.create(
            slug="correct",
            name="Correcteur",
            emoji="✏️",
            tagline="Fix grammar mistakes",
            description="Corrects French grammar.",
            system_prompt="You correct French grammar.",
            order=1,
        ),
        Agent.objects.create(
            slug="conjugate",
            name="Conjugueur",
            emoji="🔁",
            tagline="Conjugate verbs",
            description="Conjugates French verbs.",
            system_prompt="You conjugate French verbs.",
            order=2,
        ),
        Agent.objects.create(
            slug="hidden",
            name="Hidden",
            emoji="🙈",
            system_prompt="x",
            is_active=False,
            order=99,
        ),
    ]


@pytest.fixture
def tg_update():
    mock = AsyncMock()
    mock.message = AsyncMock()
    mock.message.reply_text = AsyncMock()
    mock.message.chat = AsyncMock()
    mock.message.chat.send_action = AsyncMock()
    return mock


@pytest.fixture
def tg_context():
    ctx = MagicMock()
    ctx.user_data = {}
    return ctx


@pytest.mark.django_db(transaction=True)
class TestListActiveAgents:
    def test_excludes_inactive(self, sample_agents):
        agents = _list_active_agents()
        slugs = [a.slug for a in agents]
        assert "correct" in slugs
        assert "conjugate" in slugs
        assert "hidden" not in slugs

    def test_orders_by_order_field(self, sample_agents):
        agents = _list_active_agents()
        assert agents[0].slug == "correct"
        assert agents[1].slug == "conjugate"


@pytest.mark.django_db(transaction=True)
class TestAgentsCommand:
    @pytest.mark.asyncio
    async def test_lists_active_agents(self, sample_agents, tg_update, tg_context):
        await agents_command(tg_update, tg_context)

        tg_update.message.reply_text.assert_called_once()
        kwargs = tg_update.message.reply_text.call_args.kwargs
        text = tg_update.message.reply_text.call_args[0][0]
        assert "Correcteur" in text
        assert "Conjugueur" in text
        assert "Hidden" not in text
        # Inline keyboard rendered with one button per active agent.
        assert kwargs["reply_markup"] is not None

    @pytest.mark.asyncio
    async def test_handles_empty_state(self, db, tg_update, tg_context):
        await agents_command(tg_update, tg_context)
        text = tg_update.message.reply_text.call_args[0][0]
        assert "No agents configured" in text


@pytest.mark.django_db(transaction=True)
class TestAgentPicked:
    @pytest.mark.asyncio
    async def test_stores_slug_and_asks_for_input(self, sample_agents, tg_context):
        update = AsyncMock()
        update.callback_query = AsyncMock()
        update.callback_query.data = "agent:correct"
        update.callback_query.answer = AsyncMock()
        update.callback_query.edit_message_text = AsyncMock()

        next_state = await agent_picked(update, tg_context)

        assert next_state == 1  # ASK_INPUT
        assert tg_context.user_data["pending_agent_slug"] == "correct"
        update.callback_query.edit_message_text.assert_called_once()

    @pytest.mark.asyncio
    async def test_unknown_slug_ends_conversation(self, db, tg_context):
        update = AsyncMock()
        update.callback_query = AsyncMock()
        update.callback_query.data = "agent:nope"
        update.callback_query.answer = AsyncMock()
        update.callback_query.edit_message_text = AsyncMock()

        next_state = await agent_picked(update, tg_context)
        assert next_state == ConversationHandler.END


@pytest.mark.django_db(transaction=True)
class TestAgentRun:
    @pytest.mark.asyncio
    @patch("apps.bot.handlers.agents._run_agent_sync")
    async def test_runs_agent_and_replies(
        self,
        mock_run,
        sample_agents,
        tg_update,
        tg_context,
    ):
        mock_run.return_value = "Voici la correction."
        tg_context.user_data["pending_agent_slug"] = "correct"
        tg_update.message.text = "Je suis aller au magasin."

        next_state = await agent_run(tg_update, tg_context)

        assert next_state == ConversationHandler.END
        mock_run.assert_called_once()
        agent_arg, text_arg = mock_run.call_args[0]
        assert agent_arg.slug == "correct"
        assert text_arg == "Je suis aller au magasin."
        # Reply was sent to the user.
        tg_update.message.reply_text.assert_called()
        reply = tg_update.message.reply_text.call_args[0][0]
        assert "Voici la correction." in reply

    @pytest.mark.asyncio
    async def test_no_pending_agent_ends_gracefully(self, db, tg_update, tg_context):
        # No pending_agent_slug in user_data.
        tg_update.message.text = "hi"
        state = await agent_run(tg_update, tg_context)
        assert state == ConversationHandler.END
        text = tg_update.message.reply_text.call_args[0][0]
        assert "/agents" in text


@pytest.mark.django_db(transaction=True)
class TestRunAgentSync:
    @patch("apps.bot.handlers.agents.create_llm_router")
    def test_returns_llm_content(self, mock_create_router, sample_agents):
        mock_router = MagicMock()
        mock_router.generate.return_value = MagicMock(content="ok")
        mock_create_router.return_value = mock_router

        result = _run_agent_sync(sample_agents[0], "input text")
        assert result == "ok"

    @patch("apps.bot.handlers.agents.create_llm_router")
    def test_swallows_llm_errors(self, mock_create_router, sample_agents):
        mock_create_router.side_effect = RuntimeError("no api key")
        result = _run_agent_sync(sample_agents[0], "x")
        assert "Agent failed" in result


@pytest.mark.django_db(transaction=True)
class TestAgentCancel:
    @pytest.mark.asyncio
    async def test_clears_pending_state(self, db, tg_update, tg_context):
        tg_context.user_data["pending_agent_slug"] = "correct"
        state = await agent_cancel(tg_update, tg_context)
        assert state == ConversationHandler.END
        assert "pending_agent_slug" not in tg_context.user_data
