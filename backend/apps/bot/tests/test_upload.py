from unittest.mock import AsyncMock, MagicMock

import pytest

from apps.bot.handlers.upload import upload_command


@pytest.mark.asyncio
class TestUploadCommand:
    async def test_replies_with_upload_instructions(self):
        update = MagicMock()
        update.message.reply_text = AsyncMock()
        context = MagicMock()

        await upload_command(update, context)

        update.message.reply_text.assert_called_once()
        text = update.message.reply_text.call_args[0][0]
        assert "web app" in text
        assert "Documents" in text
        assert "/chat" in text

    async def test_mentions_rag_context(self):
        update = MagicMock()
        update.message.reply_text = AsyncMock()
        context = MagicMock()

        await upload_command(update, context)

        text = update.message.reply_text.call_args[0][0]
        assert "RAG" in text
        assert "context-aware" in text
