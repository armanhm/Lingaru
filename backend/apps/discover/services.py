"""Discover card generation service."""

import json
import logging
from datetime import timedelta
from typing import Optional

from django.utils import timezone

from apps.content.models import GrammarRule, Vocabulary
from apps.discover.models import DiscoverCard
from services.llm.factory import create_llm_router
from services.llm.prompts import SYSTEM_PROMPTS

logger = logging.getLogger(__name__)

CARD_EXPIRY_HOURS = 24


def generate_word_card() -> Optional[DiscoverCard]:
    """Generate a Word of the Day card from a random Vocabulary entry."""
    vocab = Vocabulary.objects.order_by("?").first()
    if vocab is None:
        logger.warning("No vocabulary items available for word card generation.")
        return None

    now = timezone.now()
    card = DiscoverCard.objects.create(
        type="word",
        title=vocab.french,
        summary=f"{vocab.french} — {vocab.english}",
        content_json={
            "french": vocab.french,
            "english": vocab.english,
            "pronunciation": vocab.pronunciation,
            "example": vocab.example_sentence,
            "gender": vocab.gender,
            "part_of_speech": vocab.part_of_speech,
        },
        generated_at=now,
        expires_at=now + timedelta(hours=CARD_EXPIRY_HOURS),
    )
    return card


def generate_grammar_card() -> Optional[DiscoverCard]:
    """Generate a Grammar Tip card from a random GrammarRule entry."""
    rule = GrammarRule.objects.order_by("?").first()
    if rule is None:
        logger.warning("No grammar rules available for grammar card generation.")
        return None

    now = timezone.now()
    card = DiscoverCard.objects.create(
        type="grammar",
        title=rule.title,
        summary=rule.explanation[:200],
        content_json={
            "explanation": rule.explanation,
            "formula": rule.formula,
            "examples": rule.examples,
            "exceptions": rule.exceptions,
        },
        generated_at=now,
        expires_at=now + timedelta(hours=CARD_EXPIRY_HOURS),
    )
    return card


def generate_trivia_card() -> Optional[DiscoverCard]:
    """Generate a trivia card using the LLM."""
    try:
        router = create_llm_router()
        response = router.generate(
            messages=[{"role": "user", "content": "Generate a French trivia fact."}],
            system_prompt=SYSTEM_PROMPTS["trivia_generator"],
        )
        data = json.loads(response.content)
    except (RuntimeError, json.JSONDecodeError, KeyError) as exc:
        logger.warning("Failed to generate trivia card: %s", exc)
        return None

    now = timezone.now()
    card = DiscoverCard.objects.create(
        type="trivia",
        title=data.get("title", "French Trivia"),
        summary=data.get("summary", ""),
        content_json={
            "fact_fr": data.get("fact_fr", ""),
            "fact_en": data.get("fact_en", ""),
        },
        generated_at=now,
        expires_at=now + timedelta(hours=CARD_EXPIRY_HOURS),
    )
    return card


def generate_news_card() -> Optional[DiscoverCard]:
    """Generate a mock news article card using the LLM."""
    try:
        router = create_llm_router()
        response = router.generate(
            messages=[{
                "role": "user",
                "content": "Generate a simplified French news article for B1-B2 learners.",
            }],
            system_prompt=SYSTEM_PROMPTS["news_generator"],
        )
        data = json.loads(response.content)
    except (RuntimeError, json.JSONDecodeError, KeyError) as exc:
        logger.warning("Failed to generate news card: %s", exc)
        return None

    now = timezone.now()
    card = DiscoverCard.objects.create(
        type="news",
        title=data.get("title", "Actualit\u00e9s"),
        summary=data.get("summary", ""),
        content_json={
            "article_fr": data.get("article_fr", ""),
            "article_en": data.get("article_en", ""),
            "key_vocabulary": data.get("key_vocabulary", []),
        },
        generated_at=now,
        expires_at=now + timedelta(hours=CARD_EXPIRY_HOURS),
    )
    return card


def generate_daily_cards() -> list[DiscoverCard]:
    """Generate one card of each type for the daily feed.

    Returns a list of successfully created cards (skips any that failed).
    """
    generators = [
        generate_word_card,
        generate_grammar_card,
        generate_trivia_card,
        generate_news_card,
    ]

    cards = []
    for gen_fn in generators:
        card = gen_fn()
        if card is not None:
            cards.append(card)

    logger.info("Daily feed generated: %d cards created.", len(cards))
    return cards
