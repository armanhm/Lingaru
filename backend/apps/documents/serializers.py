from rest_framework import serializers

from .models import Document, DocumentChunk


ALLOWED_EXTENSIONS = {"pdf", "txt"}
EXTENSION_TO_TYPE = {
    "pdf": "pdf",
    "txt": "txt",
}


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    title = serializers.CharField(max_length=300)

    def validate_file(self, value):
        """Validate file extension is supported."""
        name = value.name.lower()
        ext = name.rsplit(".", 1)[-1] if "." in name else ""

        if ext not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                f"Unsupported file type: .{ext}. Supported: .pdf, .txt"
            )

        return value

    def get_file_type(self) -> str:
        """Derive file_type from the uploaded file's extension."""
        name = self.validated_data["file"].name.lower()
        ext = name.rsplit(".", 1)[-1]
        return EXTENSION_TO_TYPE.get(ext, "txt")


class DocumentSerializer(serializers.ModelSerializer):
    chunk_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Document
        fields = (
            "id", "title", "file_type", "page_count",
            "uploaded_at", "processed", "processing_error", "chunk_count",
        )


class DocumentChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentChunk
        fields = ("id", "content", "chunk_index", "page_number")
