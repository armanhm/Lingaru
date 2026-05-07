import random

from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.gamification.services import award_xp, check_streak

from .models import (
    GrammarAnswer,
    GrammarCategory,
    GrammarDrillItem,
    GrammarMastery,
    GrammarSession,
    GrammarTopic,
)
from .scoring import status_for, update_mastery
from .serializers import (
    CompleteSessionSerializer,
    GrammarCategorySerializer,
    GrammarDrillItemSerializer,
    GrammarTopicDetailSerializer,
    GrammarTopicListSerializer,
    StartSessionSerializer,
    SubmitAnswerSerializer,
)

# ── XP for grammar drills ───────────────────────────────────────
XP_PER_CORRECT_DRILL = 3
XP_DRILL_PERFECT_BONUS = 10


class HubView(APIView):
    """Aggregated view for /grammar — categories with topic + mastery counts,
    plus a recommended next topic based on weakest mastery / due-for-review."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        categories = GrammarCategory.objects.prefetch_related("topics").all()

        category_payload = []
        all_user_mastery = {
            m.topic_id: m
            for m in GrammarMastery.objects.filter(user=request.user).select_related("topic")
        }

        for cat in categories:
            topics = list(cat.topics.filter(is_active=True))
            if not topics:
                continue
            mastered = sum(
                1
                for t in topics
                if (m := all_user_mastery.get(t.id)) and status_for(m) == "mastered"
            )
            avg_mastery = (
                (
                    sum(
                        (
                            all_user_mastery.get(t.id).mastery_score
                            if all_user_mastery.get(t.id)
                            else 0
                        )
                        for t in topics
                    )
                    / len(topics)
                )
                if topics
                else 0
            )
            category_payload.append(
                {
                    "id": cat.id,
                    "name": cat.name,
                    "slug": cat.slug,
                    "icon": cat.icon,
                    "topic_count": len(topics),
                    "mastered_count": mastered,
                    "avg_mastery": round(avg_mastery, 1),
                }
            )

        # Recommend next topic: due-for-review first, else weakest, else first not-started
        now = timezone.now()
        due_records = (
            GrammarMastery.objects.filter(user=request.user, next_review_at__lte=now)
            .select_related("topic")
            .order_by("next_review_at")
        )

        recommended = None
        if due_records.exists():
            recommended = due_records.first().topic
        else:
            # weakest non-mastered
            non_mastered = [m for m in all_user_mastery.values() if status_for(m) != "mastered"]
            if non_mastered:
                weakest = min(non_mastered, key=lambda m: m.mastery_score)
                recommended = weakest.topic
            else:
                # first not-started
                started_ids = set(all_user_mastery.keys())
                first_new = (
                    GrammarTopic.objects.filter(is_active=True).exclude(id__in=started_ids).first()
                )
                if first_new:
                    recommended = first_new

        return Response(
            {
                "categories": category_payload,
                "recommended_topic": GrammarTopicListSerializer(
                    recommended, context={"request": request}
                ).data
                if recommended
                else None,
                "total_topics": GrammarTopic.objects.filter(is_active=True).count(),
                "total_mastered": sum(
                    1 for m in all_user_mastery.values() if status_for(m) == "mastered"
                ),
                "due_for_review": due_records.count(),
            }
        )


class CategoryListView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        cats = GrammarCategory.objects.all()
        return Response(GrammarCategorySerializer(cats, many=True).data)


class TopicListView(APIView):
    """List topics, filterable by category and CEFR level."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        qs = GrammarTopic.objects.filter(is_active=True).select_related("category")

        category_slug = request.query_params.get("category")
        if category_slug:
            qs = qs.filter(category__slug=category_slug)

        level = request.query_params.get("level")
        if level:
            qs = qs.filter(cefr_level=level)

        return Response(
            GrammarTopicListSerializer(qs, many=True, context={"request": request}).data
        )


class TopicDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, slug):
        try:
            topic = GrammarTopic.objects.select_related("category").get(slug=slug, is_active=True)
        except GrammarTopic.DoesNotExist:
            return Response({"detail": "Topic not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(GrammarTopicDetailSerializer(topic, context={"request": request}).data)


class StartSessionView(APIView):
    """Start a drill session for a topic. Returns 8-12 drill items."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = StartSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        topic_id = serializer.validated_data.get("topic_id")
        mode = serializer.validated_data.get("mode", "drill")

        if mode == "drill":
            if not topic_id:
                return Response(
                    {"detail": "topic_id required for drill mode."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                topic = GrammarTopic.objects.get(id=topic_id, is_active=True)
            except GrammarTopic.DoesNotExist:
                return Response({"detail": "Topic not found."}, status=status.HTTP_404_NOT_FOUND)

            drills = list(topic.drills.all())
            if not drills:
                return Response(
                    {"detail": "No drills available for this topic yet."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            random.shuffle(drills)
            drills = drills[:10]

            mastery, _ = GrammarMastery.objects.get_or_create(user=request.user, topic=topic)
            session = GrammarSession.objects.create(
                user=request.user,
                topic=topic,
                mode="drill",
                total=len(drills),
                mastery_before=mastery.mastery_score,
            )
        else:
            # diagnostic — sample one item from each of up to 12 topics at user level
            level = request.user.target_level if hasattr(request.user, "target_level") else "B1"
            topics = list(GrammarTopic.objects.filter(is_active=True, cefr_level=level)[:12])
            if len(topics) < 5:
                # fall back: any level
                topics = list(GrammarTopic.objects.filter(is_active=True).order_by("?")[:12])
            drills = []
            for t in topics:
                items = list(t.drills.all())
                if items:
                    drills.append(random.choice(items))
            if not drills:
                return Response(
                    {"detail": "No drills available yet."}, status=status.HTTP_400_BAD_REQUEST
                )

            session = GrammarSession.objects.create(
                user=request.user,
                topic=None,
                mode="diagnostic",
                total=len(drills),
            )

        return Response(
            {
                "session_id": session.id,
                "mode": mode,
                "topic": GrammarTopicListSerializer(
                    session.topic, context={"request": request}
                ).data
                if session.topic
                else None,
                "items": GrammarDrillItemSerializer(drills, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


class SubmitAnswerView(APIView):
    """Submit a single answer within a session. Records but doesn't grade —
    grading is client-side (we send correct_answer with each item)."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, session_id):
        try:
            session = GrammarSession.objects.get(id=session_id, user=request.user)
        except GrammarSession.DoesNotExist:
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)
        if session.completed_at:
            return Response(
                {"detail": "Session already completed."}, status=status.HTTP_400_BAD_REQUEST
            )

        serializer = SubmitAnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        drill = GrammarDrillItem.objects.filter(
            id=serializer.validated_data["drill_item_id"]
        ).first()
        is_correct = serializer.validated_data["is_correct"]

        GrammarAnswer.objects.create(
            session=session,
            drill_item=drill,
            user_answer=serializer.validated_data["user_answer"],
            is_correct=is_correct,
        )
        if is_correct:
            session.score += 1
            session.save(update_fields=["score"])

        return Response({"ok": True, "running_score": session.score})


class CompleteSessionView(APIView):
    """Mark session complete, update mastery, award XP."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, session_id):
        try:
            session = GrammarSession.objects.get(id=session_id, user=request.user)
        except GrammarSession.DoesNotExist:
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)
        if session.completed_at:
            return Response(CompleteSessionSerializer(session).data)

        session.completed_at = timezone.now()

        if session.topic:
            mastery, _ = GrammarMastery.objects.get_or_create(
                user=request.user, topic=session.topic
            )
            update_mastery(mastery, session.score, session.total)
            session.mastery_after = mastery.mastery_score

        session.save()

        xp = session.score * XP_PER_CORRECT_DRILL
        if session.total > 0 and session.score == session.total:
            xp += XP_DRILL_PERFECT_BONUS
        if xp > 0:
            award_xp(request.user, activity_type=f"grammar_{session.mode}", xp_amount=xp)
        check_streak(request.user)

        data = CompleteSessionSerializer(session).data
        data["xp_earned"] = xp
        return Response(data)
