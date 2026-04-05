from rest_framework import serializers

from .models import DiscoverCard, UserDiscoverHistory


class DiscoverCardSerializer(serializers.ModelSerializer):
    seen = serializers.BooleanField(read_only=True, default=False)
    interacted = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = DiscoverCard
        fields = (
            "id", "type", "title", "summary", "content_json",
            "source_url", "image_url", "generated_at", "expires_at",
            "seen", "interacted",
        )


class InteractSerializer(serializers.Serializer):
    """Empty serializer — interaction is just a POST to the card's URL."""
    pass
