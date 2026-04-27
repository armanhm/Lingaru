"""Seed curated news articles, one per topic."""

from django.core.management.base import BaseCommand

from apps.discover.services import VALID_NEWS_TOPICS, generate_news_card


class Command(BaseCommand):
    help = "Seed one curated news article per topic (uses the offline mock library)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete existing news cards before seeding.",
        )

    def handle(self, *args, **options):
        from apps.discover.models import DiscoverCard

        if options["clear"]:
            deleted, _ = DiscoverCard.objects.filter(type="news").delete()
            self.stdout.write(self.style.WARNING(f"Cleared {deleted} existing news cards."))

        # Skip 'misc' — the curated library doesn't have one and we don't want
        # to fall through to a random pick during seeding.
        topics = sorted(t for t in VALID_NEWS_TOPICS if t != "misc")
        created = 0
        for topic in topics:
            card = generate_news_card(topic=topic)
            if card is None:
                self.stdout.write(self.style.ERROR(f"Failed to seed news for topic={topic}"))
                continue
            self.stdout.write(self.style.SUCCESS(
                f"  + [{card.topic}] {card.title}  ({card.level}, {len((card.content_json or {}).get('vocabulary', []))} vocab)"
            ))
            created += 1

        self.stdout.write(self.style.SUCCESS(f"\nSeeded {created} news articles."))
