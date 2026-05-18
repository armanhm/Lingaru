from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.generics import ListCreateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MemoryNote
from .serializers import MemoryNoteSerializer


class MemoryNoteListCreateView(ListCreateAPIView):
    """GET /api/memory/notes/ -- list active notes (or all with ?include_inactive=true).
    POST /api/memory/notes/ -- create a user-authored note.
    """

    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = MemoryNoteSerializer
    pagination_class = None

    def get_queryset(self):
        qs = MemoryNote.objects.filter(user=self.request.user)
        if self.request.query_params.get("include_inactive", "").lower() not in (
            "1",
            "true",
            "yes",
        ):
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, source="user")


class MemoryNoteDetailView(APIView):
    """PATCH /api/memory/notes/<pk>/ -- edit fields.
    DELETE /api/memory/notes/<pk>/ -- soft-delete (is_active=False).
    """

    permission_classes = (permissions.IsAuthenticated,)

    def _get_note(self, request, pk):
        return get_object_or_404(MemoryNote, pk=pk, user=request.user)

    def patch(self, request, pk):
        note = self._get_note(request, pk)
        serializer = MemoryNoteSerializer(note, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        note = self._get_note(request, pk)
        if note.is_active:
            note.is_active = False
            note.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
