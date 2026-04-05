from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.content.models import Question
from apps.gamification.services import award_xp, check_streak
from .models import QuizSession, QuizAnswer
from .serializers import (
    QuizStartSerializer,
    QuizQuestionSerializer,
    AnswerSubmitSerializer,
    AnswerResultSerializer,
    QuizCompleteSerializer,
    QuizHistorySerializer,
)


class QuizStartView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = QuizStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lesson_id = serializer.validated_data["lesson_id"]
        questions = Question.objects.filter(lesson_id=lesson_id)

        if not questions.exists():
            return Response(
                {"detail": "This lesson has no questions available."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session = QuizSession.objects.create(
            user=request.user,
            lesson_id=lesson_id,
            total_questions=questions.count(),
        )

        return Response(
            {
                "session_id": session.id,
                "questions": QuizQuestionSerializer(questions, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


class QuizAnswerView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, session_id):
        try:
            session = QuizSession.objects.get(
                pk=session_id, user=request.user,
            )
        except QuizSession.DoesNotExist:
            return Response(
                {"detail": "Quiz session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if session.completed_at is not None:
            return Response(
                {"detail": "This quiz is already completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AnswerSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question_id = serializer.validated_data["question_id"]
        user_answer = serializer.validated_data["answer"]

        try:
            question = Question.objects.get(pk=question_id)
        except Question.DoesNotExist:
            return Response(
                {"detail": "Question not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if QuizAnswer.objects.filter(session=session, question=question).exists():
            return Response(
                {"detail": "This question was already answered."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_correct = user_answer.strip().lower() == question.correct_answer.strip().lower()

        answer = QuizAnswer.objects.create(
            session=session,
            question=question,
            user_answer=user_answer,
            is_correct=is_correct,
        )

        # Record mistake if wrong
        if not is_correct:
            from apps.progress.services import record_mistake
            record_mistake(
                user=request.user,
                question=question,
                user_answer=user_answer,
                correct_answer=question.correct_answer,
            )

        return Response(AnswerResultSerializer(answer).data)


class QuizCompleteView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, session_id):
        try:
            session = QuizSession.objects.select_related("lesson").get(
                pk=session_id, user=request.user,
            )
        except QuizSession.DoesNotExist:
            return Response(
                {"detail": "Quiz session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if session.completed_at is not None:
            return Response(
                {"detail": "This quiz is already completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        correct_count = session.answers.filter(is_correct=True).count()
        session.score = correct_count
        session.completed_at = timezone.now()
        session.save()

        # --- Gamification: award XP ---
        source = f"quiz_session_{session.id}"

        # XP per correct answer
        if correct_count > 0:
            award_xp(
                request.user,
                activity_type="quiz_correct",
                xp_amount=correct_count * 5,
                source_id=source,
            )

        # Perfect score bonus
        if correct_count == session.total_questions and session.total_questions > 0:
            award_xp(
                request.user,
                activity_type="quiz_perfect",
                xp_amount=25,
                source_id=source,
            )

        # Update streak
        check_streak(request.user)

        return Response(QuizCompleteSerializer(session).data)


class QuizHistoryView(generics.ListAPIView):
    serializer_class = QuizHistorySerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return QuizSession.objects.filter(
            user=self.request.user,
        ).select_related("lesson")
