"""Pull fresh news from RSS sources and rewrite via LLM.

Usage:
    # Default — up to 10 items across all sources
    python manage.py fetch_news

    # Limit how many items get processed total
    python manage.py fetch_news --max 5

    # Drop ALL existing news cards before fetching (use with care)
    python manage.py fetch_news --clear

Useful for:
    - Manually refreshing the News page in dev / staging
    - Seeding a freshly-deployed production box
    - Running ad-hoc when you want fresh content faster than 12h
"""

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Fetch fresh French news from RSS, rewrite at B1-B2, save as DiscoverCards."

    def add_arguments(self, parser):
        parser.add_argument(
            "--max",
            type=int,
            default=10,
            help="Maximum total items to process (default 10).",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete existing news cards before fetching.",
        )

    def handle(self, *args, **options):
        from apps.discover.models import DiscoverCard
        from apps.discover.news_fetcher import run_news_pipeline

        if options["clear"]:
            deleted, _ = DiscoverCard.objects.filter(type="news").delete()
            self.stdout.write(self.style.WARNING(f"Cleared {deleted} existing news cards."))

        created, skipped = run_news_pipeline(max_total=options["max"])

        if created:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Fetched & rewrote {created} fresh news article(s) "
                    f"({skipped} skipped due to LLM/save failures)."
                )
            )
            for card in DiscoverCard.objects.filter(type="news").order_by("-generated_at")[
                :created
            ]:
                self.stdout.write(f"  · [{card.topic}] {card.title[:70]}")
        else:
            self.stdout.write(
                self.style.WARNING(
                    f"No new articles created. {skipped} skipped. "
                    f"This usually means the LLM is unavailable or every fresh "
                    f"item was already saved."
                )
            )
