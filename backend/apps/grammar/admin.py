from django.contrib import admin

from .models import (
    GrammarAnswer,
    GrammarCategory,
    GrammarDrillItem,
    GrammarMastery,
    GrammarSession,
    GrammarTopic,
)


@admin.register(GrammarCategory)
class GrammarCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "icon", "order")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(GrammarTopic)
class GrammarTopicAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "cefr_level", "is_active", "order")
    list_filter = ("category", "cefr_level", "is_active")
    search_fields = ("title", "summary")
    prepopulated_fields = {"slug": ("title",)}


@admin.register(GrammarDrillItem)
class GrammarDrillItemAdmin(admin.ModelAdmin):
    list_display = ("topic", "type", "prompt", "difficulty")
    list_filter = ("type", "topic__category")
    search_fields = ("prompt", "correct_answer")


@admin.register(GrammarMastery)
class GrammarMasteryAdmin(admin.ModelAdmin):
    list_display = ("user", "topic", "mastery_score", "attempts", "next_review_at")
    list_filter = ("topic__category",)
    raw_id_fields = ("user", "topic")


@admin.register(GrammarSession)
class GrammarSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "topic", "mode", "score", "total", "completed_at")
    list_filter = ("mode",)
    raw_id_fields = ("user", "topic")


@admin.register(GrammarAnswer)
class GrammarAnswerAdmin(admin.ModelAdmin):
    list_display = ("session", "drill_item", "is_correct", "answered_at")
    raw_id_fields = ("session", "drill_item")
