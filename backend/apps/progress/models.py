from django.conf import settings
from django.db import models
from django.utils import timezone


class SRSCard(models.Model):
    """A spaced-repetition card linking a user to a vocabulary item.

    Uses the SM-2 algorithm fields: ease_factor, interval_days,
    repetitions, next_review_at, last_quality.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="srs_cards",
    )
    vocabulary = models.ForeignKey(
        "content.Vocabulary",
        on_delete=models.CASCADE,
        related_name="srs_cards",
    )
    ease_factor = models.FloatField(default=2.5)
    interval_days = models.PositiveIntegerField(default=0)
    next_review_at = models.DateTimeField(default=timezone.now)
    repetitions = models.PositiveIntegerField(default=0)
    last_quality = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "progress_srs_cards"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "vocabulary"],
                name="unique_srs_card_per_user_vocab",
            ),
        ]
        ordering = ["next_review_at"]

    def __str__(self):
        return f"SRS: {self.user.username} — {self.vocabulary.french}"


class MistakeEntry(models.Model):
    """Records a single mistake made by a user during practice."""

    MISTAKE_TYPE_CHOICES = [
        ("gender", "Gender"),
        ("conjugation", "Conjugation"),
        ("preposition", "Preposition"),
        ("spelling", "Spelling"),
        ("other", "Other"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mistakes",
    )
    question = models.ForeignKey(
        "content.Question",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mistakes",
    )
    user_answer = models.TextField()
    correct_answer = models.TextField()
    mistake_type = models.CharField(
        max_length=15,
        choices=MISTAKE_TYPE_CHOICES,
        default="other",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed = models.BooleanField(default=False)

    class Meta:
        db_table = "progress_mistakes"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Mistake: {self.user_answer} (correct: {self.correct_answer})"


class LessonCompletion(models.Model):
    """Records when a user completes a lesson (quiz passed)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lesson_completions",
    )
    lesson = models.ForeignKey(
        "content.Lesson",
        on_delete=models.CASCADE,
        related_name="completions",
    )
    completed_at = models.DateTimeField(auto_now_add=True)
    score = models.PositiveIntegerField(default=0)
    total_questions = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "progress_lesson_completions"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "lesson"],
                name="unique_lesson_completion_per_user",
            ),
        ]
        ordering = ["-completed_at"]

    def __str__(self):
        return f"{self.user.username} completed {self.lesson.title}"
