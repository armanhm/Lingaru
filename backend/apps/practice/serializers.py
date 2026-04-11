import random
from rest_framework import serializers
from apps.content.models import Lesson, Question
from .models import QuizSession, QuizAnswer


class QuizStartSerializer(serializers.Serializer):
    lesson_id = serializers.IntegerField()

    def validate_lesson_id(self, value):
        try:
            Lesson.objects.get(pk=value)
        except Lesson.DoesNotExist:
            raise serializers.ValidationError("Lesson not found.")
        return value


class QuizQuestionSerializer(serializers.ModelSerializer):
    options = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = ("id", "type", "prompt", "correct_answer", "difficulty", "options")

    def get_options(self, obj):
        if obj.type == "mcq" and obj.wrong_answers:
            options = [obj.correct_answer] + list(obj.wrong_answers)
            random.shuffle(options)
            return options
        return []


class AnswerSubmitSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    answer = serializers.CharField()


class AnswerResultSerializer(serializers.ModelSerializer):
    correct_answer = serializers.CharField(source="question.correct_answer")
    explanation = serializers.CharField(source="question.explanation")

    class Meta:
        model = QuizAnswer
        fields = ("is_correct", "correct_answer", "explanation", "user_answer")


class QuizCompleteSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source="lesson.title")

    class Meta:
        model = QuizSession
        fields = (
            "id", "lesson_title", "score", "total_questions",
            "started_at", "completed_at",
        )


class QuizHistorySerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source="lesson.title")
    lesson_id = serializers.IntegerField(source="lesson.id")

    class Meta:
        model = QuizSession
        fields = (
            "id", "lesson_id", "lesson_title", "score",
            "total_questions", "started_at", "completed_at",
        )
