from collections import defaultdict

from django.db.models import Avg, Count, Sum
from django.utils import timezone
from datetime import timedelta

from rest_framework import permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.progress.models import LessonCompletion, MistakeEntry, SRSCard
from .models import Badge, UserBadge, UserStats, XPTransaction
from .serializers import (
    BadgeSerializer,
    LeaderboardEntrySerializer,
    UserBadgeSerializer,
    UserStatsSerializer,
    XPTransactionSerializer,
)
from .services import award_xp, get_or_create_stats


class StatsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        stats = get_or_create_stats(request.user)

        # Compute rank (position by total_xp descending)
        rank = UserStats.objects.filter(total_xp__gt=stats.total_xp).count() + 1
        stats.rank = rank

        serializer = UserStatsSerializer(stats)
        return Response(serializer.data)


class BadgesView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        earned_qs = UserBadge.objects.filter(
            user=request.user,
        ).select_related("badge").order_by("-earned_at")

        earned_ids = set(earned_qs.values_list("badge_id", flat=True))
        available_qs = Badge.objects.exclude(id__in=earned_ids)

        return Response({
            "earned": UserBadgeSerializer(earned_qs, many=True).data,
            "available": BadgeSerializer(available_qs, many=True).data,
        })


class LeaderboardPagination(PageNumberPagination):
    page_size = 50
    max_page_size = 50


class LeaderboardView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        qs = UserStats.objects.select_related("user").order_by("-total_xp")
        paginator = LeaderboardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = LeaderboardEntrySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class HistoryPagination(PageNumberPagination):
    page_size = 20


class HistoryView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        qs = XPTransaction.objects.filter(user=request.user)
        paginator = HistoryPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = XPTransactionSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class MiniGameScoreView(APIView):
    """POST {game, score, total} — award XP for mini-game completion."""
    permission_classes = (permissions.IsAuthenticated,)

    VALID_GAMES = {"word_scramble", "match_pairs", "gender_snap", "speed_round", "missing_letter"}
    XP_PER_CORRECT = 2

    def post(self, request):
        game = request.data.get("game", "")
        score = int(request.data.get("score", 0))
        total = int(request.data.get("total", 0))
        if game not in self.VALID_GAMES:
            return Response({"detail": "Invalid game."}, status=status.HTTP_400_BAD_REQUEST)
        if score <= 0:
            return Response({"xp_earned": 0})
        xp = score * self.XP_PER_CORRECT
        stats, txn, new_badges = award_xp(
            request.user,
            activity_type=f"mini_game_{game}",
            xp_amount=xp,
        )
        return Response({"xp_earned": xp, "total_xp": stats.total_xp})


