from django.conf import settings
from django.db import models
from django.utils import timezone


class DiscoverCard(models.Model):
    TYPE_CHOICES = [
        ("news", "News"),
        ("word", "Word of the Day"),
        ("grammar", "Grammar Tip"),
        ("trivia", "Trivia"),
    ]

    NEWS_TOPICS = [
        ("politics",  "Politics"),
        ("sports",    "Sports"),
        ("culture",   "Culture"),
        ("economy",   "Economy"),
        ("science",   "Science"),
        ("tech",      "Technology"),
        ("society",   "Society"),
        ("environ",   "Environment"),
        ("world",     "World"),
        ("misc",      "Miscellaneous"),
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
        return f"{self.user.username} — {self.card.title}"
