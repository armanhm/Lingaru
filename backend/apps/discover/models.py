from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.users.constants import LANGUAGE_CHOICES


class DiscoverCard(models.Model):
    TYPE_CHOICES = [
        ("news", "News"),
        ("word", "Word of the Day"),
        ("grammar", "Grammar Tip"),
        ("trivia", "Trivia"),
    ]

    NEWS_TOPICS = [
        ("politics", "Politics"),
        ("sports", "Sports"),
        ("culture", "Culture"),
        ("economy", "Economy"),
        ("science", "Science"),
        ("tech", "Technology"),
        ("society", "Society"),
        ("environ", "Environment"),
        ("world", "World"),
        ("misc", "Miscellaneous"),
    ]

    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    title = models.CharField(max_length=300)
    summary = models.TextField(blank=True, default="")
    content_json = models.JSONField(default=dict)
    source_url = models.URLField(max_length=500, null=True, blank=True)
    image_url = models.URLField(max_length=500, null=True, blank=True)
    generated_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)

    # News-specific (also reusable for other types)
    topic = models.CharField(max_length=12, choices=NEWS_TOPICS, blank=True, default="")
    level = models.CharField(max_length=2, blank=True, default="")  # A1..C2
    language = models.CharField(
        max_length=8,
        choices=LANGUAGE_CHOICES,
        default="fr",
        db_index=True,
    )

    class Meta:
        db_table = "discover_cards"
        ordering = ["-generated_at"]

    def __str__(self):
        return f"[{self.type}] {self.title}"

    @property
    def is_expired(self):
        if self.expires_at is None:
            return False
        return timezone.now() > self.expires_at


class TriviaTemplate(models.Model):
    """Hand-authored trivia bank loaded from `data/discover_trivia_*.json`.

    The daily trivia card is picked from this bank (random unseen for the
    requesting user) instead of being LLM-generated. Each template can be
    materialized into a DiscoverCard at pick time; the template itself is
    long-lived (no expires_at).
    """

    slug = models.SlugField(max_length=100, db_index=True)
    language = models.CharField(max_length=8, choices=LANGUAGE_CHOICES, default="fr", db_index=True)
    title = models.CharField(max_length=300)
    summary = models.TextField(blank=True, default="")
    fact_fr = models.TextField()
    fact_en = models.TextField(blank=True, default="")
    # Optional CEFR hint so the picker can prefer level-appropriate facts
    # once a user's target_level is known.
    level = models.CharField(max_length=2, blank=True, default="")
    # Loose category for future filtering (history, geography, language,
    # cuisine, etc.). Free-form text so the JSON can grow categories
    # without a schema migration.
    category = models.CharField(max_length=40, blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "discover_trivia_templates"
        constraints = [
            models.UniqueConstraint(
                fields=["slug", "language"], name="unique_trivia_slug_per_lang"
            ),
        ]
        ordering = ["language", "slug"]

    def __str__(self):
        return f"[{self.language}/{self.category or 'misc'}] {self.title}"


class UserTriviaSeen(models.Model):
    """Tracks which TriviaTemplates a user has already seen, so the daily
    picker can prefer unseen ones and cycle back only when the bank is
    exhausted for that user.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="trivia_seen",
    )
    template = models.ForeignKey(
        TriviaTemplate,
        on_delete=models.CASCADE,
        related_name="seen_by",
    )
    seen_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "discover_user_trivia_seen"
        constraints = [
            models.UniqueConstraint(fields=["user", "template"], name="unique_user_trivia_seen"),
        ]


class UserDiscoverHistory(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="discover_history",
    )
    card = models.ForeignKey(
        DiscoverCard,
        on_delete=models.CASCADE,
        related_name="view_history",
    )
    seen_at = models.DateTimeField(auto_now_add=True)
    interacted = models.BooleanField(default=False)

    class Meta:
        db_table = "discover_user_history"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "card"],
                name="unique_user_card_history",
            ),
        ]

    def __str__(self):
        return f"{self.user.username}, {self.card.title}"
