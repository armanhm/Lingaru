from django.contrib import admin
from .models import AudioClip


@admin.register(AudioClip)
class AudioClipAdmin(admin.ModelAdmin):
    list_display = ("id", "text_content_short", "language", "provider", "created_at")
    list_filter = ("language", "provider")
    search_fields = ("text_content",)

    def text_content_short(self, obj):
        return obj.text_content[:60]
    text_content_short.short_description = "Text"
