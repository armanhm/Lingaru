from django.contrib import admin

from .models import QuizAnswer, QuizSession


class QuizAnswerInline(admin.TabularInline):
    model = QuizAnswer
    extra = 0
    readonly_fields = ("question", "user_answer", "is_correct", "answered_at")


@admin.register(QuizSession)
class QuizSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "lesson", "score", "total_questions", "started_at", "completed_at")
    list_filter = ("completed_at",)
    search_fields = ("user__username", "lesson__title")
    inlines = [QuizAnswerInline]
    readonly_fields = ("started_at",)


@admin.register(QuizAnswer)
class QuizAnswerAdmin(admin.ModelAdmin):
    list_display = ("session", "question", "user_answer", "is_correct", "answered_at")
    list_filter = ("is_correct",)
