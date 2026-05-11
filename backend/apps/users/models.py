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

    # Three audience-tailored personas of the same product. Switching mode
    # changes the dashboard, the visible nav items, and (in Phase 2) the
    # visual theme. `mode = None` means "user hasn't been onboarded yet" and
    # triggers the picker on next login. See frontend/src/lib/modeConfig.js
    # for the per-mode nav and landing routes.
    MODE_CHOICES = [
        ("general", "General Learner"),
        ("exam", "Exam Prep (TCF / TEF)"),
        ("agentic", "Agentic, assistant first"),
    ]

    # Self-reported CEFR level. We accept "unsure" so a user who'd rather
    # take a placement test (Phase 4) doesn't have to guess. Distinct from
    # `target_level` (where they want to GET to), this is where they ARE.
    PROFICIENCY_CHOICES = [
        ("A1", "A1 - Beginner"),
        ("A2", "A2 - Elementary"),
        ("B1", "B1 - Intermediate"),
        ("B2", "B2 - Upper Intermediate"),
        ("C1", "C1 - Advanced"),
        ("C2", "C2 - Proficiency"),
        ("unsure", "Pas sûr / placement test"),
    ]

    email = models.EmailField(unique=True)
    telegram_id = models.BigIntegerField(unique=True, null=True, blank=True)
    native_language = models.CharField(max_length=10, default="en")
    target_level = models.CharField(max_length=2, choices=LEVEL_CHOICES, default="B2")
    daily_goal_minutes = models.PositiveIntegerField(default=15)
    preferences = models.JSONField(default=dict, blank=True)
    mode = models.CharField(
        max_length=12,
        choices=MODE_CHOICES,
        null=True,
        blank=True,
        help_text="Audience persona. Null means the user hasn't been onboarded.",
    )
    proficiency_level = models.CharField(
        max_length=8,
        choices=PROFICIENCY_CHOICES,
        null=True,
        blank=True,
        help_text="Self-reported CEFR level. Distinct from target_level.",
    )
    UI_LANGUAGE_CHOICES = [
        ("en", "English"),
        ("fr", "Français"),
    ]
    ui_language = models.CharField(
        max_length=4,
        choices=UI_LANGUAGE_CHOICES,
        null=True,
        blank=True,
        help_text=(
            "Language for the app chrome (nav, settings, buttons). Distinct "
            "from native_language (the language the user thinks in) and from "
            "the language being learned (always French). Null means: detect "
            "from the browser on first load."
        ),
    )

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.username
