"""Verify per-language card generation."""

from unittest import mock

import pytest
from django.contrib.auth import get_user_model

from apps.discover.services import generate_daily_cards

User = get_user_model()


@pytest.mark.django_db
def test_generate_daily_cards_invokes_helpers_for_each_active_language():
    """When users with different target_language exist, the orchestrator
    calls per-card-type helpers once per distinct active language."""
    User.objects.create_user(username="fr_u", email="fr@x.com", password="x", target_language="fr")
    User.objects.create_user(username="en_u", email="en@x.com", password="x", target_language="en")

    with (
        mock.patch("apps.discover.services.generate_word_card") as fake_word,
        mock.patch("apps.discover.services.generate_grammar_card") as fake_grammar,
        mock.patch("apps.discover.services.generate_trivia_card") as fake_trivia,
    ):
        fake_word.return_value = None
        fake_grammar.return_value = None
        fake_trivia.return_value = None
        generate_daily_cards()

    # Each helper was called twice (once per active language)
    word_langs = sorted(
        (c.kwargs.get("language") if "language" in c.kwargs else (c.args[0] if c.args else None))
        for c in fake_word.call_args_list
    )
    grammar_langs = sorted(
        (c.kwargs.get("language") if "language" in c.kwargs else (c.args[0] if c.args else None))
        for c in fake_grammar.call_args_list
    )
    trivia_langs = sorted(
        (c.kwargs.get("language") if "language" in c.kwargs else (c.args[0] if c.args else None))
        for c in fake_trivia.call_args_list
    )
    assert word_langs == ["en", "fr"]
    assert grammar_langs == ["en", "fr"]
    assert trivia_langs == ["en", "fr"]


@pytest.mark.django_db
def test_generate_daily_cards_with_only_fr_users_calls_fr_only():
    """If no EN users exist, only FR generation runs."""
    User.objects.create_user(
        username="fr_only", email="fr_only@x.com", password="x", target_language="fr"
    )

    with mock.patch("apps.discover.services.generate_word_card") as fake_word:
        fake_word.return_value = None
        with mock.patch("apps.discover.services.generate_grammar_card", return_value=None):
            with mock.patch("apps.discover.services.generate_trivia_card", return_value=None):
                generate_daily_cards()

    word_langs = sorted(
        (c.kwargs.get("language") if "language" in c.kwargs else (c.args[0] if c.args else None))
        for c in fake_word.call_args_list
    )
    assert word_langs == ["fr"]
