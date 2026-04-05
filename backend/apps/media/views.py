from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from services.tts.service import get_or_create_audio
from services.stt.groq_whisper import GroqWhisperProvider
from services.stt.scoring import calculate_accuracy, generate_feedback
from apps.gamification.services import award_xp, check_streak
from .models import AudioClip, PronunciationAttempt
from .serializers import (
    TTSRequestSerializer,
    AudioClipSerializer,
    PronunciationCheckSerializer,
    PronunciationResultSerializer,
)


class TTSView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = TTSRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        text = serializer.validated_data["text"]
        language = serializer.validated_data.get("language", "fr")

        clip = get_or_create_audio(text=text, language=language)

        return Response(
            AudioClipSerializer(clip, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class PronunciationCheckView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = PronunciationCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        audio_file = serializer.validated_data["audio"]
        expected_text = serializer.validated_data["expected_text"]
        vocabulary_id = serializer.validated_data.get("vocabulary_id")

        # Transcribe
        stt = GroqWhisperProvider()
        result = stt.transcribe(audio_file=audio_file, language="fr")

        # Score
        accuracy = calculate_accuracy(expected_text, result.transcription)
        feedback = generate_feedback(accuracy, expected_text, result.transcription)

        # Save attempt
        attempt = PronunciationAttempt.objects.create(
            user=request.user,
            vocabulary_id=vocabulary_id,
            expected_text=expected_text,
            audio_file=audio_file,
            transcription=result.transcription,
            accuracy_score=accuracy,
            feedback=feedback,
        )

        # Award XP for pronunciation practice
        award_xp(
            request.user,
            activity_type="pronunciation",
            xp_amount=5,
            source_id=f"pronunciation_{attempt.id}",
        )
        check_streak(request.user)

        return Response(
            PronunciationResultSerializer(attempt).data,
            status=status.HTTP_200_OK,
        )
