"""Trivia card picker, post-Phase-3.

Replaces the LLM-generated trivia path in services.generate_trivia_card.
Picks a random TriviaTemplate the user hasn't seen yet (or any random
template if every one has been seen), materializes it as a DiscoverCard,
and records the view in UserTriviaSeen.
"""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from apps.discover.models import DiscoverCard, TriviaTemplate, UserTriviaSeen

CARD_EXPIRY_HOURS = 24


def pick_trivia_template(user, language: str) -> TriviaTemplate | None:
    """Pick a TriviaTemplate the user hasn't seen yet for the given language.

    If the user has exhausted the bank for this language, falls back to
    a random already-seen template. Returns None only when the bank is
    empty for the language.
    """
    base_qs = TriviaTemplate.objects.filter(language=language, is_active=True)
    if not base_qs.exists():
        return None

    seen_ids = UserTriviaSeen.objects.filter(user=user, template__language=language).values_list(
        "template_id", flat=True
    )

    unseen = base_qs.exclude(id__in=list(seen_ids))
    pool = unseen if unseen.exists() else base_qs
    return pool.order_by("?").first()


def _materialize(template: TriviaTemplate, language: str) -> DiscoverCard:
    now = timezone.now()
    return DiscoverCard.objects.create(
        type="trivia",
        title=template.title,
        summary=template.summary,
        content_json={"fact_fr": template.fact_fr, "fact_en": template.fact_en},
        generated_at=now,
        expires_at=now + timedelta(hours=CARD_EXPIRY_HOURS),
        language=language,
        level=template.level,
    )


def generate_trivia_card_from_bank(user, language: str = "fr") -> DiscoverCard | None:
    """Materialize a random unseen TriviaTemplate as a DiscoverCard for this
    user. Used by the per-user "generate more" path. Records the pick in
    UserTriviaSeen so the next call prefers a fresh template.
    """
    template = pick_trivia_template(user, language)
    if template is None:
        return None
    card = _materialize(template, language)
    UserTriviaSeen.objects.get_or_create(user=user, template=template)
    return card


def generate_daily_trivia_card(language: str = "fr") -> DiscoverCard | None:
    """Pick a random active template for `language` and materialize it. Used
    by the daily Celery task to seed one shared trivia card per language —
    no per-user tracking here, since this card is the "today's trivia" for
    everyone on that language. Returns None if the bank is empty.
    """
    template = (
        TriviaTemplate.objects.filter(language=language, is_active=True).order_by("?").first()
    )
    if template is None:
        return None
    return _materialize(template, language)
