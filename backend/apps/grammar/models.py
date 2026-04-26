from django.conf import settings
from django.db import models


CEFR_CHOICES = [
    ("A1", "A1"), ("A2", "A2"), ("B1", "B1"),
    ("B2", "B2"), ("C1", "C1"), ("C2", "C2"),
]

DRILL_TYPE_CHOICES = [
    ("fill_blank",   "Fill in the blank"),
    ("mcq",          "Multiple choice"),
    ("transform",    "Transform the sentence"),
    ("error_detect", "Spot the error"),
    ("reorder",      "Reorder the words"),
]


class GrammarCategory(models.Model):
    """Top-level taxonomy: Tenses, Pronouns, Articles, etc."""
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, max_length=120)
    description = models.TextField(blank=True, default="")
    icon = models.CharField(max_length=10, blank=True, default="")  # emoji
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "grammar_categories"
        verbose_name_plural = "grammar categories"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class GrammarTopic(models.Model):
    """A single grammar concept the user can study and drill."""
    category = models.ForeignKey(GrammarCategory, on_delete=models.CASCADE, related_name="topics")
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    cefr_level = models.CharField(max_length=2, choices=CEFR_CHOICES, default="A2")
    summary = models.CharField(max_length=300, blank=True, default="")  # one-liner
    explanation = models.TextField()  # markdown
    formula = models.CharField(max_length=400, blank=True, default="")
    examples = models.JSONField(default=list, blank=True)
    # examples format: [{"fr": "...", "en": "..."}, ...]
    exceptions = models.JSONField(default=list, blank=True)
    common_mistakes = models.JSONField(default=list, blank=True)
    # common_mistakes format: [{"wrong": "...", "right": "...", "note": "..."}, ...]
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "grammar_topics"
        ordering = ["category__order", "order", "cefr_level"]

    def __str__(self):
        return f"[{self.cefr_level}] {self.title}"


class GrammarDrillItem(models.Model):
    """A single drill question for a topic."""
    topic = models.ForeignKey(GrammarTopic, on_delete=models.CASCADE, related_name="drills")
    type = models.CharField(max_length=15, choices=DRILL_TYPE_CHOICES, default="fill_blank")
    prompt = models.TextField()
    correct_answer = models.TextField()
    options = models.JSONField(default=list, blank=True)  # for MCQ
    explanation = models.TextField(blank=True, default="")
    difficulty = models.PositiveSmallIntegerField(default=1)  # 1-5

    class Meta:
        db_table = "grammar_drill_items"

    def __str__(self):
        return f"{self.topic.title} — {self.type}: {self.prompt[:50]}"


class GrammarMastery(models.Model):
    """Per-user, per-topic state. SM-2-flavoured spaced repetition."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="grammar_mastery")
    topic = models.ForeignKey(GrammarTopic, on_delete=models.CASCADE, related_name="mastery_records")
    attempts = models.PositiveIntegerField(default=0)
    correct_count = models.PositiveIntegerField(default=0)
    mastery_score = models.FloatField(default=0)  # 0-100
    last_drilled_at = models.DateTimeField(null=True, blank=True)
    next_review_at = models.DateTimeField(null=True, blank=True)
    interval_days = models.FloatField(default=1.0)
    ease_factor = models.FloatField(default=2.5)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "grammar_mastery"
        verbose_name_plural = "grammar mastery records"
        constraints = [
            models.UniqueConstraint(fields=["user", "topic"], name="unique_grammar_mastery"),
        ]

    def __str__(self):
        return f"{self.user.username} — {self.topic.title} ({self.mastery_score:.0f})"

    @property
    def status(self):
        if self.attempts == 0: return "not_started"
        if self.mastery_score >= 80 and self.attempts >= 10: return "mastered"
        if self.mastery_score >= 50: return "practiced"
        return "learning"


class GrammarSession(models.Model):
    """A drill session — multiple items on a topic (or mixed for diagnostic)."""
    MODE_CHOICES = [("drill", "Drill"), ("diagnostic", "Diagnostic")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="grammar_sessions")
    topic = models.ForeignKey(GrammarTopic, on_delete=models.CASCADE, null=True, blank=True, related_name="sessions")
    mode = models.CharField(max_length=12, choices=MODE_CHOICES, default="drill")
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    score = models.PositiveIntegerField(default=0)
    total = models.PositiveIntegerField(default=0)
    mastery_before = models.FloatField(null=True, blank=True)
    mastery_after = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "grammar_sessions"
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.user.username} — {self.mode} {self.score}/{self.total}"


class GrammarAnswer(models.Model):
    """A single answer within a session."""
    session = models.ForeignKey(GrammarSession, on_delete=models.CASCADE, related_name="answers")
    drill_item = models.ForeignKey(GrammarDrillItem, on_delete=models.SET_NULL, null=True, related_name="answers")
    user_answer = models.TextField(blank=True, default="")
    is_correct = models.BooleanField()
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "grammar_answers"
