from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Topic, Lesson, Vocabulary
from .serializers import (
    TopicListSerializer,
    TopicDetailSerializer,
    LessonDetailSerializer,
    VocabularySerializer,
)


class TopicListView(generics.ListAPIView):
    queryset = Topic.objects.all()
    serializer_class = TopicListSerializer
    permission_classes = (permissions.IsAuthenticated,)


class TopicDetailView(generics.RetrieveAPIView):
    queryset = Topic.objects.prefetch_related("lessons")
    serializer_class = TopicDetailSerializer
    permission_classes = (permissions.IsAuthenticated,)


class RandomVocabularyView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        vocab = Vocabulary.objects.order_by("?").first()
        if not vocab:
            return Response({"detail": "No vocabulary available."}, status=404)
        return Response(VocabularySerializer(vocab).data)


class LessonDetailView(generics.RetrieveAPIView):
    queryset = Lesson.objects.select_related("topic").prefetch_related(
        "vocabulary", "grammar_rules", "reading_texts", "questions",
    )
    serializer_class = LessonDetailSerializer
    permission_classes = (permissions.IsAuthenticated,)
