from rest_framework import serializers
from .models import GrammarCategory, GrammarTopic, GrammarDrillItem, GrammarMastery, GrammarSession
from .scoring import status_for


class GrammarCategorySerializer(serializers.ModelSerializer):
    topic_count = serializers.SerializerMethodField()

    class Meta:
        model = GrammarCategory
        fields = ("id", "name", "slug", "description", "icon", "order", "topic_count")

    def get_topic_count(self, obj):
        return obj.topics.filter(is_active=True).count()


class GrammarTopicListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slug = serializers.CharField(source="category.slug", read_only=True)
    category_icon = serializers.CharField(source="category.icon", read_only=True)
    drill_count = serializers.SerializerMethodField()
    mastery = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = GrammarTopic
        fields = (
            "id", "title", "slug", "summary", "cefr_level", "formula",
            "category_name", "category_slug", "category_icon",
            "drill_count", "mastery", "status",
        )

    def get_drill_count(self, obj):
        return obj.drills.count()

    def _user_mastery(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        return GrammarMastery.objects.filter(user=request.user, topic=obj).first()

    def get_mastery(self, obj):
        m = self._user_mastery(obj)
        return round(m.mastery_score, 1) if m else 0

    def get_status(self, obj):
        return status_for(self._user_mastery(obj))


class GrammarTopicDetailSerializer(GrammarTopicListSerializer):
    class Meta(GrammarTopicListSerializer.Meta):
        fields = GrammarTopicListSerializer.Meta.fields + (
            "explanation", "examples", "exceptions", "common_mistakes",
        )


class GrammarDrillItemSerializer(serializers.ModelSerializer):
    """Drill item — the correct_answer is INCLUDED so client can validate locally
    after a 350ms feedback delay (consistent with Quiz pattern)."""
    class Meta:
        model = GrammarDrillItem
        fields = ("id", "type", "prompt", "correct_answer", "options", "explanation", "difficulty")


class StartSessionSerializer(serializers.Serializer):
    topic_id = serializers.IntegerField(required=False, allow_null=True)
    mode = serializers.ChoiceField(choices=["drill", "diagnostic"], default="drill")


class SubmitAnswerSerializer(serializers.Serializer):
    drill_item_id = serializers.IntegerField()
    user_answer = serializers.CharField(allow_blank=True)
    is_correct = serializers.BooleanField()


class CompleteSessionSerializer(serializers.ModelSerializer):
    accuracy = serializers.SerializerMethodField()
    mastery_delta = serializers.SerializerMethodField()
    new_status = serializers.SerializerMethodField()

    class Meta:
        model = GrammarSession
        fields = (
            "id", "mode", "score", "total", "accuracy",
            "mastery_before", "mastery_after", "mastery_delta", "new_status",
            "completed_at",
        )

    def get_accuracy(self, obj):
        return round((obj.score / obj.total) * 100, 1) if obj.total else 0

    def get_mastery_delta(self, obj):
        if obj.mastery_before is None or obj.mastery_after is None:
            return 0
        return round(obj.mastery_after - obj.mastery_before, 1)

    def get_new_status(self, obj):
        if not obj.topic:
            return None
        m = GrammarMastery.objects.filter(user=obj.user, topic=obj.topic).first()
        return status_for(m)
