"""Seed EN news articles, one per topic.

Uses the existing generate_news_card helper, which has fallback layers
so it works with or without LLM keys (worst case: curated mock content).

Idempotent: skips topics that already have an active (non-expired) EN
article.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.discover.models import DiscoverCard
from apps.discover.services import generate_news_card

# Match the FR side's topic taxonomy. Slugs are language-shared; only
# the article CONTENT is language-specific.
TOPICS = [
    "politics",
    "sports",
    "culture",
    "economy",
    "science",
    "tech",
    "society",
    "environ",
    "world",
]


class Command(BaseCommand):
    help = "Seed EN news articles (one per topic)."

    def handle(self, *args, **options):
        now = timezone.now()
        created = 0
        skipped = 0
        failed = 0

        for topic in TOPICS:
            # Skip if an active EN article on this topic already exists.
            existing = DiscoverCard.objects.filter(
                type="news",
                topic=topic,
                language="en",
                expires_at__gt=now,
            ).exists()
            if existing:
                skipped += 1
                self.stdout.write(f"  - [{topic}] already has an active EN article")
                continue

            try:
                card = generate_news_card(topic=topic, language="en")
                if card is None:
                    failed += 1
                    self.stdout.write(self.style.WARNING(f"  ? [{topic}] no card returned"))
                    continue
                self.stdout.write(f"  + [{topic}] {card.title}")
                created += 1
            except Exception as exc:
                failed += 1
                self.stdout.write(self.style.WARNING(f"  - [{topic}] failed: {exc}"))

        self.stdout.write(
            self.style.SUCCESS(f"EN news: +{created} created, {skipped} skipped, {failed} failed.")
        )
