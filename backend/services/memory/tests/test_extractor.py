"""Tests for maybe_extract_note. The LLM router is mocked end-to-end;
we never make a real network call."""

from datetime import timedelta
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.memory.models import MemoryExtractionLog, MemoryNote
from services.llm.base import LLMResponse
from services.memory.extractor import (
    DAILY_EXTRACTION_CAP,
    maybe_extract_note,
)

User = get_user_model()


def _llm_response(text: str) -> LLMResponse:
    return LLMResponse(content=text, provider="groq", tokens_used=42)


@pytest.fixture
def user(db):
    return User.objects.create_user(username="alice", email="a@x.com", password="x")


@pytest.mark.django_db
def test_explicit_remember_saves_note_and_log(user):
    """LLM returns remember=true: a note is created, a log row is written."""
    fake_router = mock.Mock()
    fake_router.generate.return_value = _llm_response(
        '{"remember": true, "content": "User is preparing for the TCF on June 15", "category": "goal"}'
    )

    with mock.patch("services.memory.extractor._build_router", return_value=fake_router):
        note = maybe_extract_note(
            user=user,
            user_message="Remember I'm prepping for TCF June 15",
            assistant_response="Got it, I'll keep that in mind.",
        )

    assert note is not None
    assert note.content == "User is preparing for the TCF on June 15"
    assert note.category == "goal"
    assert note.source == "assistant_detected"
    assert note.is_active is True

    log = MemoryExtractionLog.objects.get(user=user)
    assert log.extracted is True
    assert log.note == note


@pytest.mark.django_db
def test_volunteered_fact_returns_none_and_logs(user):
    """LLM returns remember=false: no note, but a log row is still written."""
    fake_router = mock.Mock()
    fake_router.generate.return_value = _llm_response(
        '{"remember": false, "content": null, "category": null}'
    )

    with mock.patch("services.memory.extractor._build_router", return_value=fake_router):
        note = maybe_extract_note(
            user=user,
            user_message="I love jazz, by the way.",
            assistant_response="Cool, what's your favorite album?",
        )

    assert note is None
    assert MemoryNote.objects.filter(user=user).count() == 0
    log = MemoryExtractionLog.objects.get(user=user)
    assert log.extracted is False


@pytest.mark.django_db
def test_malformed_json_returns_none_and_logs(user):
    fake_router = mock.Mock()
    fake_router.generate.return_value = _llm_response("this is not json")

    with mock.patch("services.memory.extractor._build_router", return_value=fake_router):
        note = maybe_extract_note(
            user=user,
            user_message="remember something",
            assistant_response="ok",
        )

    assert note is None
    log = MemoryExtractionLog.objects.get(user=user)
    assert log.extracted is False
    assert "this is not json" in log.raw_output


@pytest.mark.django_db
def test_router_failure_returns_none_and_logs(user):
    fake_router = mock.Mock()
    fake_router.generate.side_effect = RuntimeError("groq exploded")

    with mock.patch("services.memory.extractor._build_router", return_value=fake_router):
        note = maybe_extract_note(
            user=user,
            user_message="remember something",
            assistant_response="ok",
        )

    assert note is None
    log = MemoryExtractionLog.objects.get(user=user)
    assert log.extracted is False
    assert "groq exploded" in log.raw_output


@pytest.mark.django_db
def test_daily_cap_prevents_new_extractions(user):
    """Once DAILY_EXTRACTION_CAP successful extractions in the last 24h
    exist, no new ones are created. A log row is still written to record
    that the cap blocked us."""
    for i in range(DAILY_EXTRACTION_CAP):
        MemoryExtractionLog.objects.create(user=user, extracted=True, raw_output="prior")

    fake_router = mock.Mock()
    fake_router.generate.return_value = _llm_response(
        '{"remember": true, "content": "should not be saved", "category": "other"}'
    )

    with mock.patch("services.memory.extractor._build_router", return_value=fake_router):
        note = maybe_extract_note(
            user=user,
            user_message="remember X",
            assistant_response="ok",
        )

    assert note is None
    # The router was not called (cap short-circuits before the LLM call)
    fake_router.generate.assert_not_called()
    # Cap-block is recorded
    cap_log = MemoryExtractionLog.objects.filter(extracted=False, user=user).last()
    assert cap_log is not None
    assert "cap" in cap_log.raw_output.lower()


@pytest.mark.django_db
def test_cap_only_counts_last_24h(user):
    """Old extractions outside the 24h window do not count against the cap."""
    old_time = timezone.now() - timedelta(hours=25)
    for _ in range(DAILY_EXTRACTION_CAP + 5):
        log = MemoryExtractionLog.objects.create(user=user, extracted=True, raw_output="ancient")
        MemoryExtractionLog.objects.filter(pk=log.pk).update(created_at=old_time)

    fake_router = mock.Mock()
    fake_router.generate.return_value = _llm_response(
        '{"remember": true, "content": "User likes mornings", "category": "preference"}'
    )

    with mock.patch("services.memory.extractor._build_router", return_value=fake_router):
        note = maybe_extract_note(
            user=user,
            user_message="remember I prefer mornings",
            assistant_response="ok",
        )

    assert note is not None


@pytest.mark.django_db
def test_remember_true_but_missing_content_returns_none(user):
    """Defensive: LLM said remember=true but didn't give us content. Skip."""
    fake_router = mock.Mock()
    fake_router.generate.return_value = _llm_response(
        '{"remember": true, "content": null, "category": "goal"}'
    )

    with mock.patch("services.memory.extractor._build_router", return_value=fake_router):
        note = maybe_extract_note(
            user=user,
            user_message="remember",
            assistant_response="ok",
        )

    assert note is None
    log = MemoryExtractionLog.objects.get(user=user)
    assert log.extracted is False
