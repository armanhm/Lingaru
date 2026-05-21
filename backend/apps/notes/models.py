from django.db import models

from apps.users.constants import LANGUAGE_CHOICES


class Note(models.Model):
    note_number = models.PositiveIntegerField()
    date = models.DateField()
    title = models.CharField(max_length=200, blank=True, default="")
    language = models.CharField(
        max_length=2,
        choices=LANGUAGE_CHOICES,
        default="en",
        db_index=True,
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notes_note"
        ordering = ["-note_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["language", "note_number"],
                name="notes_unique_lang_number",
            ),
        ]
        indexes = [
            models.Index(fields=["language", "-note_number"]),
        ]

    def __str__(self):
        return f"Note {self.note_number} ({self.language})"


class NoteWord(models.Model):
    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name="words")
    word = models.CharField(max_length=200)
    definition = models.TextField(blank=True, default="")
    example = models.TextField(blank=True, default="")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "notes_word"
        ordering = ["order", "id"]
        indexes = [models.Index(fields=["note", "order"])]

    def __str__(self):
        return self.word
