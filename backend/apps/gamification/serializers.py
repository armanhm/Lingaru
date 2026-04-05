from rest_framework import serializers

from .constants import LEVEL_THRESHOLDS
from .models import Badge, UserBadge, UserStats, XPTransaction
from .services import get_level


class UserStatsSerializer(serializers.ModelSerializer):
    level_name = serializers.SerializerMethodField()
    rank = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = UserStats
        fields = (
            "total_xp", "level", "level_name",
            "current_streak", "longest_streak",
            "streak_freeze_available", "last_active_date",
            "rank",
        )

    def get_level_name(self, obj):
        name, _ = get_level(obj.total_xp)
        return name


class BadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = ("id", "name", "description", "icon", "criteria_type", "criteria_value")


class UserBadgeSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="badge.name")
    description = serializers.CharField(source="badge.description")
    icon = serializers.CharField(source="badge.icon")

    class Meta:
        model = UserBadge
        fields = ("id", "name", "description", "icon", "earned_at")


class XPTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = XPTransaction
        fields = ("id", "activity_type", "xp_amount", "source_id", "created_at")


class LeaderboardEntrySerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username")

    class Meta:
        model = UserStats
        fields = ("username", "total_xp", "level", "current_streak")
