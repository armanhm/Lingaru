import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="discover.generate_daily_feed")
def generate_daily_feed():
    """Celery task to generate the daily discover feed."""
    from apps.discover.services import generate_daily_cards

    cards = generate_daily_cards()
    logger.info("generate_daily_feed task complete: %d cards.", len(cards))
    return len(cards)
