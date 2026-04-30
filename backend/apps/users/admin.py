from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.action(description="Approve selected accounts (set is_active=True)")
def approve_users(modeladmin, request, queryset):
    updated = queryset.filter(is_active=False).update(is_active=True)
    messages.success(request, f"Approved {updated} account(s).")


@admin.action(description="Suspend selected accounts (set is_active=False)")
def suspend_users(modeladmin, request, queryset):
    # Don't let an admin lock themselves out via bulk-suspend.
    qs = queryset.exclude(pk=request.user.pk).filter(is_active=True)
    updated = qs.update(is_active=False)
    messages.warning(request, f"Suspended {updated} account(s).")


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = (
        "username", "email", "is_active", "is_staff",
        "target_level", "telegram_id", "date_joined",
    )
    list_filter   = ("is_active", "is_staff", "target_level")
    # Pending approvals (is_active=False) come first — easy to spot.
    ordering      = ("is_active", "-date_joined")
    list_per_page = 50
    actions       = (approve_users, suspend_users)

    fieldsets = BaseUserAdmin.fieldsets + (
        ("Lingaru", {"fields": ("telegram_id", "native_language", "target_level", "daily_goal_minutes")}),
    )
