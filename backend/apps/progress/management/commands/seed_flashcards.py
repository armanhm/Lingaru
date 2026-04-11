"""Create SRS flashcards for all vocabulary items for every user (or a specific user)."""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.content.models import Vocabulary
from apps.progress.models import SRSCard

User = get_user_model()


class Command(BaseCommand):
    help = "Seed SRS flashcards for all vocabulary items."

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            type=str,
            default=None,
            help="Seed cards only for this user (default: all users).",
        )

    def handle(self, *args, **options):
        username = options.get("username")
        users = User.objects.filter(username=username) if username else User.objects.all()
        vocab_qs = Vocabulary.objects.select_related("lesson").all()

        if not vocab_qs.exists():
            self.stdout.write(self.style.WARNING("No vocabulary items found. Run content seeds first."))
            return

        created_total = 0
        for user in users:
            created = 0
            for vocab in vocab_qs:
                _, is_new = SRSCard.objects.get_or_create(
                    user=user,
                    vocabulary=vocab,
                    defaults={
                        "ease_factor": 2.5,
                        "interval_days": 0,
                        "repetitions": 0,
                        "next_review_at": timezone.now(),
                    },
                )
                if is_new:
                    created += 1
            self.stdout.write(f"  {user.username}: {created} new flashcards")
            created_total += created

        self.stdout.write(self.style.SUCCESS(f"Done. Created {created_total} flashcard(s) across {users.count()} user(s)."))
