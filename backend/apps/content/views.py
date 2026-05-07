from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Lesson, Topic, VideoLesson, Vocabulary
from .serializers import (
    LessonDetailSerializer,
    TopicDetailSerializer,
    TopicListSerializer,
    VideoLessonSerializer,
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
        count = min(int(request.query_params.get("count", 1)), 20)
        single_word = request.query_params.get("single_word", "").lower() == "true"
        gendered = request.query_params.get("gendered", "").lower() == "true"
        qs = Vocabulary.objects.all()
        if single_word:
            qs = qs.exclude(french__contains=" ").filter(french__regex=r"^.{3,}$")
        if gendered:
            qs = qs.filter(gender__in=["m", "f"])
        vocab = qs.order_by("?")[:count]
        if count == 1:
            v = vocab.first()
            if not v:
                return Response({"detail": "No vocabulary available."}, status=404)
            return Response(VocabularySerializer(v).data)
        return Response(VocabularySerializer(vocab, many=True).data)


class LessonDetailView(generics.RetrieveAPIView):
    queryset = Lesson.objects.select_related("topic", "video").prefetch_related(
        "vocabulary",
        "grammar_rules",
        "reading_texts",
        "questions",
        "video__vocabulary",
        "video__expressions",
    )
    serializer_class = LessonDetailSerializer
    permission_classes = (permissions.IsAuthenticated,)


class LessonVideoView(APIView):
    """GET/POST /api/content/lessons/<pk>/video/

    GET  — return the VideoLesson for this lesson (404 if none).
    POST — submit a YouTube URL to attach/replace the video.
           Triggers async processing. Staff or superuser only for POST.
    """

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, pk):
        try:
            lesson = Lesson.objects.get(pk=pk)
        except Lesson.DoesNotExist:
            return Response({"detail": "Lesson not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            video = lesson.video
        except VideoLesson.DoesNotExist:
            return Response(
                {"detail": "No video attached to this lesson."}, status=status.HTTP_404_NOT_FOUND
            )

        return Response(VideoLessonSerializer(video).data)

    def post(self, request, pk):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {"detail": "Only staff can attach videos to lessons."},
                status=status.HTTP_403_FORBIDDEN,
            )

        youtube_url = request.data.get("youtube_url", "").strip()
        if not youtube_url:
            return Response(
                {"detail": "youtube_url is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            lesson = Lesson.objects.get(pk=pk)
        except Lesson.DoesNotExist:
            return Response({"detail": "Lesson not found."}, status=status.HTTP_404_NOT_FOUND)

        # Create or update
        video, created = VideoLesson.objects.update_or_create(
            lesson=lesson,
            defaults={
                "youtube_url": youtube_url,
                "status": "pending",
                "error_message": "",
                "youtube_id": "",
                "title": "",
                "thumbnail_url": "",
                "transcript_fr": "",
                "transcript_en": "",
            },
        )

        # Trigger async processing
        from apps.content.tasks import process_video_lesson

        process_video_lesson.delay(video.pk)

        return Response(
            VideoLessonSerializer(video).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
