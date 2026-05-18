import pytest
from django.utils import timezone

from apps.discover.models import DiscoverCard


@pytest.mark.django_db
def test_discover_card_language_defaults_to_fr():
    card = DiscoverCard.objects.create(
        type="news",
        topic="politics",
        title="t",
        summary="s",
        content_json={},
        generated_at=timezone.now(),
        level="B1",
    )
    assert card.language == "fr"


@pytest.mark.django_db
def test_discover_card_can_be_en():
    card = DiscoverCard.objects.create(
        type="news",
        topic="politics",
        title="t",
        summary="s",
        content_json={},
        generated_at=timezone.now(),
        level="B1",
        language="en",
    )
    assert card.language == "en"
