import logging
import re

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from services.llm.factory import create_llm_router

from .models import MyNote
from .serializers import MyNoteDetailSerializer, MyNoteListSerializer

logger = logging.getLogger(__name__)

ALLOWED_AI_ACTIONS = {
    "summarize",
    "enhance_format",
    "fix_grammar",
    "more_examples",
    "ice_breakers",
    "practice_questions",
    "suggest_tags",
}


class MyNoteViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated,)
    pagination_class = None

    def get_serializer_class(self):
        if self.action == "list":
            return MyNoteListSerializer
        return MyNoteDetailSerializer

    def get_queryset(self):
        qs = MyNote.objects.filter(user=self.request.user)
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(title__icontains=q) | Q(body_markdown__icontains=q) | Q(tags__icontains=q)
            )
        kind = self.request.query_params.get("kind")
        if kind:
            qs = qs.filter(kind=kind)
        tag = self.request.query_params.get("tag")
        if tag:
            qs = qs.filter(tags__icontains=tag.lower())
        if self.request.query_params.get("favorite") in ("1", "true"):
            qs = qs.filter(is_favorite=True)
        language = self.request.query_params.get("language")
        if language and language != "all":
            qs = qs.filter(language=language)
        return qs

    def perform_create(self, serializer):
        if "language" not in serializer.validated_data:
            serializer.validated_data["language"] = self.request.user.target_language
        serializer.save(user=self.request.user)


class PublicMyNoteView(generics.RetrieveAPIView):
    """GET /api/my-notes/public/<id>/ — read-only access to a publicly
    shared note by id. Requires login but works across users."""

    permission_classes = (IsAuthenticated,)
    serializer_class = MyNoteDetailSerializer
    queryset = MyNote.objects.filter(is_public=True)


class MyNoteAIActionView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, pk):
        note = get_object_or_404(MyNote, pk=pk, user=request.user)
        action = request.data.get("action")
        if action not in ALLOWED_AI_ACTIONS:
            return Response(
                {"detail": f"Unknown action: {action}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not note.body_markdown.strip() and action != "suggest_tags":
            return Response(
                {"detail": "Note body is empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        system_prompt, user_message = _build_ai_prompt(note, action)
        try:
            router = create_llm_router()
            response = router.generate(
                messages=[{"role": "user", "content": user_message}],
                system_prompt=system_prompt,
            )
        except Exception as exc:
            logger.error("LLM call failed for MyNote ai-action %s: %s", action, exc)
            return Response(
                {"detail": "AI service unavailable. Try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if action == "suggest_tags":
            tags = _extract_suggested_tags(response.content or "")
            return Response({"tags": tags})

        return Response({"result": (response.content or "").strip()})


def _build_ai_prompt(note, action):
    lang_name = "French" if note.language == "fr" else "English"
    write_in = (
        f"Respond ONLY in {lang_name}."
        if action != "suggest_tags"
        else "Respond ONLY with comma-separated lowercase tags."
    )
    tags_str = ", ".join(note.tags) if note.tags else "(none)"
    context = (
        f"This is a personal language-learning practice session.\n"
        f"Language being studied: {lang_name}.\n"
        f"Kind: {note.get_kind_display()}.\n"
        f"Title: {note.title}.\n"
        f"Tags: {tags_str}.\n"
    )
    body = note.body_markdown

    if action == "summarize":
        system = (
            "You summarize a language-learning study note into exactly 3 "
            "concise markdown bullets. Return ONLY the bullets, no preamble, "
            "no closing remarks. " + write_in
        )
        user = (
            f"{context}\nBody:\n---\n{body}\n---\n\n"
            "Summarize the body in exactly 3 markdown bullets."
        )
    elif action == "enhance_format":
        system = (
            "You reformat a language-learning study note's markdown for "
            "clarity. Add headings where structure warrants, turn loose "
            "lines into bullets or numbered lists when appropriate, fix "
            "broken tables, and correct obvious typos. PRESERVE all "
            "meaning and content — do not add new information or remove "
            "anything substantive. Return ONLY the reformatted markdown, "
            "no preamble. " + write_in
        )
        user = f"{context}\nBody:\n---\n{body}\n---\n\nReturn the full reformatted markdown."
    elif action == "fix_grammar":
        system = (
            f"You fix language errors in a study note written in {lang_name}. "
            "Correct grammar, spelling, agreement and punctuation in that "
            "language only. Preserve all markdown formatting. Return ONLY "
            "the corrected text, no preamble or commentary. If there are "
            "no errors, return the body verbatim. " + write_in
        )
        user = (
            f"{context}\nBody:\n---\n{body}\n---\n\nReturn the full corrected body in {lang_name}."
        )
    elif action == "more_examples":
        system = (
            "You extend a language-learning study note with 5 additional "
            "example sentences. If the note is vocabulary, reuse the same "
            "words. If grammar, apply the same rule. If a dialog, continue "
            "in the same style. Return ONLY a markdown bullet list of 5 "
            "items, no preamble. " + write_in
        )
        user = (
            f"{context}\nBody:\n---\n{body}\n---\n\n"
            "Produce 5 more example sentences as markdown bullets."
        )
    elif action == "ice_breakers":
        system = (
            "You generate conversation-starter questions in "
            f"{lang_name} based on the topic of a study note, useful for "
            "someone preparing for a real-life conversation. Return ONLY a "
            "numbered markdown list of exactly 5 questions, no preamble. " + write_in
        )
        user = (
            f"{context}\nBody:\n---\n{body}\n---\n\n"
            "Produce 5 conversation-starter questions as a numbered list."
        )
    elif action == "practice_questions":
        system = (
            "You generate self-test questions for a language-learning "
            "study note. Produce exactly 3 questions. After each question, "
            "add an italicized answer line in the form `_Answer:_ ...`. "
            "Return ONLY the markdown, no preamble. " + write_in
        )
        user = (
            f"{context}\nBody:\n---\n{body}\n---\n\n"
            "Produce 3 self-test questions, each followed by an "
            "`_Answer:_` line."
        )
    elif action == "suggest_tags":
        system = (
            "You suggest 3 to 5 short lowercase tags for a language-learning "
            "study note. Each tag is 1 or 2 words, no hashes, no quotes. "
            "Output ONLY the tags, comma-separated, on a single line. " + write_in
        )
        user = (
            f"{context}\nBody:\n---\n{body}\n---\n\n"
            "Suggest 3 to 5 short lowercase tags, comma-separated."
        )
    else:  # pragma: no cover - guarded by ALLOWED_AI_ACTIONS upstream
        raise ValueError(f"Unknown action: {action}")

    return system, user


def _extract_suggested_tags(raw):
    parts = re.split(r"[,\n]+", raw)
    seen = []
    for p in parts:
        t = p.strip().strip("#").lower()
        if t and t not in seen and len(t) <= 40:
            seen.append(t)
    return seen[:5]
