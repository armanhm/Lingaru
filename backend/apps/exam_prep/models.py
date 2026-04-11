from django.conf import settings
from django.db import models


SECTION_CHOICES = [
    ("CO", "Compréhension orale"),
    ("CE", "Compréhension écrite"),
    ("EE", "Expression écrite"),
    ("EO", "Expression orale"),
]

CEFR_CHOICES = [
    ("A1", "A1 — Beginner"),
    ("A2", "A2 — Elementary"),
    ("B1", "B1 — Intermediate"),
    ("B2", "B2 — Upper Intermediate"),
    ("C1", "C1 — Advanced"),
    ("C2", "C2 — Proficiency"),
]

MODE_CHOICES = [
    ("practice", "Practice"),
    ("mock", "Mock Exam"),
]


class ExamExercise(models.Model):
    """A single exam exercise — text passage + questions (CE/CO) or writing/speaking prompt (EE/EO)."""

    section = models.CharField(max_length=2, choices=SECTION_CHOICES)
    cefr_level = models.CharField(max_length=2, choices=CEFR_CHOICES)
    title = models.CharField(max_length=300)
    instructions_fr = models.TextField(blank=True, default="")
    instructions_en = models.TextField(blank=True, default="")
    content = models.JSONField(default=dict)
    # CE: {text_fr, text_en, questions: [{prompt, options, correct_answer, explanation}]}
    # CO: {passage_fr, questions: [{prompt, options, correct_answer, explanation}]}
    # EE: {prompt_fr, prompt_en, word_limit, rubric}
    # EO: {prompt_fr, prompt_en, duration_seconds, rubric}
    time_limit_seconds = models.PositiveIntegerField(default=0)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "exam_prep_exercises"
        ordering = ["order", "cefr_level"]

    def __str__(self):
        return f"[{self.section}/{self.cefr_level}] {self.title}"


class ExamSession(models.Model):
    """A user's attempt at a set of exam exercises."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="exam_sessions")
    section = models.CharField(max_length=2, choices=SECTION_CHOICES)
    cefr_level = models.CharField(max_length=2, choices=CEFR_CHOICES)
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default="practice")
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    score = models.FloatField(null=True, blank=True)
    max_score = models.FloatField(null=True, blank=True)
    time_limit_seconds = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "exam_prep_sessions"
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.user.username} — {self.section}/{self.cefr_level} ({self.mode})"


class ExamResponse(models.Model):
    """A single answer within an exam session."""

    session = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name="responses")
    exercise = models.ForeignKey(ExamExercise, on_delete=models.CASCADE, related_name="responses")
    question_index = models.PositiveIntegerField(default=0)
    user_answer = models.TextField()
    is_correct = models.BooleanField(null=True, blank=True)
    ai_feedback = models.TextField(blank=True, default="")
    score = models.FloatField(default=0)
    max_score = models.FloatField(default=1)
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "exam_prep_responses"

    def __str__(self):
        return f"Response #{self.question_index} in session {self.session_id}"


class ExamProgress(models.Model):
    """Aggregated progress per user per section."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="exam_progress")
    section = models.CharField(max_length=2, choices=SECTION_CHOICES)
    best_score_pct = models.FloatField(default=0)
    exercises_completed = models.PositiveIntegerField(default=0)
    sessions_completed = models.PositiveIntegerField(default=0)
    estimated_cefr_level = models.CharField(max_length=2, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "exam_prep_progress"
        constraints = [
            models.UniqueConstraint(fields=["user", "section"], name="unique_exam_progress_per_section"),
        ]

    def __str__(self):
        return f"{self.user.username} — {self.section}: {self.estimated_cefr_level or 'N/A'}"
