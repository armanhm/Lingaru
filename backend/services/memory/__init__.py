"""Memory layer for the assistant. Two service functions:

- assemble_user_context(user) -> str
    Read-only. Builds the LEARNER CONTEXT block prepended to the
    system prompt on every text-chat turn.

- maybe_extract_note(user, user_message, assistant_response, message=None)
    Write. Runs a cheap second LLM call after each chat turn; if it
    detects "remember X" intent, saves a MemoryNote with
    source="assistant_detected".

Both functions are no-ops when LINGARU_MEMORY_ENABLED is False. The
REST endpoints in apps/memory still work independently of this flag;
the flag only controls chat-side wiring.
"""

from django.conf import settings

from .context import assemble_user_context
from .extractor import maybe_extract_note


def is_memory_enabled() -> bool:
    """Whether chat-side memory injection and extraction are active."""
    return bool(getattr(settings, "LINGARU_MEMORY_ENABLED", False))


__all__ = ["assemble_user_context", "is_memory_enabled", "maybe_extract_note"]
