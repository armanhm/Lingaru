import logging

from django.core.management.base import BaseCommand

from apps.bot.bot import create_bot_application

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Start the Lingaru Telegram bot (long-polling mode)."

    def handle(self, *args, **options):
        self.stdout.write("Starting Lingaru Telegram bot...")
        logger.info("Starting Lingaru Telegram bot...")

        application = create_bot_application()
        application.run_polling(drop_pending_updates=True)
