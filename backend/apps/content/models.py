from django.db import models


class Topic(models.Model):
    name_fr = models.CharField(max_length=200)
    name_en = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    icon = models.CharField(max_length=100, blank=True, default="")
    order = models.PositiveIntegerField()
    difficulty_level = models.PositiveIntegerField()

    class Meta:
        db_table = "content_topics"
        ordering = ["order"]

    def __str__(self):
        return self.name_fr


class Lesson(models.Model):
    TYPE_CHOICES = [
        ("vocab", "Vocabulary"),
        ("grammar", "Grammar"),
        ("text", "Reading Text"),
    ]

    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="lessons")
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    title = models.CharField(max_length=300)
    content = models.JSONField(default=dict, blank=True)
    order = models.PositiveIntegerField()
    difficulty = models.PositiveIntegerField()

    class Meta:
        db_table = "content_lessons"
        ordering = ["order"]

    def __str__(self):
        return self.title


class Vocabulary(models.Model):
    GENDER_CHOICES = [
        ("m", "Masculine"),
        ("f", "Feminine"),
        ("n", "Neutral"),
        ("a", "Not Applicable"),
    ]

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="vocabulary")
    french = models.CharField(max_length=300)
    english = models.CharField(max_length=300)
    pronunciation = models.CharField(max_length=200, blank=True, default="")
    example_sentence = models.TextField(blank=True, default="")
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default="a")
    part_of_speech = models.CharField(max_length=50, blank=True, default="")
    audio_url = models.URLField(max_length=500, null=True, blank=True)

    class Meta:
        db_table = "content_vocabulary"
        verbose_name_plural = "vocabulary"

    def __str__(self):
        return f"{self.french} \u2014 {self.english}"


class GrammarRule(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="grammar_rules")
    title = models.CharField(max_length=300)
    explanation = models.TextField()
    formula = models.CharField(max_length=500, blank=True, default="")
    examples = models.JSONField(default=list, blank=True)
    exceptions = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "content_grammar_rules"

    def __str__(self):
        return self.title


class ReadingText(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="reading_texts")
    title = models.CharField(max_length=300)
    content_fr = models.TextField()
    content_en = models.TextField()
    vocabulary_highlights = models.JSONField(default=list, blank=True)
    comprehension_questions = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "content_reading_texts"

    def __str__(self):
        return self.title


class VideoLesson(models.Model):
    """A YouTube video attached to a lesson, with extracted transcript and content."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("ready", "Ready"),
        ("failed", "Failed"),
    ]

    lesson = models.OneToOneField(Lesson, on_delete=models.CASCADE, related_name="video")
    youtube_url = models.URLField(max_length=500)
    youtube_id = models.CharField(max_length=20, blank=True, default="")
    title = models.CharField(max_length=500, blank=True, default="")
    thumbnail_url = models.URLField(max_length=500, blank=True, default="")
    duration_seconds = models.PositiveIntegerField(default=0)
    transcript_fr = models.TextField(blank=True, default="")
    transcript_en = models.TextField(blank=True, default="")
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="pending")
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "content_video_lessons"

    def __str__(self):
        return f"Video: {self.title or self.youtube_url} ({self.lesson.title})"


class VideoVocabulary(models.Model):
    """A vocabulary item extracted from a video lesson transcript."""

    video_lesson = models.ForeignKey(
        VideoLesson, on_delete=models.CASCADE, related_name="vocabulary"
    )
    french = models.CharField(max_length=300)
    english = models.CharField(max_length=300)
    pronunciation = models.CharField(max_length=200, blank=True, default="")
    example_sentence = models.TextField(blank=True, default="")
    timestamp_seconds = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "content_video_vocabulary"
        verbose_name_plural = "video vocabulary"

    def __str__(self):
        return f"{self.french} — {self.english}"


class VideoExpression(models.Model):
    """An idiomatic expression or collocation extracted from a video lesson."""

    video_lesson = models.ForeignKey(
        VideoLesson, on_delete=models.CASCADE, related_name="expressions"
    )
    expression_fr = models.CharField(max_length=500)
    expression_en = models.CharField(max_length=500)
    context_sentence = models.TextField(blank=True, default="")
    timestamp_seconds = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "content_video_expressions"

    def __str__(self):
        return f"{self.expression_fr} — {self.expression_en}"


class Question(models.Model):
    TYPE_CHOICES = [
        ("mcq", "Multiple Choice"),
        ("fill_blank", "Fill in the Blank"),
        ("translate", "Translation"),
        ("match", "Matching"),
        ("listen", "Listening"),
        ("cloze", "Cloze"),
        ("conjugation", "Conjugation"),
    ]

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="questions")
    type = models.CharField(max_length=15, choices=TYPE_CHOICES)
    prompt = models.TextField()
    correct_answer = models.TextField()
    wrong_answers = models.JSONField(default=list, blank=True)
    explanation = models.TextField(blank=True, default="")
    difficulty = models.PositiveIntegerField()

    class Meta:
        db_table = "content_questions"

    def __str__(self):
        return self.prompt[:80]
