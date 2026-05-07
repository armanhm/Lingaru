from django.contrib import admin

from .models import MistakeEntry, SRSCard


@admin.register(SRSCard)
class SRSCardAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "vocabulary",
        "ease_factor",
        "interval_days",
        "next_review_at",
        "repetitions",
    )
    list_filter = ("user",)
    raw_id_fields = ("user", "vocabulary")


@admin.register(MistakeEntry)
class MistakeEntryAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "user_answer",
        "correct_answer",
        "mistake_type",
        "created_at",
        "reviewed",
    )
    list_filter = ("mistake_type", "reviewed")
    raw_id_fields = ("user", "question")
