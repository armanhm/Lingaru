import logging

from django.contrib.auth import get_user_model
from django.db.models import Sum
from telegram import Update
from telegram.ext import ContextTypes

from apps.bot.handlers.start import get_or_create_telegram_user
from apps.gamification.models import UserBadge
from apps.gamification.services import get_level, get_or_create_stats
from apps.practice.models import QuizSession

logger = logging.getLogger(__name__)

User = get_user_model()


def get_user_stats(user) -> dict:
    """Compute gamification and quiz stats for a user."""
    stats = get_or_create_stats(user)
    level_name, _ = get_level(stats.total_xp)

    completed_sessions = QuizSession.objects.filter(
        user=user,
        completed_at__isnull=False,
    )
    aggregates = completed_sessions.aggregate(
        total_correct=Sum("score"),
        total_questions=Sum("total_questions"),
    )

    badges_count = UserBadge.objects.filter(user=user).count()

    return {
        "username": user.first_name or user.username,
        "total_xp": stats.total_xp,
        "level_name": level_name,
        "current_streak": stats.current_streak,
        "longest_streak": stats.longest_streak,
        "badges_count": badges_count,
        "quizzes_completed": completed_sessions.count(),
        "total_correct": aggregates["total_correct"] or 0,
        "total_questions": aggregates["total_questions"] or 0,
    }


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /stats command — show user gamification statistics."""
    tg_user = update.effective_user
    user, _ = get_or_create_telegram_user(
        telegram_id=tg_user.id,
        first_name=tg_user.first_name or "",
        username=tg_user.username,
    )

    stats = get_user_stats(user)

    accuracy = (
        round(stats["total_correct"] / stats["total_questions"] * 100)
        if stats["total_questions"] > 0
        else 0
    )

    message = (
        f"Stats for {stats['username']}:\n\n"
        f"Level: {stats['level_name']}\n"
        f"XP: {stats['total_xp']}\n"
        f"Streak: {stats['current_streak']} days "
        f"(best: {stats['longest_streak']})\n"
        f"Badges: {stats['badges_count']}\n\n"
        f"Quizzes completed: {stats['quizzes_completed']}\n"
        f"Correct answers: {stats['total_correct']}/{stats['total_questions']}\n"
        f"Accuracy: {accuracy}%"
    )
    await update.message.reply_text(message)
