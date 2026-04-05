from django.core.management.base import BaseCommand

from apps.discover.services import generate_daily_cards


class Command(BaseCommand):
    help = "Generate discover feed cards (word, grammar, trivia, news)"

    def handle(self, *args, **options):
        cards = generate_daily_cards()
        self.stdout.write(
            self.style.SUCCESS(
                f"Generated {len(cards)} discover cards: "
                f"{[c.type for c in cards]}"
            )
        )
