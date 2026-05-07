from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.content.models import Question
from apps.gamification.services import award_xp, check_streak

from .models import LessonCompletion, MistakeEntry, SRSCard
from .serializers import (
    MistakeEntrySerializer,
    MistakeMarkReviewedSerializer,
    SRSCardSerializer,
    SRSReviewSerializer,
)
from .services import get_due_cards, review_card


class SRSDueCardsView(APIView):
    """GET /api/progress/srs/due/ — return cards due for review."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        limit = int(request.query_params.get("limit", 20))
        cards = get_due_cards(request.user, limit=min(limit, 50))
        serializer = SRSCardSerializer(cards, many=True)
        return Response({"cards": serializer.data, "count": len(serializer.data)})


class SRSReviewView(APIView):
    """POST /api/progress/srs/review/ — submit review result for one card."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = SRSReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        card_id = serializer.validated_data["card_id"]
        quality = serializer.validated_data["quality"]

        try:
            card = SRSCard.objects.get(pk=card_id, user=request.user)
        except SRSCard.DoesNotExist:
            return Response(
                {"detail": "Card not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        updated_card = review_card(card, quality)

        # Award XP for SRS review session (10 XP per session, deduplicated per card)
        award_xp(
            request.user,
            activity_type="srs_review",
            xp_amount=10,
            source_id=f"srs_card_{card.id}_{card.repetitions}",
        )
        check_streak(request.user)

        return Response(SRSCardSerializer(updated_card).data)


class MistakeListView(generics.ListAPIView):
    """GET /api/progress/mistakes/ — paginated mistake journal with filtering."""

    serializer_class = MistakeEntrySerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        qs = MistakeEntry.objects.filter(
            user=self.request.user,
        ).select_related("question")

        # Optional filters
        mistake_type = self.request.query_params.get("type")
        if mistake_type:
            qs = qs.filter(mistake_type=mistake_type)

        reviewed = self.request.query_params.get("reviewed")
        if reviewed is not None:
            qs = qs.filter(reviewed=reviewed.lower() == "true")

        return qs


class MistakeMarkReviewedView(APIView):
    """POST /api/progress/mistakes/reviewed/ — mark mistakes as reviewed."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = MistakeMarkReviewedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ids = serializer.validated_data["mistake_ids"]
        updated = MistakeEntry.objects.filter(
            user=request.user,
            id__in=ids,
        ).update(reviewed=True)

        return Response({"updated": updated})


class LessonCompleteView(APIView):
    """POST /api/progress/lessons/<lesson_id>/complete/ — mark a lesson as complete."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, lesson_id):
        from apps.content.models import Lesson

        try:
            lesson = Lesson.objects.get(pk=lesson_id)
        except Lesson.DoesNotExist:
            return Response({"detail": "Lesson not found."}, status=status.HTTP_404_NOT_FOUND)

        score = request.data.get("score", 0)
        total_questions = request.data.get("total_questions", 0)

        completion, created = LessonCompletion.objects.get_or_create(
            user=request.user,
            lesson=lesson,
            defaults={"score": score, "total_questions": total_questions},
        )

        if not created and score > completion.score:
            completion.score = score
            completion.total_questions = total_questions
            completion.save(update_fields=["score", "total_questions"])

        if created:
            award_xp(
                request.user,
                activity_type="lesson_complete",
                xp_amount=50,
                source_id=f"lesson_{lesson_id}",
            )
            check_streak(request.user)

        # Find the next lesson in the same topic
        next_lesson = lesson.topic.lessons.filter(order__gt=lesson.order).order_by("order").first()

        return Response(
            {
                "completed": True,
                "first_time": created,
                "xp_earned": 50 if created else 0,
                "next_lesson": {
                    "id": next_lesson.id,
                    "title": next_lesson.title,
                    "type": next_lesson.type,
                }
                if next_lesson
                else None,
            }
        )


class TopicProgressView(APIView):
    """GET /api/progress/topics/<topic_id>/ — lesson completion counts for a topic."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, topic_id):
        from apps.content.models import Topic

        try:
            topic = Topic.objects.prefetch_related("lessons").get(pk=topic_id)
        except Topic.DoesNotExist:
            return Response({"detail": "Topic not found."}, status=status.HTTP_404_NOT_FOUND)

        lesson_ids = list(topic.lessons.values_list("id", flat=True))
        completed_ids = set(
            LessonCompletion.objects.filter(
                user=request.user, lesson_id__in=lesson_ids
            ).values_list("lesson_id", flat=True)
        )

        return Response(
            {
                "topic_id": topic_id,
                "total_lessons": len(lesson_ids),
                "completed_lessons": len(completed_ids),
                "completed_lesson_ids": list(completed_ids),
            }
        )


class ConjugationCheckView(APIView):
    """POST /api/progress/conjugation/check/ — check a conjugation answer.

    Request body: { "verb": "manger", "tense": "present", "subject": "je", "answer": "mange" }
    """

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        verb = request.data.get("verb", "").strip()
        tense = request.data.get("tense", "").strip()
        subject = request.data.get("subject", "").strip()
        answer = request.data.get("answer", "").strip()

        if not all([verb, tense, subject, answer]):
            return Response(
                {"detail": "verb, tense, subject, and answer are all required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Look up the correct conjugation from Question records (type=conjugation)
        # Prompt format: "Conjugate {verb} ({tense}, {subject})"
        question = Question.objects.filter(
            Q(type="conjugation")
            & Q(prompt__icontains=verb)
            & Q(prompt__icontains=tense)
            & Q(prompt__icontains=subject)
        ).first()

        if question is None:
            return Response(
                {"detail": "No conjugation data found for this combination."},
                status=status.HTTP_404_NOT_FOUND,
            )

        is_correct = answer.lower() == question.correct_answer.strip().lower()

        if not is_correct:
            from apps.progress.services import record_mistake

            record_mistake(
                user=request.user,
                question=question,
                user_answer=answer,
                correct_answer=question.correct_answer,
                mistake_type="conjugation",
            )

        # Award XP for conjugation drill
        if is_correct:
            award_xp(
                request.user,
                activity_type="conjugation_drill",
                xp_amount=10,
                source_id=f"conjugation_{question.id}",
            )
            check_streak(request.user)

        return Response(
            {
                "is_correct": is_correct,
                "correct_answer": question.correct_answer,
                "explanation": question.explanation,
            }
        )


class ConjugationListView(APIView):
    """GET /api/progress/conjugation/verbs/ — available verbs and tenses."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        questions = Question.objects.filter(type="conjugation")

        # Extract unique verbs from prompts (format: "Conjugate {verb} (...)")
        verbs = set()
        tenses = set()
        for q in questions.values_list("prompt", flat=True):
            # Expected prompt format: "Conjugate manger (present, je)"
            parts = q.split("(")
            if len(parts) >= 2:
                verb_part = parts[0].replace("Conjugate", "").strip()
                tense_part = parts[1].split(",")[0].strip().rstrip(")")
                verbs.add(verb_part)
                tenses.add(tense_part)

        return Response(
            {
                "verbs": sorted(verbs),
                "tenses": sorted(tenses),
            }
        )
