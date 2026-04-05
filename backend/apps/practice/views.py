import unicodedata

from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.content.models import Question
from apps.gamification.services import award_xp, check_streak
from .models import QuizSession, QuizAnswer


def _strip_accents(text: str) -> str:
    """Remove diacritics: réunion → reunion, café → cafe."""
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )


def _levenshtein(a: str, b: str) -> int:
    """Simple Levenshtein distance."""
    if a == b:
        return 0
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (ca != cb)))
        prev = curr
    return prev[-1]


def answers_match(user_answer: str, correct_answer: str) -> bool:
    """Return True if the answer is correct, allowing for:
    - case differences
    - leading/trailing articles (le, la, les, l', un, une)
    - missing or wrong accents (réunion ≈ reunion)
    - a single-character typo (Levenshtein distance ≤ 1) for words 4+ chars
    """
    def normalise(s: str) -> str:
        s = s.strip().lower()
        # Strip leading articles so "la réunion" matches "réunion"
        for article in ("l'", "le ", "la ", "les ", "un ", "une "):
            if s.startswith(article):
                s = s[len(article):]
                break
        return s

    user = normalise(user_answer)
    correct = normalise(correct_answer)

    if user == correct:
        return True

    # Accent-insensitive comparison
    if _strip_accents(user) == _strip_accents(correct):
        return True

    # Allow 1-char typo for answers that are at least 4 characters
    if len(correct) >= 4 and _levenshtein(user, correct) <= 1:
        return True

    # Also try accent-stripped levenshtein
    if len(correct) >= 4 and _levenshtein(_strip_accents(user), _strip_accents(correct)) <= 1:
        return True

    return False
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

        is_correct = answers_match(user_answer, question.correct_answer)

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
