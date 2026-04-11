from django.db import models


class DictionaryCache(models.Model):
    """Cache LLM-generated dictionary/conjugation results for instant repeat lookups."""

    LOOKUP = "lookup"
    CONJUGATION = "conjugation"
    KIND_CHOICES = [(LOOKUP, "Lookup"), (CONJUGATION, "Conjugation")]

    kind = models.CharField(max_length=12, choices=KIND_CHOICES)
    key = models.CharField(max_length=120, db_index=True)
    result = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("kind", "key")

    def __str__(self):
        return f"{self.kind}:{self.key}"
