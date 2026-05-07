from rest_framework import serializers

from .models import (
    GrammarRule,
    Lesson,
    Question,
    ReadingText,
    Topic,
    VideoExpression,
    VideoLesson,
    VideoVocabulary,
    Vocabulary,
)


class VocabularySerializer(serializers.ModelSerializer):
    class Meta:
        model = Vocabulary
        fields = (
            "id",
            "french",
            "english",
            "pronunciation",
            "example_sentence",
            "gender",
            "part_of_speech",
            "audio_url",
        )


class GrammarRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = GrammarRule
        fields = (
            "id",
            "title",
            "explanation",
            "formula",
            "examples",
            "exceptions",
        )


class ReadingTextSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReadingText
        fields = (
            "id",
            "title",
            "content_fr",
            "content_en",
            "vocabulary_highlights",
            "comprehension_questions",
        )


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = (
            "id",
            "type",
            "prompt",
            "correct_answer",
            "wrong_answers",
            "explanation",
            "difficulty",
        )


class LessonListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ("id", "type", "title", "order", "difficulty")


class TopicMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ("id", "name_fr", "name_en")


class LessonDetailSerializer(serializers.ModelSerializer):
    topic = TopicMinimalSerializer(read_only=True)
    vocabulary = VocabularySerializer(many=True, read_only=True)
    grammar_rules = GrammarRuleSerializer(many=True, read_only=True)
    reading_texts = ReadingTextSerializer(many=True, read_only=True)
    questions = QuestionSerializer(many=True, read_only=True)
    video = serializers.SerializerMethodField()

    def get_video(self, obj):
        try:
            return VideoLessonSerializer(obj.video).data
        except VideoLesson.DoesNotExist:
            return None

    class Meta:
        model = Lesson
        fields = (
            "id",
            "topic",
            "type",
            "title",
            "content",
            "order",
            "difficulty",
            "vocabulary",
            "grammar_rules",
            "reading_texts",
            "questions",
            "video",
        )


class VideoVocabularySerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoVocabulary
        fields = (
            "id",
            "french",
            "english",
            "pronunciation",
            "example_sentence",
            "timestamp_seconds",
        )


class VideoExpressionSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoExpression
        fields = ("id", "expression_fr", "expression_en", "context_sentence", "timestamp_seconds")


class VideoLessonSerializer(serializers.ModelSerializer):
    vocabulary = VideoVocabularySerializer(many=True, read_only=True)
    expressions = VideoExpressionSerializer(many=True, read_only=True)

    class Meta:
        model = VideoLesson
        fields = (
            "id",
            "youtube_url",
            "youtube_id",
            "title",
            "thumbnail_url",
            "duration_seconds",
            "transcript_fr",
            "transcript_en",
            "status",
            "error_message",
            "vocabulary",
            "expressions",
        )
        read_only_fields = (
            "youtube_id",
            "title",
            "thumbnail_url",
            "duration_seconds",
            "transcript_fr",
            "transcript_en",
            "status",
            "error_message",
            "vocabulary",
            "expressions",
        )


class TopicListSerializer(serializers.ModelSerializer):
    lesson_count = serializers.IntegerField(source="lessons.count", read_only=True)

    class Meta:
        model = Topic
        fields = (
            "id",
            "name_fr",
            "name_en",
            "description",
            "icon",
            "order",
            "difficulty_level",
            "lesson_count",
        )


class TopicDetailSerializer(serializers.ModelSerializer):
    lessons = LessonListSerializer(many=True, read_only=True)

    class Meta:
        model = Topic
        fields = (
            "id",
            "name_fr",
            "name_en",
            "description",
            "icon",
            "order",
            "difficulty_level",
            "lessons",
        )
