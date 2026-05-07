import logging

from django.db.models import Count
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Document, DocumentChunk
from .serializers import (
    DocumentChunkSerializer,
    DocumentSerializer,
    DocumentUploadSerializer,
)

logger = logging.getLogger(__name__)


class DocumentUploadView(APIView):
    """Upload a document for RAG processing."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file = serializer.validated_data["file"]
        title = serializer.validated_data["title"]
        file_type = serializer.get_file_type()

        document = Document.objects.create(
            user=request.user,
            title=title,
            file=file,
            file_type=file_type,
        )

        # Trigger async processing
        try:
            from apps.documents.tasks import process_document_task

            process_document_task.delay(document.id)
        except Exception as exc:
            # If Celery is not available, process synchronously
            logger.warning(
                "Celery unavailable, processing synchronously: %s",
                exc,
            )
            from services.rag.pipeline import process_document

            try:
                process_document(document.id)
            except Exception as proc_exc:
                logger.error("Sync processing failed: %s", proc_exc)

        return Response(
            DocumentSerializer(document).data,
            status=status.HTTP_201_CREATED,
        )


class DocumentListView(generics.ListAPIView):
    """List the authenticated user's documents."""

    serializer_class = DocumentSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Document.objects.filter(
            user=self.request.user,
        ).annotate(chunk_count=Count("chunks"))


class DocumentDeleteView(generics.DestroyAPIView):
    """Delete a document and all its chunks."""

    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Document.objects.filter(user=self.request.user)


class DocumentChunkListView(generics.ListAPIView):
    """List chunks for a document (debug/admin view)."""

    serializer_class = DocumentChunkSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return DocumentChunk.objects.filter(
            document_id=self.kwargs["document_id"],
            document__user=self.request.user,
        )
