from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    LEVEL_CHOICES = [
        ("A1", "A1 - Beginner"),
        ("A2", "A2 - Elementary"),
        ("B1", "B1 - Intermediate"),
        ("B2", "B2 - Upper Intermediate"),
        ("C1", "C1 - Advanced"),
        ("C2", "C2 - Proficiency"),
    ]

    email = models.EmailField(unique=True)
    telegram_id = models.BigIntegerField(unique=True, null=True, blank=True)
    native_language = models.CharField(max_length=10, default="en")
    target_level = models.CharField(max_length=2, choices=LEVEL_CHOICES, default="B2")
    daily_goal_minutes = models.PositiveIntegerField(default=15)
    preferences = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.username
