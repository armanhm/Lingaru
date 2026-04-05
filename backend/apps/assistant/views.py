import logging

from django.db.models import Count
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from services.llm.factory import create_llm_router
from services.llm.prompts import SYSTEM_PROMPTS
from services.rag.context import retrieve_context_for_query
from services.stt.groq_whisper import GroqWhisperProvider
from services.tts.service import get_or_create_audio

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

        # RAG: retrieve relevant context for conversation mode
        rag_used = False
        if mode == "conversation":
            try:
                context = retrieve_context_for_query(
                    user_id=request.user.id,
                    query=user_message,
                )
                if context:
                    system_prompt = SYSTEM_PROMPTS["rag_conversation"].format(
                        context=context,
                    )
                    rag_used = True
            except Exception as exc:
                logger.warning("RAG retrieval failed, using standard prompt: %s", exc)

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
            "rag_used": rag_used,
        })


class ImageQueryView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        from .serializers import ImageQueryRequestSerializer

        serializer = ImageQueryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        image_file = serializer.validated_data["image"]
        question = serializer.validated_data.get("question", "")
        conversation_id = serializer.validated_data.get("conversation_id")

        # Resolve or create conversation
        conversation = None
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
            title = f"Image: {question[:40]}" if question else "Image query"
            conversation = Conversation.objects.create(
                user=request.user,
                title=title,
            )

        # Read image bytes
        image_data = image_file.read()
        image_mime_type = image_file.content_type or "image/jpeg"

        # Build messages
        messages = []
        if question:
            messages.append({"role": "user", "content": question})

        # Call Gemini Vision
        try:
            router = create_llm_router()
            llm_response = router.generate_with_image(
                messages=messages,
                image_data=image_data,
                image_mime_type=image_mime_type,
                system_prompt=SYSTEM_PROMPTS["image_query"],
            )
        except Exception as exc:
            logger.error("Vision LLM call failed: %s", exc)
            return Response(
                {"detail": "AI vision service is temporarily unavailable. Please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Save ImageQuery record
        from .models import ImageQuery
        image_query = ImageQuery.objects.create(
            user=request.user,
            conversation=conversation,
            image_file=image_file,
            question=question,
            ai_response=llm_response.content,
        )

        # Also save as messages in the conversation for continuity
        if question:
            Message.objects.create(
                conversation=conversation,
                role="user",
                content=f"[Image uploaded] {question}",
            )
        else:
            Message.objects.create(
                conversation=conversation,
                role="user",
                content="[Image uploaded for analysis]",
            )

        Message.objects.create(
            conversation=conversation,
            role="assistant",
            content=llm_response.content,
            provider=llm_response.provider,
            tokens_used=llm_response.tokens_used,
        )

        return Response({
            "image_query_id": image_query.id,
            "ai_response": llm_response.content,
            "conversation_id": conversation.id,
            "provider": llm_response.provider,
            "tokens_used": llm_response.tokens_used,
        })


class VoiceChatView(APIView):
    """Voice conversation: audio in -> STT -> LLM -> TTS -> audio out."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        from .serializers import VoiceChatRequestSerializer

        serializer = VoiceChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        audio_file = serializer.validated_data["audio"]
        conversation_id = serializer.validated_data.get("conversation_id")
        mode = serializer.validated_data.get("mode", "conversation")

        # 1. STT: transcribe user audio
        try:
            stt = GroqWhisperProvider()
            stt_result = stt.transcribe(audio_file=audio_file, language="fr")
        except Exception as exc:
            logger.error("STT failed in voice chat: %s", exc)
            return Response(
                {"detail": "Speech recognition is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        user_text = stt_result.transcription

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
            title = f"Voice: {user_text[:40]}..." if len(user_text) > 40 else f"Voice: {user_text}"
            conversation = Conversation.objects.create(
                user=request.user,
                title=title,
            )

        # Save user message (transcribed text)
        Message.objects.create(
            conversation=conversation,
            role="user",
            content=user_text,
        )

        # Build message history
        prior_messages = Message.objects.filter(
            conversation=conversation,
        ).order_by("created_at")
        messages = [
            {"role": msg.role, "content": msg.content}
            for msg in prior_messages
        ]

        system_prompt = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["conversation"])

        # 2. LLM: generate response
        try:
            router = create_llm_router()
            llm_response = router.generate(
                messages=messages,
                system_prompt=system_prompt,
            )
        except Exception as exc:
            logger.error("LLM call failed in voice chat: %s", exc)
            return Response(
                {"detail": "AI service is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Save assistant message
        Message.objects.create(
            conversation=conversation,
            role="assistant",
            content=llm_response.content,
            provider=llm_response.provider,
            tokens_used=llm_response.tokens_used,
        )

        # 3. TTS: generate audio of the response
        try:
            clip = get_or_create_audio(text=llm_response.content, language="fr")
            audio_url = request.build_absolute_uri(clip.audio_file.url)
        except Exception as exc:
            logger.warning("TTS failed in voice chat: %s", exc)
            audio_url = None

        # Gamification: XP for voice conversation at 5+ exchanges
        user_msg_count = Message.objects.filter(
            conversation=conversation, role="user",
        ).count()
        if user_msg_count == 5:
            from apps.gamification.services import award_xp, check_streak
            award_xp(
                request.user,
                activity_type="ai_conversation",
                xp_amount=15,
                source_id=f"conversation_{conversation.id}",
            )
            check_streak(request.user)

        return Response({
            "transcription": user_text,
            "ai_response_text": llm_response.content,
            "ai_response_audio_url": audio_url,
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
