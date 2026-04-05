import logging

from django.contrib.auth import get_user_model
from django.db.models import Sum
from telegram import Update
from telegram.ext import ContextTypes

from apps.bot.handlers.start import get_or_create_telegram_user
from apps.practice.models import QuizSession

logger = logging.getLogger(__name__)

User = get_user_model()


def get_user_stats(user) -> dict:
    """Compute basic quiz stats for a user.

    Returns a dict with quizzes_completed, total_correct,
    total_questions, and username.

    Note: XP, level, and streak will be added in Phase 6
    (gamification). For now, stats are quiz-based only.
    """
    completed_sessions = QuizSession.objects.filter(
        user=user,
        completed_at__isnull=False,
    )

    aggregates = completed_sessions.aggregate(
        total_correct=Sum("score"),
        total_questions=Sum("total_questions"),
    )

    return {
        "username": user.first_name or user.username,
        "quizzes_completed": completed_sessions.count(),
        "total_correct": aggregates["total_correct"] or 0,
        "total_questions": aggregates["total_questions"] or 0,
    }


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /stats command — show user quiz statistics."""
    tg_user = update.effective_user
    user, _ = get_or_create_telegram_user(
        telegram_id=tg_user.id,
        first_name=tg_user.first_name or "",
        username=tg_user.username,
    )

    stats = get_user_stats(user)

    if stats["quizzes_completed"] == 0:
        await update.message.reply_text(
            f"Hi {stats['username']}! You haven't completed any quizzes yet.\n"
            f"Try /quiz to start one!"
        )
        return

    accuracy = (
        round(stats["total_correct"] / stats["total_questions"] * 100)
        if stats["total_questions"] > 0 else 0
    )

    message = (
        f"Stats for {stats['username']}:\n\n"
        f"Quizzes completed: {stats['quizzes_completed']}\n"
        f"Correct answers: {stats['total_correct']}/{stats['total_questions']}\n"
        f"Accuracy: {accuracy}%\n\n"
        f"XP, level, and streaks coming soon!"
    )
    await update.message.reply_text(message)
