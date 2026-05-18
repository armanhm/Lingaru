"""Pins per-language scoping of MemoryNote in assemble_user_context
and maybe_extract_note (v2.0.0)."""

from unittest import mock

import pytest
from django.contrib.auth import get_user_model

from apps.memory.models import MemoryNote
from services.llm.base import LLMResponse
from services.memory import assemble_user_context
from services.memory.extractor import maybe_extract_note

User = get_user_model()


@pytest.mark.django_db
def test_context_only_includes_notes_matching_target_language():
    """User in FR mode sees only FR notes; EN mode sees only EN notes."""
    user = User.objects.create_user(
        username="lang_user", email="lu@x.com", password="x", target_language="fr"
    )
    MemoryNote.objects.create(user=user, content="FR-goal", category="goal", language="fr")
    MemoryNote.objects.create(user=user, content="EN-goal", category="goal", language="en")

    out = assemble_user_context(user)
    assert "FR-goal" in out
    assert "EN-goal" not in out

    user.target_language = "en"
    user.save()
    out = assemble_user_context(user)
    assert "EN-goal" in out
    assert "FR-goal" not in out


@pytest.mark.django_db
def test_extractor_writes_note_with_callers_target_language():
    """maybe_extract_note tags new notes with the caller's target_language."""
    user = User.objects.create_user(
        username="en_user", email="en@x.com", password="x", target_language="en"
    )
    fake_router = mock.Mock()
    fake_router.generate.return_value = LLMResponse(
        content='{"remember": true, "content": "User prefers mornings", "category": "preference"}',
        provider="groq",
        tokens_used=10,
    )

    with mock.patch("services.memory.extractor._build_router", return_value=fake_router):
        note = maybe_extract_note(
            user=user,
            user_message="remember I prefer mornings",
            assistant_response="ok",
        )

    assert note is not None
    assert note.language == "en"
