from django.contrib import admin

from .models import MemoryExtractionLog, MemoryNote


@admin.register(MemoryNote)
class MemoryNoteAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "category", "source", "is_active", "updated_at")
    list_filter = ("category", "source", "is_active")
    search_fields = ("content", "user__username", "user__email")
    autocomplete_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(MemoryExtractionLog)
class MemoryExtractionLogAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "extracted", "note", "message", "created_at")
    list_filter = ("extracted",)
    search_fields = ("user__username", "raw_output")
    autocomplete_fields = ("user", "note", "message")
    readonly_fields = ("created_at",)
