from django.conf import settings
from django.db import models

from apps.users.constants import LANGUAGE_CHOICES

KIND_CHOICES = [
    ("grammar", "Grammar"),
    ("dialog", "Dialog"),
    ("vocabulary", "Vocabulary"),
    ("listening", "Listening"),
    ("writing", "Writing"),
    ("reading", "Reading"),
    ("freeform", "Freeform"),
]


class MyNote(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="my_notes",
    )
    title = models.CharField(max_length=200)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default="freeform")
    body_markdown = models.TextField(blank=True, default="")
    tags = models.JSONField(default=list, blank=True)
    language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default="fr")
    is_favorite = models.BooleanField(default=False)
    is_public = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "my_notes_mynote"
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["user", "-updated_at"]),
            models.Index(fields=["user", "kind"]),
            models.Index(fields=["is_public", "-updated_at"]),
        ]

    def __str__(self):
        return f"{self.user_id}: {self.title}"
