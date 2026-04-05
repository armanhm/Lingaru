import pytest
from django.utils import timezone

from apps.discover.models import DiscoverCard
from apps.discover.serializers import DiscoverCardSerializer


@pytest.mark.django_db
class TestDiscoverCardSerializer:
    def test_serializes_all_fields(self):
        card = DiscoverCard.objects.create(
            type="word",
            title="Bonjour",
            summary="Hello",
            content_json={"french": "bonjour", "english": "hello"},
            generated_at=timezone.now(),
        )
        data = DiscoverCardSerializer(card).data
        assert data["id"] == card.pk
        assert data["type"] == "word"
        assert data["title"] == "Bonjour"
        assert data["content_json"]["french"] == "bonjour"
        assert "generated_at" in data

    def test_seen_and_interacted_default_false(self):
        card = DiscoverCard.objects.create(
            type="trivia", title="Fact", content_json={},
        )
        data = DiscoverCardSerializer(card).data
        assert data["seen"] is False
        assert data["interacted"] is False
