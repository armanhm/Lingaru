from django.conf import settings
from django.db import models


class Conversation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations",
    )
    title = models.CharField(max_length=300)
    context = models.CharField(max_length=200, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assistant_conversations"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Message(models.Model):
    ROLE_CHOICES = [
        ("user", "User"),
        ("assistant", "Assistant"),
    ]

    PROVIDER_CHOICES = [
        ("gemini", "Google Gemini"),
        ("groq", "Groq"),
    ]

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    provider = models.CharField(
        max_length=10,
        choices=PROVIDER_CHOICES,
        null=True,
        blank=True,
    )
    tokens_used = models.PositiveIntegerField(default=0)
    # Structured render blocks attached to an assistant reply (audio, vocab,
    # conjugation tables, inline quizzes, …). Empty list means "render the
    # plain text only". See services.assistant.blocks for the schema and the
    # frontend's <MessageBlocks> for the renderer registry.
    blocks = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assistant_messages"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"


class ImageQuery(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="image_queries",
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="image_queries",
    )
    image_file = models.ImageField(upload_to="image_queries/")
    question = models.TextField(blank=True, default="")
    extracted_text = models.TextField(blank=True, default="")
    ai_response = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assistant_image_queries"
        ordering = ["-created_at"]

    def __str__(self):
        return f"ImageQuery(user={self.user_id}, id={self.id})"
