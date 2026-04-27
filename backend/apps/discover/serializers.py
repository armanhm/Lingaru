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
            "topic", "level",
            "seen", "interacted",
        )


class NewsListSerializer(serializers.ModelSerializer):
    """Lean shape for the /api/news/ list — drops the heavy content_json."""

    seen = serializers.BooleanField(read_only=True, default=False)
    interacted = serializers.BooleanField(read_only=True, default=False)
    read_minutes = serializers.SerializerMethodField()

    class Meta:
        model = DiscoverCard
        fields = (
            "id", "title", "summary", "topic", "level",
            "source_url", "image_url", "generated_at",
            "read_minutes", "seen", "interacted",
        )

    def get_read_minutes(self, obj):
        article = (obj.content_json or {}).get("article_fr", "")
        words = len(article.split()) if article else 0
        # Roughly 130 words/min for B1-B2 reader
        return max(1, round(words / 130))


class NewsDetailSerializer(serializers.ModelSerializer):
    """Full shape for /api/news/<id>/ — includes vocab, expressions, grammar."""

    seen = serializers.BooleanField(read_only=True, default=False)
    interacted = serializers.BooleanField(read_only=True, default=False)
    article_fr = serializers.SerializerMethodField()
    article_en = serializers.SerializerMethodField()
    vocabulary = serializers.SerializerMethodField()
    expressions = serializers.SerializerMethodField()
    grammar_points = serializers.SerializerMethodField()
    read_minutes = serializers.SerializerMethodField()

    class Meta:
        model = DiscoverCard
        fields = (
            "id", "title", "summary", "topic", "level",
            "source_url", "image_url", "generated_at",
            "article_fr", "article_en",
            "vocabulary", "expressions", "grammar_points",
            "read_minutes", "seen", "interacted",
        )

    def _content(self, obj):
        return obj.content_json or {}

    def get_article_fr(self, obj):
        return self._content(obj).get("article_fr", "")

    def get_article_en(self, obj):
        return self._content(obj).get("article_en", "")

    def get_vocabulary(self, obj):
        return self._content(obj).get("vocabulary", [])

    def get_expressions(self, obj):
        return self._content(obj).get("expressions", [])

    def get_grammar_points(self, obj):
        return self._content(obj).get("grammar_points", [])

    def get_read_minutes(self, obj):
        article = self._content(obj).get("article_fr", "")
        words = len(article.split()) if article else 0
        return max(1, round(words / 130))


class InteractSerializer(serializers.Serializer):
    """Empty serializer — interaction is just a POST to the card's URL."""
    pass
