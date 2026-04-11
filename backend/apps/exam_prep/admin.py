from django.contrib import admin
from .models import ExamExercise, ExamSession, ExamResponse, ExamProgress


@admin.register(ExamExercise)
class ExamExerciseAdmin(admin.ModelAdmin):
    list_display = ("title", "section", "cefr_level", "is_active", "order")
    list_filter = ("section", "cefr_level", "is_active")
    search_fields = ("title",)
    ordering = ("section", "cefr_level", "order")


@admin.register(ExamSession)
class ExamSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "section", "cefr_level", "mode", "score", "max_score", "started_at", "completed_at")
    list_filter = ("section", "cefr_level", "mode")
    raw_id_fields = ("user",)


@admin.register(ExamResponse)
class ExamResponseAdmin(admin.ModelAdmin):
    list_display = ("session", "exercise", "question_index", "is_correct", "score")
    raw_id_fields = ("session", "exercise")


@admin.register(ExamProgress)
class ExamProgressAdmin(admin.ModelAdmin):
    list_display = ("user", "section", "best_score_pct", "sessions_completed", "estimated_cefr_level")
    list_filter = ("section",)
    raw_id_fields = ("user",)
