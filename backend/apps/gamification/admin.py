from django.contrib import admin

from .models import Badge, UserBadge, UserStats, XPTransaction


@admin.register(UserStats)
class UserStatsAdmin(admin.ModelAdmin):
    list_display = ("user", "total_xp", "level", "current_streak", "longest_streak", "last_active_date")
    list_filter = ("level",)
    search_fields = ("user__username",)
    readonly_fields = ("user",)


@admin.register(XPTransaction)
class XPTransactionAdmin(admin.ModelAdmin):
    list_display = ("user", "activity_type", "xp_amount", "source_id", "created_at")
    list_filter = ("activity_type",)
    search_fields = ("user__username",)
    date_hierarchy = "created_at"


@admin.register(Badge)
class BadgeAdmin(admin.ModelAdmin):
    list_display = ("name", "criteria_type", "criteria_value", "icon")
    list_filter = ("criteria_type",)


@admin.register(UserBadge)
class UserBadgeAdmin(admin.ModelAdmin):
    list_display = ("user", "badge", "earned_at")
    list_filter = ("badge",)
    search_fields = ("user__username",)
