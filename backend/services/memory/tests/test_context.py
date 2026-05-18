"""Tests for assemble_user_context.

Strategy: build a user with realistic signal in every relevant table,
call the assembler, assert the output contains the expected substrings.
We don't pin the exact format string -- only that each section's facts
are present. Then test the defensive paths: brand-new user, individual
section failures.
"""

from unittest import mock

import pytest
from django.contrib.auth import get_user_model

from apps.memory.models import MemoryNote
from services.memory.context import assemble_user_context

User = get_user_model()


@pytest.mark.django_db
def test_brand_new_user_returns_empty_string():
    user = User.objects.create_user(username="newbie", email="n@x.com", password="x")
    # Clear model defaults so _fetch_identity finds no signal.
    user.target_level = ""
    user.native_language = ""
    user.daily_goal_minutes = 0
    user.save()
    assert assemble_user_context(user) == ""


@pytest.mark.django_db
def test_identity_only_user_includes_profile_block():
    user = User.objects.create_user(
        username="ident",
        email="i@x.com",
        password="x",
        target_level="B2",
        proficiency_level="advanced",
        native_language="en",
        daily_goal_minutes=15,
    )
    out = assemble_user_context(user)
    assert "B2" in out
    assert "advanced" in out
    assert "en" in out


@pytest.mark.django_db
def test_goal_notes_appear_under_goals_heading():
    user = User.objects.create_user(username="goalie", email="g@x.com", password="x")
    MemoryNote.objects.create(user=user, content="TCF on June 15", category="goal")
    MemoryNote.objects.create(user=user, content="Pass C1 by end of year", category="goal")
    # An inactive goal note should NOT appear
    MemoryNote.objects.create(user=user, content="old goal", category="goal", is_active=False)

    out = assemble_user_context(user)
    assert "TCF on June 15" in out
    assert "Pass C1 by end of year" in out
    assert "old goal" not in out
    assert "Goals" in out


@pytest.mark.django_db
def test_preference_weakness_background_notes_grouped():
    user = User.objects.create_user(username="prefuser", email="p@x.com", password="x")
    MemoryNote.objects.create(user=user, content="Explain in English first", category="preference")
    MemoryNote.objects.create(user=user, content="Confuse depuis/pendant", category="weakness")
    MemoryNote.objects.create(user=user, content="10 years of Spanish", category="background")

    out = assemble_user_context(user)
    assert "Explain in English first" in out
    assert "Confuse depuis/pendant" in out
    assert "10 years of Spanish" in out


@pytest.mark.django_db
def test_failure_in_one_section_skips_that_section_but_returns_others():
    """If pulling mistakes raises, we should still get identity + notes."""
    user = User.objects.create_user(
        username="resilient",
        email="r@x.com",
        password="x",
        target_level="B1",
    )
    MemoryNote.objects.create(user=user, content="watch French news daily", category="goal")

    # Mock the mistakes section to raise.
    with mock.patch(
        "services.memory.context._fetch_recent_mistakes",
        side_effect=RuntimeError("table missing"),
    ):
        out = assemble_user_context(user)

    assert "B1" in out
    assert "watch French news daily" in out
    # No exception escaped.


@pytest.mark.django_db
def test_total_failure_returns_empty_string():
    """If something blows up at the outer level (e.g. user is None
    somehow, or the User row is mid-deletion), return '' rather than raise."""
    out = assemble_user_context(None)
    assert out == ""


@pytest.mark.django_db
def test_inactive_notes_excluded_for_all_categories():
    user = User.objects.create_user(username="inactive_user", email="ia@x.com", password="x")
    for cat in ("goal", "preference", "background", "weakness", "other"):
        MemoryNote.objects.create(
            user=user, content=f"inactive {cat}", category=cat, is_active=False
        )

    out = assemble_user_context(user)
    for cat in ("goal", "preference", "background", "weakness", "other"):
        assert f"inactive {cat}" not in out
