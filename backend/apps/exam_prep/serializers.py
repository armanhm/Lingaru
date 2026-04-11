from rest_framework import serializers
from .models import ExamExercise, ExamSession, ExamResponse


class ExerciseListSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = ExamExercise
        fields = ("id", "title", "section", "cefr_level", "time_limit_seconds", "question_count")

    def get_question_count(self, obj):
        questions = obj.content.get("questions", [])
        return len(questions)


class ExerciseDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamExercise
        fields = ("id", "title", "section", "cefr_level", "instructions_fr", "instructions_en",
                  "content", "time_limit_seconds")


class SessionStartSerializer(serializers.Serializer):
    section = serializers.ChoiceField(choices=["CO", "CE", "EE", "EO"])
    cefr_level = serializers.ChoiceField(choices=["A1", "A2", "B1", "B2", "C1", "C2"])
    mode = serializers.ChoiceField(choices=["practice", "mock"], default="practice")


class RespondSerializer(serializers.Serializer):
    exercise_id = serializers.IntegerField()
    question_index = serializers.IntegerField()
    answer = serializers.CharField()


class ResponseResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamResponse
        fields = ("is_correct", "score", "max_score", "ai_feedback", "question_index")


class SessionCompleteSerializer(serializers.ModelSerializer):
    percentage = serializers.SerializerMethodField()
    cefr_estimate = serializers.SerializerMethodField()

    class Meta:
        model = ExamSession
        fields = ("id", "section", "cefr_level", "mode", "score", "max_score",
                  "percentage", "cefr_estimate", "started_at", "completed_at")

    def get_percentage(self, obj):
        if obj.max_score and obj.max_score > 0:
            return round((obj.score / obj.max_score) * 100, 1)
        return 0

    def get_cefr_estimate(self, obj):
        from .scoring import score_to_cefr
        pct = self.get_percentage(obj)
        return score_to_cefr(pct)


class SessionHistorySerializer(serializers.ModelSerializer):
    percentage = serializers.SerializerMethodField()

    class Meta:
        model = ExamSession
        fields = ("id", "section", "cefr_level", "mode", "score", "max_score",
                  "percentage", "started_at", "completed_at")

    def get_percentage(self, obj):
        if obj.max_score and obj.max_score > 0:
            return round((obj.score / obj.max_score) * 100, 1)
        return 0
