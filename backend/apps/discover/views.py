from django.db import models
from django.db.models import BooleanField, Case, Exists, OuterRef, Subquery, Value, When
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.gamification.services import award_xp

from .models import DiscoverCard, UserDiscoverHistory
from .serializers import (
    DiscoverCardSerializer,
    NewsDetailSerializer,
    NewsListSerializer,
)
from .services import generate_daily_cards, generate_news_card


class FeedPagination(PageNumberPagination):
    page_size = 20


class FeedView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        now = timezone.now()

        # Base queryset: non-expired cards. News has its own dedicated page now.
        qs = DiscoverCard.objects.filter(
            models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now)
        ).exclude(type="news")

        # Annotate with seen/interacted from user's history
        user_history = UserDiscoverHistory.objects.filter(
            user=request.user, card=OuterRef("pk"),
        )
        qs = qs.annotate(
            seen=Exists(user_history),
            interacted=Case(
                When(
                    Exists(user_history.filter(interacted=True)),
                    then=Value(True),
                ),
                default=Value(False),
                output_field=BooleanField(),
            ),
        )

        # Order: unseen first, then by generated_at descending
        qs = qs.order_by("seen", "-generated_at")

        paginator = FeedPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = DiscoverCardSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class GenerateMoreView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        cards = generate_daily_cards()
        serializer = DiscoverCardSerializer(cards, many=True)
        return Response({
            "generated": len(cards),
            "cards": serializer.data,
        })


class InteractView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, card_id):
        card = get_object_or_404(DiscoverCard, pk=card_id)

        history, created = UserDiscoverHistory.objects.get_or_create(
            user=request.user,
            card=card,
            defaults={"interacted": True},
        )

        if not created and history.interacted:
            return Response({
                "already_interacted": True,
                "xp_awarded": 0,
            })

        if not history.interacted:
            history.interacted = True
            history.save()

        # Award 3 XP for interacting with a discover card
        stats, txn, new_badges = award_xp(
            user=request.user,
            activity_type="discover_interact",
            xp_amount=3,
            source_id=str(card.pk),
        )

        return Response({
            "already_interacted": False,
            "xp_awarded": 3,
            "total_xp": stats.total_xp,
        })


# ── News ────────────────────────────────────────────────────────────


def _annotate_user_history(qs, user):
    user_history = UserDiscoverHistory.objects.filter(
        user=user, card=OuterRef("pk"),
    )
    return qs.annotate(
        seen=Exists(user_history),
        interacted=Case(
            When(
                Exists(user_history.filter(interacted=True)),
                then=Value(True),
            ),
            default=Value(False),
            output_field=BooleanField(),
        ),
    )


class NewsListPagination(PageNumberPagination):
    page_size = 24


class NewsListView(APIView):
    """List news articles. Optional ?topic=politics filter."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        now = timezone.now()
        qs = DiscoverCard.objects.filter(
            type="news",
        ).filter(
            models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now)
        )

        topic = request.query_params.get("topic")
        if topic:
            qs = qs.filter(topic=topic)

        qs = _annotate_user_history(qs, request.user).order_by("seen", "-generated_at")

        paginator = NewsListPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = NewsListSerializer(page, many=True)

        # Surface available topics + counts so the frontend can render filter chips.
        topic_counts = list(
            DiscoverCard.objects.filter(type="news").values("topic")
            .annotate(count=models.Count("id")).order_by("-count")
        )

        return paginator.get_paginated_response({
            "articles": serializer.data,
            "topics": topic_counts,
        })


class NewsDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, pk):
        qs = DiscoverCard.objects.filter(type="news", pk=pk)
        qs = _annotate_user_history(qs, request.user)
        card = qs.first()
        if card is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        # Mark as seen (no XP yet — XP is awarded on explicit interact)
        UserDiscoverHistory.objects.get_or_create(user=request.user, card=card)

        serializer = NewsDetailSerializer(card)
        return Response(serializer.data)


class NewsGenerateView(APIView):
    """Generate a fresh news card on demand."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        topic = request.data.get("topic") or None
        card = generate_news_card(topic=topic)
        if card is None:
            return Response(
                {"detail": "News generation failed. Try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        serializer = NewsDetailSerializer(card)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
