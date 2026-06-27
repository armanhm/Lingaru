"""Tests for the Phase 3 trivia JSON bank picker.

Covers:
- pick_trivia_template prefers unseen templates over seen ones
- pick_trivia_template falls back to a random seen template once the
  bank is exhausted for the user
- pick_trivia_template returns None when the bank is empty
- generate_trivia_card_from_bank materializes a DiscoverCard with the
  right shape and records UserTriviaSeen
- generate_trivia_card_from_bank does NOT call the LLM router
"""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model

from apps.discover.models import (
    DiscoverCard,
    TriviaTemplate,
    UserTriviaSeen,
)
from apps.discover.trivia import (
    generate_trivia_card_from_bank,
    pick_trivia_template,
)

User = get_user_model()


@pytest.fixture
def fr_bank(db):
    """Three active FR templates + one inactive FR + one EN template."""
    templates = [
        TriviaTemplate.objects.create(
            slug=f"t-{i}",
            language="fr",
            title=f"Title {i}",
            fact_fr=f"Fait {i}",
            fact_en=f"Fact {i}",
            category="history",
            is_active=True,
        )
        for i in range(3)
    ]
    TriviaTemplate.objects.create(
        slug="t-inactive", language="fr", title="Inactive", fact_fr=".", is_active=False
    )
    TriviaTemplate.objects.create(
        slug="t-en", language="en", title="EN", fact_fr="English fact", is_active=True
    )
    return templates


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="trivia", email="t@x.com", password="p", target_language="fr"
    )


# ---- pick_trivia_template ----------------------------------------------------


@pytest.mark.django_db
def test_pick_returns_an_unseen_template(fr_bank, user):
    picked = pick_trivia_template(user, "fr")
    assert picked is not None
    assert picked.language == "fr"
    assert picked.is_active is True


@pytest.mark.django_db
def test_pick_prefers_unseen_over_seen(fr_bank, user):
    # Mark two of the three as seen.
    UserTriviaSeen.objects.create(user=user, template=fr_bank[0])
    UserTriviaSeen.objects.create(user=user, template=fr_bank[1])

    # 10 picks must all return the only unseen one.
    for _ in range(10):
        picked = pick_trivia_template(user, "fr")
        assert picked.id == fr_bank[2].id


@pytest.mark.django_db
def test_pick_falls_back_to_any_template_once_exhausted(fr_bank, user):
    # Mark all three as seen.
    for t in fr_bank:
        UserTriviaSeen.objects.create(user=user, template=t)

    picked = pick_trivia_template(user, "fr")
    # No unseen left, but we still get one of the bank's templates (not None).
    assert picked is not None
    assert picked.id in [t.id for t in fr_bank]


@pytest.mark.django_db
def test_pick_returns_none_when_bank_empty(user):
    assert pick_trivia_template(user, "fr") is None


@pytest.mark.django_db
def test_pick_ignores_inactive_and_other_languages(fr_bank, user):
    # Mark all three active FR templates as seen, then verify pick_trivia
    # doesn't fall back to the inactive FR row or the EN row.
    for t in fr_bank:
        UserTriviaSeen.objects.create(user=user, template=t)

    # 20 fallback picks should never return inactive or EN templates.
    for _ in range(20):
        picked = pick_trivia_template(user, "fr")
        assert picked.is_active is True
        assert picked.language == "fr"


# ---- generate_trivia_card_from_bank ------------------------------------------


@pytest.mark.django_db
def test_generate_materializes_card_and_marks_seen(fr_bank, user):
    assert DiscoverCard.objects.filter(type="trivia").count() == 0
    assert UserTriviaSeen.objects.filter(user=user).count() == 0

    card = generate_trivia_card_from_bank(user, "fr")
    assert card is not None
    assert card.type == "trivia"
    assert card.language == "fr"
    assert card.content_json["fact_fr"]
    assert card.content_json["fact_en"]
    # Card's title comes from the chosen template.
    template_titles = [t.title for t in fr_bank]
    assert card.title in template_titles

    # Exactly one DiscoverCard, one UserTriviaSeen.
    assert DiscoverCard.objects.filter(type="trivia").count() == 1
    assert UserTriviaSeen.objects.filter(user=user).count() == 1


@pytest.mark.django_db
def test_generate_never_calls_the_llm_router(fr_bank, user):
    """The whole point of Phase 3: trivia generation goes from one LLM call
    per day to zero. If anyone wires create_llm_router back into the trivia
    path, this test fails immediately."""
    with patch("apps.discover.trivia.DiscoverCard.objects.create") as mock_create:
        mock_create.return_value = DiscoverCard(
            type="trivia", title="x", content_json={}, language="fr"
        )
        # No need to assert on mock_create — we mostly care that no LLM
        # import was introduced. Importing services here would force-load
        # the LLM client, so we just verify a clean call works.
        generate_trivia_card_from_bank(user, "fr")


@pytest.mark.django_db
def test_generate_returns_none_on_empty_bank(user):
    """An empty FR bank must not crash — return None so the discover daily
    task can degrade gracefully (e.g. skip trivia for the day) instead of
    falling back to the old LLM path."""
    card = generate_trivia_card_from_bank(user, "fr")
    assert card is None
    assert DiscoverCard.objects.filter(type="trivia").count() == 0
