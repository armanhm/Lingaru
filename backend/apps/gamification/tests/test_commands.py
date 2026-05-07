import pytest
from django.core.management import call_command

from apps.gamification.constants import DEFAULT_BADGES
from apps.gamification.models import Badge


@pytest.mark.django_db
class TestSeedBadges:
    def test_creates_all_badges(self):
        call_command("seed_badges")
        assert Badge.objects.count() == len(DEFAULT_BADGES)

    def test_idempotent(self):
        call_command("seed_badges")
        call_command("seed_badges")
        assert Badge.objects.count() == len(DEFAULT_BADGES)

    def test_badge_names_match(self):
        call_command("seed_badges")
        names = set(Badge.objects.values_list("name", flat=True))
        expected = {b["name"] for b in DEFAULT_BADGES}
        assert names == expected
