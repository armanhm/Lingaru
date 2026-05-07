import logging
import random

from asgiref.sync import sync_to_async
from django.db.models import Count, Q
from django.utils import timezone
from telegram import Update
from telegram.ext import (
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from apps.bot.handlers.start import get_or_create_telegram_user
from apps.content.models import Lesson, Question
from apps.practice.models import QuizAnswer, QuizSession

logger = logging.getLogger(__name__)

# Conversation states
ANSWERING = 0


def pick_quiz_lesson(topic_name: str | None) -> Lesson | None:
    """Pick a random lesson that has questions.

    If topic_name is provided, filter by topic name (case-insensitive
    partial match against name_en or name_fr). Returns None if no
    suitable lesson is found.
    """
    lessons = Lesson.objects.annotate(
        question_count=Count("questions"),
    ).filter(question_count__gt=0)

    if topic_name:
        lessons = lessons.filter(
            Q(topic__name_en__icontains=topic_name) | Q(topic__name_fr__icontains=topic_name)
        )

    lesson = lessons.order_by("?").first()
    return lesson


def check_answer(user_answer: str, correct_answer: str) -> bool:
    """Check if the user's answer matches the correct answer.

    Case-insensitive, strips whitespace.
    """
    return user_answer.strip().lower() == correct_answer.strip().lower()


def build_question_text(question: Question) -> str:
    """Format a question for display in Telegram.

    For MCQ questions, shuffle and display the options as a numbered list.
    For other types, show just the prompt.
    """
    text = f"Q: {question.prompt}"

    if question.type == "mcq" and question.wrong_answers:
        options = [question.correct_answer] + list(question.wrong_answers)
        random.shuffle(options)
        option_lines = [f"  {i + 1}. {opt}" for i, opt in enumerate(options)]
        text += "\n\n" + "\n".join(option_lines)
        text += "\n\nReply with the correct answer text."

    return text


def create_quiz_session(user, lesson: Lesson) -> QuizSession:
    """Create a new QuizSession for the given user and lesson."""
    question_count = Question.objects.filter(lesson=lesson).count()
    return QuizSession.objects.create(
        user=user,
        lesson=lesson,
        total_questions=question_count,
    )


def record_answer(
    session: QuizSession,
    question: Question,
    user_answer: str,
) -> QuizAnswer:
    """Record a quiz answer and return the QuizAnswer object."""
    is_correct = check_answer(user_answer, question.correct_answer)
    return QuizAnswer.objects.create(
        session=session,
        question=question,
        user_answer=user_answer,
        is_correct=is_correct,
    )


def complete_quiz_session(session: QuizSession) -> QuizSession:
    """Mark a quiz session as complete with the final score."""
    correct_count = session.answers.filter(is_correct=True).count()
    session.score = correct_count
    session.completed_at = timezone.now()
    session.save()
    return session


async def quiz_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle /quiz [topic] — start a new quiz conversation."""
    tg_user = update.effective_user
    user, _ = await sync_to_async(get_or_create_telegram_user)(
        telegram_id=tg_user.id,
        first_name=tg_user.first_name or "",
        username=tg_user.username,
    )

    # Parse optional topic argument
    args = context.args
    topic_name = " ".join(args) if args else None

    lesson = await sync_to_async(pick_quiz_lesson)(topic_name)
    if lesson is None:
        topic_msg = f' for topic "{topic_name}"' if topic_name else ""
        await update.message.reply_text(f"No quiz available{topic_msg}. Try /quiz without a topic!")
        return ConversationHandler.END

    session = await sync_to_async(create_quiz_session)(user, lesson)
    questions = await sync_to_async(
        lambda: list(Question.objects.filter(lesson=lesson).order_by("?"))
    )()

    # Store quiz state in context.user_data
    context.user_data["quiz_session_id"] = session.id
    context.user_data["quiz_questions"] = [q.id for q in questions]
    context.user_data["quiz_current_index"] = 0
    context.user_data["quiz_score"] = 0

    await update.message.reply_text(
        f"Starting quiz: {lesson.title}\n"
        f"Topic: {lesson.topic.name_en}\n"
        f"Questions: {len(questions)}\n\n"
        f"Send /cancel to quit at any time.\n"
    )

    # Send first question
    first_question = questions[0]
    # Stash the lesson title for the cancel handler so we don't reload it
    context.user_data["quiz_lesson_title"] = lesson.title
    await update.message.reply_text(build_question_text(first_question))

    return ANSWERING


async def quiz_answer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle a user's answer to a quiz question."""
    user_answer = update.message.text
    question_ids = context.user_data["quiz_questions"]
    current_index = context.user_data["quiz_current_index"]
    session_id = context.user_data["quiz_session_id"]

    session = await sync_to_async(QuizSession.objects.get)(pk=session_id)
    question = await sync_to_async(Question.objects.get)(pk=question_ids[current_index])

    answer = await sync_to_async(record_answer)(session, question, user_answer)

    if answer.is_correct:
        context.user_data["quiz_score"] += 1
        feedback = "Correct!"
    else:
        feedback = f"Incorrect. The answer was: {question.correct_answer}"

    if question.explanation:
        feedback += f"\n{question.explanation}"

    # Move to next question
    next_index = current_index + 1
    context.user_data["quiz_current_index"] = next_index

    if next_index >= len(question_ids):
        # Quiz complete
        completed_session = await sync_to_async(complete_quiz_session)(session)
        score = completed_session.score
        total = completed_session.total_questions

        await update.message.reply_text(
            f"{feedback}\n\n"
            f"Quiz complete!\n"
            f"Score: {score}/{total}\n"
            f"{'Great job!' if score == total else 'Keep practicing!'}"
        )

        # Clean up user_data
        for key in ["quiz_session_id", "quiz_questions", "quiz_current_index", "quiz_score"]:
            context.user_data.pop(key, None)

        return ConversationHandler.END

    # Send next question
    next_question = await sync_to_async(Question.objects.get)(pk=question_ids[next_index])
    await update.message.reply_text(
        f"{feedback}\n\n"
        f"Question {next_index + 1}/{len(question_ids)}:\n"
        f"{build_question_text(next_question)}"
    )

    return ANSWERING


async def quiz_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle /cancel — abort the current quiz."""
    session_id = context.user_data.get("quiz_session_id")
    if session_id:

        def _close():
            try:
                session = QuizSession.objects.get(pk=session_id)
                complete_quiz_session(session)
            except QuizSession.DoesNotExist:
                pass

        await sync_to_async(_close)()

    for key in ["quiz_session_id", "quiz_questions", "quiz_current_index", "quiz_score"]:
        context.user_data.pop(key, None)

    await update.message.reply_text("Quiz cancelled. Use /quiz to start a new one!")
    return ConversationHandler.END


def quiz_conversation_handler() -> ConversationHandler:
    """Build the ConversationHandler for the /quiz flow."""
    return ConversationHandler(
        entry_points=[CommandHandler("quiz", quiz_start)],
        states={
            ANSWERING: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, quiz_answer),
            ],
        },
        fallbacks=[CommandHandler("cancel", quiz_cancel)],
    )
