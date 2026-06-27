from django.db import models


class DictionaryCache(models.Model):
    """Cache LLM-generated dictionary/conjugation results for instant repeat lookups."""

    LOOKUP = "lookup"
    CONJUGATION = "conjugation"
    KIND_CHOICES = [(LOOKUP, "Lookup"), (CONJUGATION, "Conjugation")]

    SEED = "seed"
    RUNTIME = "runtime"
    SOURCE_CHOICES = [(SEED, "Seed"), (RUNTIME, "Runtime")]

    CEFR_CHOICES = [
        ("A1", "A1"),
        ("A2", "A2"),
        ("B1", "B1"),
        ("B2", "B2"),
        ("C1", "C1"),
        ("C2", "C2"),
    ]

    kind = models.CharField(max_length=12, choices=KIND_CHOICES)
    key = models.CharField(max_length=120, db_index=True)
    result = models.JSONField()
    cefr_level = models.CharField(
        max_length=2, choices=CEFR_CHOICES, null=True, blank=True, db_index=True
    )
    source = models.CharField(max_length=16, choices=SOURCE_CHOICES, default=RUNTIME, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("kind", "key")

    def __str__(self):
        return f"{self.kind}:{self.key}"
