from django.conf import settings
from django.db import models


class AudioClip(models.Model):
    PROVIDER_CHOICES = [
        ("gtts", "Google TTS (gTTS)"),
    ]

    text_content = models.TextField()
    audio_file = models.FileField(upload_to="audio/")
    language = models.CharField(max_length=10, default="fr")
    provider = models.CharField(
        max_length=20, choices=PROVIDER_CHOICES, default="gtts",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "media_audio_clips"
        constraints = [
            models.UniqueConstraint(
                fields=["text_content", "language"],
                name="unique_text_language",
            ),
        ]

    def __str__(self):
        return f"AudioClip({self.language}): {self.text_content[:50]}"


class PronunciationAttempt(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pronunciation_attempts",
    )
    vocabulary = models.ForeignKey(
        "content.Vocabulary",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pronunciation_attempts",
    )
    expected_text = models.TextField()
    audio_file = models.FileField(upload_to="pronunciation/")
    transcription = models.TextField(blank=True, default="")
    accuracy_score = models.FloatField(default=0.0)
    feedback = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "media_pronunciation_attempts"
        ordering = ["-created_at"]

    def __str__(self):
        return f"PronunciationAttempt(user={self.user_id}, score={self.accuracy_score})"
