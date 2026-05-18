"""Post-turn memory extractor. Detects 'remember X' intent in a chat
turn and persists a MemoryNote with source='assistant_detected'.

Runs SYNCHRONOUSLY in the chat request. Adds ~300-500ms per turn.
Never raises, always writes a MemoryExtractionLog audit row.

Routing: uses a dedicated ProviderRouter instance with Groq as primary
(faster + cheaper for this thin classification task) and Gemini as
fallback. Not the same router instance the chat view uses.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.memory.models import MAX_NOTE_CONTENT_LENGTH, MemoryExtractionLog, MemoryNote
from services.llm.base import BaseProvider
from services.llm.gemini import GeminiProvider
from services.llm.groq_provider import GroqProvider
from services.llm.router import ProviderRouter

from .prompts import EXTRACTOR_SYSTEM_PROMPT, build_extractor_user_message

logger = logging.getLogger(__name__)

DAILY_EXTRACTION_CAP = 3
VALID_CATEGORIES = {"goal", "preference", "background", "weakness", "other"}


def maybe_extract_note(
    *,
    user,
    user_message: str,
    assistant_response: str,
    message=None,
) -> MemoryNote | None:
    """Try to extract a memory-worthy fact from the just-finished turn.

    Returns the saved MemoryNote on success, None otherwise. Always
    writes a MemoryExtractionLog row (extracted=True if a note was
    created, extracted=False otherwise with the failure reason in
    raw_output).

    Never raises.
    """
    # Cap check first: do not even make the LLM call if we are over.
    cutoff = timezone.now() - timedelta(hours=24)
    recent_success_count = MemoryExtractionLog.objects.filter(
        user=user,
        extracted=True,
        created_at__gte=cutoff,
    ).count()
    if recent_success_count >= DAILY_EXTRACTION_CAP:
        MemoryExtractionLog.objects.create(
            user=user,
            message=message,
            extracted=False,
            raw_output=f"cap reached: {recent_success_count} >= {DAILY_EXTRACTION_CAP} in last 24h",
        )
        return None

    raw_output = ""
    try:
        router = _build_router()
        response = router.generate(
            messages=[
                {
                    "role": "user",
                    "content": build_extractor_user_message(user_message, assistant_response),
                }
            ],
            system_prompt=EXTRACTOR_SYSTEM_PROMPT,
        )
        raw_output = response.content
        payload = _parse_json(raw_output)
    except Exception as exc:
        MemoryExtractionLog.objects.create(
            user=user,
            message=message,
            extracted=False,
            raw_output=f"{type(exc).__name__}: {exc}\n---raw---\n{raw_output[:1000]}",
        )
        return None

    if not payload.get("remember"):
        MemoryExtractionLog.objects.create(
            user=user,
            message=message,
            extracted=False,
            raw_output=raw_output[:2000],
        )
        return None

    content = (payload.get("content") or "").strip()
    if not content:
        MemoryExtractionLog.objects.create(
            user=user,
            message=message,
            extracted=False,
            raw_output=f"remember=true but content empty\n{raw_output[:1000]}",
        )
        return None

    category = payload.get("category")
    if category not in VALID_CATEGORIES:
        category = "other"

    # Cap content to the same limit the serializer enforces.
    content = content[:MAX_NOTE_CONTENT_LENGTH]

    note = MemoryNote.objects.create(
        user=user,
        content=content,
        category=category,
        source="assistant_detected",
        language=user.target_language,
    )
    MemoryExtractionLog.objects.create(
        user=user,
        message=message,
        note=note,
        extracted=True,
        raw_output=raw_output[:2000],
    )
    return note


# -------- helpers --------


def _build_router() -> ProviderRouter:
    """Dedicated router for the extractor. Groq primary, Gemini fallback.

    Not the same as services.llm.factory.create_llm_router() which is
    Gemini-primary, the chat path. The extractor is a thin
    classification call; we want it fast and cheap.
    """
    primary: BaseProvider | None = None
    fallback: BaseProvider | None = None
    if settings.GROQ_API_KEY:
        primary = GroqProvider(api_key=settings.GROQ_API_KEY, model=settings.GROQ_MODEL)
    if settings.GEMINI_API_KEY:
        if primary is None:
            primary = GeminiProvider(api_key=settings.GEMINI_API_KEY, model=settings.GEMINI_MODEL)
        else:
            fallback = GeminiProvider(api_key=settings.GEMINI_API_KEY, model=settings.GEMINI_MODEL)
    if primary is None:
        raise RuntimeError("No LLM keys configured; memory extractor cannot run")
    return ProviderRouter(primary=primary, fallback=fallback)


_FENCE_RE = re.compile(r"```(?:json)?\s*(.+?)\s*```", re.DOTALL)


def _parse_json(text: str) -> dict:
    """Parse the extractor LLM output. Tolerate markdown fences.

    Falls back to a permissive substring scan for the first {...}
    block if the model emitted commentary before/after the JSON.
    """
    text = text.strip()

    fence_match = _FENCE_RE.search(text)
    if fence_match:
        candidate = fence_match.group(1).strip()
        return json.loads(candidate)

    if text.startswith("{") and text.endswith("}"):
        return json.loads(text)

    # Permissive scan
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        return json.loads(text[start : end + 1])

    raise ValueError("no JSON object found in extractor output")
