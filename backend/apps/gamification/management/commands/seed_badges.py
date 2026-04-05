from django.core.management.base import BaseCommand

from apps.gamification.constants import DEFAULT_BADGES
from apps.gamification.models import Badge


class Command(BaseCommand):
    help = "Seed default gamification badges (idempotent)"

    def handle(self, *args, **options):
        created_count = 0
        for badge_data in DEFAULT_BADGES:
            _, created = Badge.objects.get_or_create(
                name=badge_data["name"],
                defaults={
                    "description": badge_data["description"],
                    "icon": badge_data["icon"],
                    "criteria_type": badge_data["criteria_type"],
                    "criteria_value": badge_data["criteria_value"],
                },
            )
            if created:
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {created_count} new badges "
                f"({len(DEFAULT_BADGES)} total defined)"
            )
        )
