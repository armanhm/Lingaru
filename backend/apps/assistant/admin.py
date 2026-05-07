from django.contrib import admin

from .models import Conversation, ImageQuery, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ("role", "content", "provider", "tokens_used", "created_at")


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "context", "created_at")
    list_filter = ("created_at",)
    search_fields = ("title", "user__username")
    inlines = [MessageInline]
    readonly_fields = ("created_at",)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("conversation", "role", "provider", "tokens_used", "created_at")
    list_filter = ("role", "provider")
    search_fields = ("content",)
    readonly_fields = ("created_at",)


@admin.register(ImageQuery)
class ImageQueryAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "question", "created_at")
    list_filter = ("created_at",)
    raw_id_fields = ("user", "conversation")