class TrendReportView(APIView):
    """Aggregated 7-day trend report for the coach panel."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        now = timezone.now()
        week_ago = now - timedelta(days=7)

        # ── XP this week ────────────────────────────────────────────────────
        xp_qs = XPTransaction.objects.filter(user=user, created_at__gte=week_ago)
        total_xp_week = xp_qs.aggregate(total=Sum("xp_amount"))["total"] or 0

        # XP by activity type
        xp_by_type = list(
            xp_qs.values("activity_type")
            .annotate(total=Sum("xp_amount"), count=Count("id"))
            .order_by("-total")
        )

        # Daily XP for the past 7 days (for sparkline / trend)
        daily_xp = {}
        for txn in xp_qs.values("created_at", "xp_amount"):
            day = txn["created_at"].date().isoformat()
            daily_xp[day] = daily_xp.get(day, 0) + txn["xp_amount"]
        daily_xp_list = [
            {"date": (now - timedelta(days=i)).date().isoformat(),
             "xp": daily_xp.get((now - timedelta(days=i)).date().isoformat(), 0)}
            for i in range(6, -1, -1)
        ]

        # ── Lessons & quizzes ────────────────────────────────────────────────
        lessons_week = LessonCompletion.objects.filter(user=user, completed_at__gte=week_ago)
        lessons_count = lessons_week.count()
        avg_score = lessons_week.aggregate(avg=Avg("score"))["avg"]
        avg_score_pct = None
        if avg_score is not None:
            total_q = lessons_week.aggregate(t=Avg("total_questions"))["t"] or 1
            avg_score_pct = round((avg_score / total_q) * 100) if total_q else None

        # ── Mistakes ─────────────────────────────────────────────────────────
        mistakes_week = MistakeEntry.objects.filter(user=user, created_at__gte=week_ago)
        mistakes_count = mistakes_week.count()
        mistake_types = list(
            mistakes_week.values("mistake_type")
            .annotate(n=Count("id"))
            .order_by("-n")[:3]
        )
        # Get a sample mistake detail for coaching tip
        sample_mistakes = list(
            mistakes_week.order_by("-created_at").values(
                "user_answer", "correct_answer", "mistake_type"
            )[:3]
        )

        # ── SRS ──────────────────────────────────────────────────────────────
        srs_total = SRSCard.objects.filter(user=user).count()
        srs_due = SRSCard.objects.filter(user=user, next_review_at__lte=now).count()
        srs_mastered = SRSCard.objects.filter(user=user, interval_days__gte=21).count()

        # ── Stats (streak, level) ────────────────────────────────────────────
        stats = get_or_create_stats(user)

        # ── Build insights list ──────────────────────────────────────────────
        insights = []

        if total_xp_week == 0:
            insights.append({"type": "warn", "text": "No activity this week. Even 10 minutes a day makes a difference!"})
        elif total_xp_week >= 200:
            insights.append({"type": "great", "text": f"Excellent week — {total_xp_week} XP earned! Keep this momentum."})
        else:
            insights.append({"type": "ok", "text": f"You earned {total_xp_week} XP this week. Try to hit 200 XP for a strong week."})

        if stats.current_streak >= 7:
            insights.append({"type": "great", "text": f"{stats.current_streak}-day streak! Consistency is the fastest path to fluency."})
        elif stats.current_streak >= 3:
            insights.append({"type": "ok", "text": f"{stats.current_streak}-day streak going. Don't break it — log in tomorrow!"})
        elif stats.current_streak == 0:
            insights.append({"type": "warn", "text": "Your streak reset. Start a new one today — every day counts."})

        if mistakes_count > 0:
            top_type = mistake_types[0]["mistake_type"] if mistake_types else "grammar"
            insights.append({"type": "tip", "text": f"You made {mistakes_count} mistake{'s' if mistakes_count != 1 else ''} this week, mostly in {top_type.replace('_', ' ')}. Review them in the Mistakes journal."})
        else:
            insights.append({"type": "great", "text": "Zero mistakes this week — flawless!"})

        if srs_due > 5:
            insights.append({"type": "warn", "text": f"{srs_due} SRS cards are due for review. Don't let them pile up!"})
        elif srs_mastered > 0:
            insights.append({"type": "great", "text": f"{srs_mastered} SRS card{'s' if srs_mastered != 1 else ''} mastered (21+ day interval). Great long-term retention!"})

        dominant = xp_by_type[0]["activity_type"] if xp_by_type else None
        if dominant and lessons_count == 0 and dominant == "conjugation_drill":
            insights.append({"type": "tip", "text": "You've been drilling conjugations — nice! Balance it with a lesson or quiz for full coverage."})
        elif lessons_count >= 3:
            insights.append({"type": "great", "text": f"{lessons_count} lessons completed this week. Solid learning pace!"})

        return Response({
            "week": {
                "total_xp": total_xp_week,
                "lessons_completed": lessons_count,
                "avg_score_pct": avg_score_pct,
                "mistakes": mistakes_count,
                "daily_xp": daily_xp_list,
            },
            "srs": {
                "total": srs_total,
                "due": srs_due,
                "mastered": srs_mastered,
            },
            "streak": stats.current_streak,
            "level": stats.level,
            "top_activities": xp_by_type[:4],
            "top_mistake_types": mistake_types,
            "sample_mistakes": sample_mistakes,
            "insights": insights,
        })
