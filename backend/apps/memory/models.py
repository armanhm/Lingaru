from django.conf import settings
from django.db import models


class MemoryNote(models.Model):
    """A single fact the user wants the assistant to remember.

    Authored via the Settings > Memory tab (source="user") or
    auto-extracted by services.memory.maybe_extract_note from a chat
    turn (source="assistant_detected"). Only the user can edit or
    delete; the assistant can only propose new notes.
    """

    SOURCE_CHOICES = [
        ("user", "User-authored"),
        ("assistant_detected", "Detected by assistant"),
    ]

    CATEGORY_CHOICES = [
        ("goal", "Goal"),
        ("preference", "Preference"),
        ("background", "Background"),
        ("weakness", "Weakness"),
        ("other", "Other"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memory_notes",
    )
    content = models.TextField()
    category = models.CharField(max_length=16, choices=CATEGORY_CHOICES, default="other")
    source = models.CharField(max_length=24, choices=SOURCE_CHOICES, default="user")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "memory_notes"
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["user", "is_active", "-updated_at"])]

    def __str__(self):
        return f"{self.user_id}: {self.content[:60]}"


class MemoryExtractionLog(models.Model):
    """Audit trail for auto-detected notes. Enables:
    (a) showing the user *why* a note was saved (link back to the message),
    (b) debugging false positives,
    (c) capping auto-extraction at N per rolling 24h.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memory_extraction_logs",
    )
    message = models.ForeignKey(
        "assistant.Message",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="memory_extraction_logs",
    )
    note = models.ForeignKey(
        MemoryNote,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="extraction_logs",
    )
    extracted = models.BooleanField()
    raw_output = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "memory_extraction_log"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "-created_at"])]

    def __str__(self):
        return f"log#{self.pk} user={self.user_id} extracted={self.extracted}"
