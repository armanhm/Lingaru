from rest_framework import serializers

from .models import MemoryNote


class MemoryNoteSerializer(serializers.ModelSerializer):
    """Serializer for the Memory tab CRUD endpoints.

    `source` is read-only -- the API never lets the client claim a note
    was assistant-detected. Views set `source` explicitly when they
    create a note.

    `content` is capped at 500 chars; anything longer is probably not a
    fact, it's a story.
    """

    content = serializers.CharField(max_length=500, allow_blank=False, trim_whitespace=True)

    class Meta:
        model = MemoryNote
        fields = (
            "id",
            "content",
            "category",
            "source",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "source", "created_at", "updated_at")
