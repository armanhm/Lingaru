from rest_framework import permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Badge, UserBadge, UserStats, XPTransaction
from .serializers import (
    BadgeSerializer,
    LeaderboardEntrySerializer,
    UserBadgeSerializer,
    UserStatsSerializer,
    XPTransactionSerializer,
)
from .services import get_or_create_stats


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
