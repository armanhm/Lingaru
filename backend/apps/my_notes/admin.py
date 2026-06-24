from django.contrib import admin

from .models import MyNote


@admin.register(MyNote)
class MyNoteAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "title",
        "kind",
        "language",
        "is_favorite",
        "is_public",
        "updated_at",
    )
    list_filter = ("kind", "language", "is_favorite", "is_public")
    search_fields = ("title", "body_markdown", "user__username")
    readonly_fields = ("created_at", "updated_at")
