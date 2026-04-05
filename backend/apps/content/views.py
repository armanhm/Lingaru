from rest_framework import generics, permissions
from .models import Topic, Lesson
from .serializers import (
    TopicListSerializer,
    TopicDetailSerializer,
    LessonDetailSerializer,
)


class TopicListView(generics.ListAPIView):
    queryset = Topic.objects.all()
    serializer_class = TopicListSerializer
    permission_classes = (permissions.IsAuthenticated,)


class TopicDetailView(generics.RetrieveAPIView):
    queryset = Topic.objects.prefetch_related("lessons")
    serializer_class = TopicDetailSerializer
    permission_classes = (permissions.IsAuthenticated,)


class LessonDetailView(generics.RetrieveAPIView):
    queryset = Lesson.objects.select_related("topic").prefetch_related(
        "vocabulary", "grammar_rules", "reading_texts", "questions",
    )
    serializer_class = LessonDetailSerializer
    permission_classes = (permissions.IsAuthenticated,)
