from django.conf import settings
from django.db import models


class QuizSession(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="quiz_sessions",
    )
    lesson = models.ForeignKey(
        "content.Lesson",
        on_delete=models.CASCADE,
        related_name="quiz_sessions",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    score = models.PositiveIntegerField(null=True, blank=True)
    total_questions = models.PositiveIntegerField()

    class Meta:
        db_table = "practice_quiz_sessions"
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.user.username} — {self.lesson.title}"


class QuizAnswer(models.Model):
    session = models.ForeignKey(
        QuizSession,
        on_delete=models.CASCADE,
        related_name="answers",
    )
    question = models.ForeignKey(
        "content.Question",
        on_delete=models.CASCADE,
        related_name="quiz_answers",
    )
    user_answer = models.TextField()
    is_correct = models.BooleanField()
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "practice_quiz_answers"
        constraints = [
            models.UniqueConstraint(
                fields=["session", "question"],
                name="unique_answer_per_question",
            ),
        ]

    def __str__(self):
        status = "correct" if self.is_correct else "wrong"
        return f"Q{self.question_id} — {self.user_answer} ({status})"
