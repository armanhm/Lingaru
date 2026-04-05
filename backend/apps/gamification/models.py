from django.conf import settings
from django.db import models


class UserStats(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="stats",
    )
    total_xp = models.PositiveIntegerField(default=0)
    level = models.PositiveIntegerField(default=0)
    current_streak = models.PositiveIntegerField(default=0)
    longest_streak = models.PositiveIntegerField(default=0)
    streak_freeze_available = models.BooleanField(default=False)
    last_active_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "gamification_user_stats"
        verbose_name_plural = "User stats"

    def __str__(self):
        return f"{self.user.username} — {self.total_xp} XP (level {self.level})"


class XPTransaction(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="xp_transactions",
    )
    activity_type = models.CharField(max_length=50)
    xp_amount = models.PositiveIntegerField()
    source_id = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gamification_xp_transactions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} +{self.xp_amount} XP ({self.activity_type})"


class Badge(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField()
    icon = models.CharField(max_length=50)
    criteria_type = models.CharField(max_length=50)
    criteria_value = models.PositiveIntegerField()

    class Meta:
        db_table = "gamification_badges"

    def __str__(self):
        return self.name


class UserBadge(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="earned_badges",
    )
    badge = models.ForeignKey(
        Badge,
        on_delete=models.CASCADE,
        related_name="holders",
    )
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gamification_user_badges"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "badge"],
                name="unique_user_badge",
            ),
        ]

    def __str__(self):
        return f"{self.user.username} — {self.badge.name}"
