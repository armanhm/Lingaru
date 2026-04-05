from django.conf import settings
from django.db import models


class Document(models.Model):
    FILE_TYPE_CHOICES = [
        ("pdf", "PDF"),
        ("txt", "Text"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    title = models.CharField(max_length=300)
    file = models.FileField(upload_to="documents/")
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES)
    page_count = models.PositiveIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    processed = models.BooleanField(default=False)
    processing_error = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "documents_document"
        ordering = ["-uploaded_at"]

    def __str__(self):
        return self.title


class DocumentChunk(models.Model):
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="chunks",
    )
    content = models.TextField()
    chunk_index = models.PositiveIntegerField()
    page_number = models.PositiveIntegerField(null=True, blank=True)
    embedding = models.JSONField(default=list)

    class Meta:
        db_table = "documents_chunk"
        ordering = ["chunk_index"]

    def __str__(self):
        return f"Chunk {self.chunk_index} of {self.document.title}"
