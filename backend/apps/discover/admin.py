from django.contrib import admin

from .models import DiscoverCard, UserDiscoverHistory


@admin.register(DiscoverCard)
class DiscoverCardAdmin(admin.ModelAdmin):
    list_display = ("id", "type", "title", "generated_at", "expires_at")
    list_filter = ("type",)
    search_fields = ("title", "summary")


@admin.register(UserDiscoverHistory)
class UserDiscoverHistoryAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "card", "seen_at", "interacted")
    list_filter = ("interacted",)
