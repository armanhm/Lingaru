from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.gamification.services import award_xp, check_streak
from .models import ExamExercise, ExamSession, ExamResponse, ExamProgress
from .scoring import score_to_cefr, XP_EXAM_PRACTICE, XP_EXAM_MOCK_COMPLETE, XP_EXAM_PERFECT
from .serializers import (
    ExerciseListSerializer, ExerciseDetailSerializer,
    SessionStartSerializer, RespondSerializer, ResponseResultSerializer,
    SessionCompleteSerializer, SessionHistorySerializer,
)


class HubView(APIView):
    """Returns per-section progress for the exam prep hub page."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        sections = []
        for code, label in [("CO", "Compréhension orale"), ("CE", "Compréhension écrite"),
                            ("EE", "Expression écrite"), ("EO", "Expression orale")]:
            exercise_count = ExamExercise.objects.filter(section=code, is_active=True).count()
            progress = ExamProgress.objects.filter(user=request.user, section=code).first()
            sections.append({
                "code": code,
                "label": label,
                "exercise_count": exercise_count,
                "sessions_completed": progress.sessions_completed if progress else 0,
                "best_score_pct": progress.best_score_pct if progress else 0,
                "estimated_cefr": progress.estimated_cefr_level if progress else "",
            })
        return Response({"sections": sections})


class ExerciseListView(APIView):
    """List exercises filtered by section and optional CEFR level."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        section = request.query_params.get("section", "")
        level = request.query_params.get("level", "")
        qs = ExamExercise.objects.filter(is_active=True)
        if section:
            qs = qs.filter(section=section)
        if level:
            qs = qs.filter(cefr_level=level)
        return Response(ExerciseListSerializer(qs, many=True).data)


class SessionStartView(APIView):
    """Start a new exam session — returns exercises with content."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = SessionStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        section = serializer.validated_data["section"]
        level = serializer.validated_data["cefr_level"]
        mode = serializer.validated_data.get("mode", "practice")

        exercises = ExamExercise.objects.filter(
            section=section, cefr_level=level, is_active=True
        ).order_by("order")

        if not exercises.exists():
            return Response(
                {"detail": "No exercises available for this section and level."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # For CO exercises, generate audio URLs
        if section == "CO":
            from services.tts.service import get_or_create_audio
            for ex in exercises:
                passage = ex.content.get("passage_fr", "")
                if passage and "audio_url" not in ex.content:
                    try:
                        clip = get_or_create_audio(passage, language="fr")
                        if clip and hasattr(clip, "audio_file"):
                            ex.content["audio_url"] = request.build_absolute_uri(clip.audio_file.url)
                    except Exception:
                        pass  # TTS failure is non-fatal

        # Calculate total time and max score
        total_questions = sum(len(ex.content.get("questions", [])) for ex in exercises)
        total_time = sum(ex.time_limit_seconds for ex in exercises) if mode == "mock" else 0

        session = ExamSession.objects.create(
            user=request.user,
            section=section,
            cefr_level=level,
            mode=mode,
            time_limit_seconds=total_time,
            max_score=total_questions,
        )

        return Response({
            "session_id": session.id,
            "section": section,
            "cefr_level": level,
            "mode": mode,
            "time_limit_seconds": total_time,
            "exercises": ExerciseDetailSerializer(exercises, many=True).data,
        }, status=status.HTTP_201_CREATED)


class SessionRespondView(APIView):
    """Submit an answer for one question in an exam session."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, session_id):
        try:
            session = ExamSession.objects.get(pk=session_id, user=request.user)
        except ExamSession.DoesNotExist:
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

        if session.completed_at:
            return Response({"detail": "Session already completed."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = RespondSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        exercise_id = serializer.validated_data["exercise_id"]
        question_index = serializer.validated_data["question_index"]
        user_answer = serializer.validated_data["answer"]

        try:
            exercise = ExamExercise.objects.get(pk=exercise_id)
        except ExamExercise.DoesNotExist:
            return Response({"detail": "Exercise not found."}, status=status.HTTP_404_NOT_FOUND)

        # Check answer for MCQ-based sections (CE, CO)
        questions = exercise.content.get("questions", [])
        if question_index >= len(questions):
            return Response({"detail": "Invalid question index."}, status=status.HTTP_400_BAD_REQUEST)

        question = questions[question_index]
        correct_answer = question.get("correct_answer", "")
        is_correct = user_answer.strip().lower() == correct_answer.strip().lower()

        response = ExamResponse.objects.create(
            session=session,
            exercise=exercise,
            question_index=question_index,
            user_answer=user_answer,
            is_correct=is_correct,
            score=1 if is_correct else 0,
            max_score=1,
        )

        result = ResponseResultSerializer(response).data
        result["correct_answer"] = correct_answer
        result["explanation"] = question.get("explanation", "")
        return Response(result)


class SessionCompleteView(APIView):
    """Complete an exam session — calculate score, award XP, update progress."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, session_id):
        try:
            session = ExamSession.objects.get(pk=session_id, user=request.user)
        except ExamSession.DoesNotExist:
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

        if session.completed_at:
            return Response({"detail": "Session already completed."}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate score
        responses = session.responses.all()
        total_score = sum(r.score for r in responses)
        total_max = sum(r.max_score for r in responses) or 1
        session.score = total_score
        session.max_score = total_max
        session.completed_at = timezone.now()
        session.save()

        # Award XP
        pct = (total_score / total_max) * 100 if total_max > 0 else 0
        xp = XP_EXAM_MOCK_COMPLETE if session.mode == "mock" else XP_EXAM_PRACTICE
        if pct == 100:
            xp += XP_EXAM_PERFECT

        award_xp(request.user, activity_type=f"exam_{session.section}_{session.mode}", xp_amount=xp)
        check_streak(request.user)

        # Update progress
        progress, _ = ExamProgress.objects.get_or_create(user=request.user, section=session.section)
        progress.sessions_completed += 1
        if pct > progress.best_score_pct:
            progress.best_score_pct = pct
        progress.estimated_cefr_level = score_to_cefr(progress.best_score_pct)
        progress.save()

        data = SessionCompleteSerializer(session).data
        data["xp_earned"] = xp
        return Response(data)


class SessionHistoryView(APIView):
    """List past exam sessions for the authenticated user."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        section = request.query_params.get("section", "")
        qs = ExamSession.objects.filter(user=request.user, completed_at__isnull=False)
        if section:
            qs = qs.filter(section=section)
        return Response(SessionHistorySerializer(qs[:20], many=True).data)
