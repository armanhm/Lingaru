from django.db.models import Q
from rest_framework import generics, viewsets
from rest_framework.permissions import IsAuthenticated

from .models import MyNote
from .serializers import MyNoteDetailSerializer, MyNoteListSerializer


class MyNoteViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated,)
    pagination_class = None

    def get_serializer_class(self):
        if self.action == "list":
            return MyNoteListSerializer
        return MyNoteDetailSerializer

    def get_queryset(self):
        qs = MyNote.objects.filter(user=self.request.user)
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(title__icontains=q) | Q(body_markdown__icontains=q) | Q(tags__icontains=q)
            )
        kind = self.request.query_params.get("kind")
        if kind:
            qs = qs.filter(kind=kind)
        tag = self.request.query_params.get("tag")
        if tag:
            qs = qs.filter(tags__icontains=tag.lower())
        if self.request.query_params.get("favorite") in ("1", "true"):
            qs = qs.filter(is_favorite=True)
        language = self.request.query_params.get("language")
        if language and language != "all":
            qs = qs.filter(language=language)
        return qs

    def perform_create(self, serializer):
        if "language" not in serializer.validated_data:
            serializer.validated_data["language"] = self.request.user.target_language
        serializer.save(user=self.request.user)


class PublicMyNoteView(generics.RetrieveAPIView):
    """GET /api/my-notes/public/<id>/ — read-only access to a publicly
    shared note by id. Requires login but works across users."""

    permission_classes = (IsAuthenticated,)
    serializer_class = MyNoteDetailSerializer
    queryset = MyNote.objects.filter(is_public=True)
