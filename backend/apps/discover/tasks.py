"""Celery tasks for the Discover + News surfaces.

Schedule
  - generate_daily_feed       — once a day (configured in config/celery.py)
  - fetch_real_news_pipeline  — twice a day (07:00 + 19:00 UTC)
"""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="discover.generate_daily_feed")
def generate_daily_feed():
    """Generate the daily Discover feed (word + grammar + trivia cards)."""
    from apps.discover.services import generate_daily_cards

    cards = generate_daily_cards()
    logger.info("generate_daily_feed: %d cards.", len(cards))
    return len(cards)


@shared_task(name="discover.fetch_real_news_pipeline")
def fetch_real_news_pipeline(max_total: int | None = 10):
    """Pull fresh items from the curated French RSS sources, rewrite each
    at B1-B2 via the LLM, and save them as news DiscoverCards.

    Defaults to 10 items per run — enough to refresh the news page without
    blowing through LLM rate limits.
    """
    from apps.discover.news_fetcher import run_news_pipeline

    created, skipped = run_news_pipeline(max_total=max_total)
    logger.info("fetch_real_news_pipeline: %d created, %d skipped", created, skipped)
    return {"created": created, "skipped": skipped}
