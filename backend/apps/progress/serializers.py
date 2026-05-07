from rest_framework import serializers

from .models import LessonCompletion, MistakeEntry, SRSCard


class SRSCardSerializer(serializers.ModelSerializer):
    french = serializers.CharField(source="vocabulary.french", read_only=True)
    english = serializers.CharField(source="vocabulary.english", read_only=True)
    pronunciation = serializers.CharField(source="vocabulary.pronunciation", read_only=True)
    example_sentence = serializers.CharField(source="vocabulary.example_sentence", read_only=True)

    class Meta:
        model = SRSCard
        fields = (
            "id",
            "french",
            "english",
            "pronunciation",
            "example_sentence",
            "ease_factor",
            "interval_days",
            "next_review_at",
            "repetitions",
            "last_quality",
        )
        read_only_fields = fields


class SRSReviewSerializer(serializers.Serializer):
    card_id = serializers.IntegerField()
    quality = serializers.IntegerField(min_value=0, max_value=5)


class MistakeEntrySerializer(serializers.ModelSerializer):
    question_prompt = serializers.CharField(
        source="question.prompt",
        read_only=True,
        default=None,
    )

    class Meta:
        model = MistakeEntry
        fields = (
            "id",
            "question_prompt",
            "user_answer",
            "correct_answer",
            "mistake_type",
            "created_at",
            "reviewed",
        )
        read_only_fields = fields


class MistakeMarkReviewedSerializer(serializers.Serializer):
    mistake_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        max_length=100,
    )


class LessonCompletionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonCompletion
        fields = ("id", "lesson", "completed_at", "score", "total_questions")
        read_only_fields = fields
