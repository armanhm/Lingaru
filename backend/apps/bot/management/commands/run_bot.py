import asyncio
import logging
import sys

from django.core.management.base import BaseCommand

from apps.bot.bot import create_bot_application

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Start the Lingaru Telegram bot (long-polling mode)."

    def handle(self, *args, **options):
        self.stdout.write("Starting Lingaru Telegram bot...")
        logger.info("Starting Lingaru Telegram bot...")

        # Python 3.14 removed the implicit event-loop fallback that
        # python-telegram-bot's run_polling() relies on. Install one
        # ourselves before delegating to PTB so the bot still works
        # both inside the Docker image (Python 3.12) and on a host
        # interpreter that's already on 3.14.
        if sys.version_info >= (3, 14):
            asyncio.set_event_loop(asyncio.new_event_loop())

        application = create_bot_application()
        application.run_polling(drop_pending_updates=True)
