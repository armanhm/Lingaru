import json
import logging
import re

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.content.models import Lesson, Question, Topic, Vocabulary
from apps.progress.models import SRSCard
from services.llm.factory import create_llm_router

from .models import Note
from .serializers import NoteDetailSerializer, NoteListSerializer

logger = logging.getLogger(__name__)

OUR_NOTES_TOPIC_NAME = "Our Notes"
OUR_NOTES_LESSON_TITLE = "Our Notes vocabulary"


def _get_or_create_our_notes_lesson() -> Lesson:
    """Return the shared Lesson used as a container for note-imported Vocabulary."""
    topic, _ = Topic.objects.get_or_create(
        name_en=OUR_NOTES_TOPIC_NAME,
        language="en",
        defaults={
            "name_fr": OUR_NOTES_TOPIC_NAME,
            "description": "Vocabulary imported from Our Notes.",
            "icon": "",
            "order": 9999,
            "difficulty_level": 1,
        },
    )
    lesson, _ = Lesson.objects.get_or_create(
        title=OUR_NOTES_LESSON_TITLE,
        language="en",
        topic=topic,
        defaults={
            "type": "vocab",
            "content": {},
            "order": 9999,
            "difficulty": 1,
        },
    )
    return lesson


class NoteListView(generics.ListAPIView):
    serializer_class = NoteListSerializer
    permission_classes = (permissions.IsAuthenticated,)
    pagination_class = None

    def get_queryset(self):
        return Note.objects.filter(
            language=self.request.user.target_language,
            is_active=True,
        )


class NoteDetailView(generics.RetrieveAPIView):
    serializer_class = NoteDetailSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Note.objects.filter(
            language=self.request.user.target_language,
            is_active=True,
        ).prefetch_related("words")


class NoteAskView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        note = get_object_or_404(
            Note,
            pk=pk,
            language=request.user.target_language,
            is_active=True,
        )
        question = (request.data.get("question") or "").strip()
        if not question:
            return Response(
                {"detail": "question is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        words = list(note.words.all())
        word_lines = []
        for w in words:
            parts = [w.word]
            if w.definition:
                parts.append(f"definition: {w.definition}")
            if w.example:
                parts.append(f"example: {w.example}")
            word_lines.append(" — ".join(parts))
        words_block = "\n".join(f"- {line}" for line in word_lines) or "(no words)"

        title_line = f"Title: {note.title}\n" if note.title else ""
        system_prompt = (
            "You are an English vocabulary tutor helping a learner study a "
            "single study note. The note contains a list of words, with "
            "optional definitions and examples. Answer the learner's "
            "question using ONLY the words in this note as context. If the "
            "question is unrelated to the note's words, gently steer back. "
            "Keep replies short and clear.\n\n"
            f"Note number: {note.note_number}\n"
            f"{title_line}"
            f"Words in this note:\n{words_block}"
        )

        try:
            router = create_llm_router()
            llm_response = router.generate(
                messages=[{"role": "user", "content": question}],
                system_prompt=system_prompt,
            )
        except Exception as exc:
            logger.error("LLM call failed in NoteAskView: %s", exc)
            return Response(
                {"detail": "AI service is temporarily unavailable. Please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({"answer": llm_response.content})


class NoteAddToSrsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        note = get_object_or_404(
            Note,
            pk=pk,
            language=request.user.target_language,
            is_active=True,
        )

        lesson = _get_or_create_our_notes_lesson()
        created_count = 0
        existing_count = 0

        with transaction.atomic():
            for nw in note.words.all():
                vocab, _ = Vocabulary.objects.get_or_create(
                    english=nw.word,
                    french=nw.word,
                    language="en",
                    lesson=lesson,
                    defaults={
                        "example_sentence": nw.example or "",
                    },
                )
                _, was_created = SRSCard.objects.get_or_create(
                    user=request.user,
                    vocabulary=vocab,
                )
                if was_created:
                    created_count += 1
                else:
                    existing_count += 1

        return Response({"created": created_count, "existing": existing_count})


class NoteGenerateQuizView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        note = get_object_or_404(
            Note,
            pk=pk,
            language=request.user.target_language,
            is_active=True,
        )
        words = list(note.words.all())
        if not words:
            return Response(
                {"detail": "Note has no words to quiz on."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        word_lines = []
        for w in words:
            parts = [w.word]
            if w.definition:
                parts.append(f"definition: {w.definition}")
            if w.example:
                parts.append(f"example: {w.example}")
            word_lines.append(" — ".join(parts))
        words_block = "\n".join(f"- {line}" for line in word_lines)

        system_prompt = (
            "You are a quiz generator for English vocabulary. Generate "
            "between 5 and 10 multiple-choice questions covering the words "
            "in the provided note. Each question must have exactly 4 "
            "choices (one correct, three plausible distractors). Return "
            "ONLY a JSON array, no prose, no fences. Each item must have "
            "the shape: "
            '{"prompt": "...", "correct_answer": "...", '
            '"wrong_answers": ["...", "...", "..."], '
            '"explanation": "..."}.'
        )
        user_message = (
            f"Words from study note #{note.note_number}:\n{words_block}\n\n"
            "Produce 5 to 10 multiple-choice questions covering these words."
        )

        try:
            router = create_llm_router()
            llm_response = router.generate(
                messages=[{"role": "user", "content": user_message}],
                system_prompt=system_prompt,
            )
        except Exception as exc:
            logger.error("LLM call failed in NoteGenerateQuizView: %s", exc)
            return Response(
                {"detail": "AI service is temporarily unavailable. Please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            questions_data = _parse_quiz_json(llm_response.content)
        except ValueError as exc:
            logger.error("Quiz JSON parse failed: %s\nraw=%s", exc, llm_response.content)
            return Response(
                {"detail": "Quiz generation produced invalid output. Please retry."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        topic, _ = Topic.objects.get_or_create(
            name_en=OUR_NOTES_TOPIC_NAME,
            language="en",
            defaults={
                "name_fr": OUR_NOTES_TOPIC_NAME,
                "description": "Vocabulary imported from Our Notes.",
                "icon": "",
                "order": 9999,
                "difficulty_level": 1,
            },
        )

        with transaction.atomic():
            lesson = Lesson.objects.create(
                topic=topic,
                type="vocab",
                title=f"Quiz: Note {note.note_number}",
                content={"note_id": note.id, "note_number": note.note_number},
                order=0,
                difficulty=1,
                language="en",
            )
            for item in questions_data:
                Question.objects.create(
                    lesson=lesson,
                    type="mcq",
                    prompt=item.get("prompt", ""),
                    correct_answer=item.get("correct_answer", ""),
                    wrong_answers=item.get("wrong_answers", []),
                    explanation=item.get("explanation", ""),
                    difficulty=1,
                    language="en",
                )

        return Response(
            {"lesson_id": lesson.id, "question_count": len(questions_data)},
            status=status.HTTP_201_CREATED,
        )


def _parse_quiz_json(raw: str) -> list[dict]:
    """Extract a list of MCQ dicts from a raw LLM response.

    Strips ```json``` fences if present, falls back to the first [...] block.
    """
    text = raw.strip()
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        array_match = re.search(r"\[.*\]", text, re.DOTALL)
        if not array_match:
            raise ValueError("no JSON array found in LLM output")
        data = json.loads(array_match.group(0))

    if not isinstance(data, list):
        raise ValueError("LLM output is not a JSON array")
    if not data:
        raise ValueError("LLM output is an empty array")
    return data
