from django.contrib import admin

from .models import Agent, AgentRun


@admin.register(Agent)
class AgentAdmin(admin.ModelAdmin):
    list_display  = ("name", "slug", "emoji", "mode", "output_shape", "order", "is_active")
    list_filter   = ("mode", "output_shape", "is_active")
    search_fields = ("name", "slug", "tagline")
    list_editable = ("order", "is_active")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(AgentRun)
class AgentRunAdmin(admin.ModelAdmin):
    list_display = ("user", "agent", "conversation", "started_at")
    list_filter  = ("agent",)
    search_fields = ("user__username", "agent__slug")
    readonly_fields = ("started_at",)
