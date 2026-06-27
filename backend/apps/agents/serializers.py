from rest_framework import serializers

from .models import Agent, AgentRun

_EN_OVERRIDABLE_FIELDS = (
    "name",
    "tagline",
    "description",
    "best_for",
    "capabilities",
    "suggested_questions",
)


def _apply_en_overrides(instance, data, request):
    user = getattr(request, "user", None) if request else None
    if not user or not getattr(user, "is_authenticated", False):
        return data
    if getattr(user, "target_language", "fr") != "en":
        return data
    for field in _EN_OVERRIDABLE_FIELDS:
        if field not in data:
            continue
        en_value = getattr(instance, f"{field}_en", None)
        if en_value:
            data[field] = en_value
    return data


class AgentListSerializer(serializers.ModelSerializer):
    """Lean shape for the gallery, strips the system prompt."""

    class Meta:
        model = Agent
        fields = (
            "slug",
            "name",
            "emoji",
            "tint",
            "tagline",
            "best_for",
            "mode",
            "output_shape",
            "order",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return _apply_en_overrides(instance, data, self.context.get("request"))


class AgentDetailSerializer(serializers.ModelSerializer):
    """Full shape for the agent detail page (no system prompt, server-side only)."""

    class Meta:
        model = Agent
        fields = (
            "slug",
            "name",
            "emoji",
            "tint",
            "tagline",
            "description",
            "best_for",
            "capabilities",
            "suggested_questions",
            "mode",
            "output_shape",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return _apply_en_overrides(instance, data, self.context.get("request"))


class AgentRunSerializer(serializers.ModelSerializer):
    """A past conversation pinned to this agent, surfaced under Recent runs."""

    conversation_id = serializers.IntegerField(source="conversation.id", read_only=True)
    title = serializers.CharField(source="conversation.title", read_only=True)
    # The view annotates queryset rows with this aggregate so a 20-run list
    # is one COUNT, not 20. Falls back to obj.conversation.messages.count()
    # for callers that don't pre-annotate (single-object views, tests).
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = AgentRun
        fields = ("id", "conversation_id", "title", "started_at", "message_count")

    def get_message_count(self, obj):
        annotated = getattr(obj, "message_count_annotated", None)
        if annotated is not None:
            return annotated
        return obj.conversation.messages.count() if obj.conversation_id else 0


class StartAgentRunSerializer(serializers.Serializer):
    """Empty body, POST /api/agents/<slug>/start/ creates a fresh conversation."""

    pass
