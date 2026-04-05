from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "telegram_id", "target_level", "is_active")
    list_filter = ("target_level", "is_active", "is_staff")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Lingaru", {"fields": ("telegram_id", "native_language", "target_level", "daily_goal_minutes")}),
    )
