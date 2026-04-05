from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.gamification.services import award_xp, check_streak
from .models import MistakeEntry, SRSCard
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
            user=request.user, id__in=ids,
        ).update(reviewed=True)

        return Response({"updated": updated})
