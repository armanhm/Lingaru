from rest_framework import serializers

from .models import MyNote

MAX_TAGS = 20
MAX_TAG_LENGTH = 40


def _normalize_tags(raw):
    if not isinstance(raw, list):
        raise serializers.ValidationError("tags must be a list of strings.")
    cleaned = []
    seen = set()
    for item in raw:
        if not isinstance(item, str):
            raise serializers.ValidationError("each tag must be a string.")
        tag = item.strip().lower()
        if not tag:
            continue
        if len(tag) > MAX_TAG_LENGTH:
            raise serializers.ValidationError(
                f"each tag must be at most {MAX_TAG_LENGTH} characters."
            )
        if tag in seen:
            continue
        seen.add(tag)
        cleaned.append(tag)
    if len(cleaned) > MAX_TAGS:
        raise serializers.ValidationError(f"at most {MAX_TAGS} tags allowed.")
    return cleaned


class MyNoteListSerializer(serializers.ModelSerializer):
    body_preview = serializers.SerializerMethodField()

    class Meta:
        model = MyNote
        fields = (
            "id",
            "title",
            "kind",
            "tags",
            "language",
            "is_favorite",
            "is_public",
            "updated_at",
            "body_preview",
        )

    def get_body_preview(self, obj):
        text = obj.body_markdown or ""
        return text[:140]


class MyNoteDetailSerializer(serializers.ModelSerializer):
    title = serializers.CharField(max_length=200, allow_blank=False, trim_whitespace=True)

    class Meta:
        model = MyNote
        fields = (
            "id",
            "title",
            "kind",
            "body_markdown",
            "tags",
            "language",
            "is_favorite",
            "is_public",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_tags(self, value):
        return _normalize_tags(value)
