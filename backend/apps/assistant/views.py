import logging

from django.db.models import Count
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from services.llm.factory import create_llm_router
from services.llm.prompts import SYSTEM_PROMPTS

from .models import Conversation, Message
from .serializers import (
    ChatRequestSerializer,
    MessageSerializer,
    ConversationListSerializer,
    ConversationDetailSerializer,
)

logger = logging.getLogger(__name__)


class ChatView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_message = serializer.validated_data["message"]
        mode = serializer.validated_data["mode"]
        conversation_id = serializer.validated_data.get("conversation_id")

        # Resolve or create conversation
        if conversation_id:
            try:
                conversation = Conversation.objects.get(
                    pk=conversation_id, user=request.user,
                )
            except Conversation.DoesNotExist:
                return Response(
                    {"detail": "Conversation not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            # Auto-generate title from first message
            title = user_message[:50] + ("..." if len(user_message) > 50 else "")
            conversation = Conversation.objects.create(
                user=request.user,
                title=title,
            )

        # Save user message
        Message.objects.create(
            conversation=conversation,
            role="user",
            content=user_message,
        )

        # Build message history for the LLM
        prior_messages = Message.objects.filter(
            conversation=conversation,
        ).order_by("created_at")
        messages = [
            {"role": msg.role, "content": msg.content}
            for msg in prior_messages
        ]

        # Get system prompt for the mode
        system_prompt = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["conversation"])

        # Call LLM
        try:
            router = create_llm_router()
            llm_response = router.generate(
                messages=messages,
                system_prompt=system_prompt,
            )
        except Exception as exc:
            logger.error("LLM call failed: %s", exc)
            return Response(
                {"detail": "AI service is temporarily unavailable. Please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Save assistant response
        Message.objects.create(
            conversation=conversation,
            role="assistant",
            content=llm_response.content,
            provider=llm_response.provider,
            tokens_used=llm_response.tokens_used,
        )

        # --- Gamification: award XP for 5+ exchange conversations ---
        user_message_count = Message.objects.filter(
            conversation=conversation, role="user",
        ).count()
        if user_message_count == 5:
            # Award exactly once when hitting the 5-message threshold
            from apps.gamification.services import award_xp, check_streak
            award_xp(
                request.user,
                activity_type="ai_conversation",
                xp_amount=15,
                source_id=f"conversation_{conversation.id}",
            )
            check_streak(request.user)

        return Response({
            "reply": llm_response.content,
            "conversation_id": conversation.id,
            "provider": llm_response.provider,
            "tokens_used": llm_response.tokens_used,
        })


class ConversationListView(generics.ListAPIView):
    serializer_class = ConversationListSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Conversation.objects.filter(
            user=self.request.user,
        ).annotate(message_count=Count("messages"))


class ConversationDetailView(generics.RetrieveAPIView):
    serializer_class = ConversationDetailSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Conversation.objects.filter(
            user=self.request.user,
        ).prefetch_related("messages")
