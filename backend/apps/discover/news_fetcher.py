"""Real-news fetch + LLM-rewrite pipeline for the News surface.

Pipeline
  1. fetch_real_news() — for each RSS source: parse, dedupe by source_url,
     return a list of fresh items not already saved as DiscoverCard rows.
  2. adapt_news_for_learners() — for each fresh item, send headline +
     summary to the LLM and ask for a B1-B2 rewrite + vocab + expressions
     + grammar_points JSON. Save as a DiscoverCard.

Both functions are pure helpers — they don't run on a schedule on their
own. The scheduler lives in apps/discover/tasks.py (Celery).
"""

from __future__ import annotations

import json
import logging
import random
import re
from datetime import timedelta
from typing import Optional
from urllib.parse import urlparse

from django.utils import timezone

from apps.discover.models import DiscoverCard
from apps.discover.sources import RSS_SOURCES
from services.llm.factory import create_llm_router

logger = logging.getLogger(__name__)


# ── Tunables ────────────────────────────────────────────────────────
NEWS_CARD_LIFETIME_DAYS = 7
MAX_ITEMS_PER_SOURCE_DEFAULT = 1
MAX_ITEMS_PREFERRED_SOURCE = 3  # RFI is "preferred" → fetch more
SUMMARY_TRIM_CHARS = 1200  # cap text we send to the LLM


# ── RSS fetch ───────────────────────────────────────────────────────


def _strip_html(value: str) -> str:
    if not value:
        return ""
    text = re.sub(r"<[^>]+>", "", value)
    return re.sub(r"\s+", " ", text).strip()


def _domain_of(url: str) -> str:
    try:
        netloc = urlparse(url).netloc
        return netloc[4:] if netloc.startswith("www.") else netloc
    except Exception:
        return ""


def _existing_source_urls() -> set[str]:
    """All source_urls already saved as DiscoverCard so we can skip duplicates."""
    qs = DiscoverCard.objects.filter(type="news").exclude(source_url__isnull=True)
    return set(qs.exclude(source_url="").values_list("source_url", flat=True))


def fetch_real_news(
    sources: Optional[list[dict]] = None,
    limit_per_source: Optional[int] = None,
) -> list[dict]:
    """Walk each RSS source, return a flat list of fresh items.

    Each item is a dict:
      {
        "source_id":   str,   # the RSS_SOURCES["id"]
        "source_name": str,   # display name
        "topic":       str,   # default topic from the source
        "level":       str,   # rough CEFR difficulty hint
        "title":       str,   # raw headline from the feed
        "summary":     str,   # raw summary (HTML stripped)
        "source_url":  str,   # canonical link to the original article
        "published":   datetime | None,
      }
    """
    import feedparser

    sources = sources or RSS_SOURCES
    seen = _existing_source_urls()
    out: list[dict] = []

    for src in sources:
        per_source = (
            limit_per_source
            if limit_per_source is not None
            else (
                MAX_ITEMS_PREFERRED_SOURCE if src.get("preferred") else MAX_ITEMS_PER_SOURCE_DEFAULT
            )
        )

        try:
            # Some outlets (RFI, France 24) reject the default Python UA
            # with 403 / redirect loops. A normal browser-style UA bypasses this.
            feed = feedparser.parse(
                src["url"],
                request_headers={
                    "User-Agent": (
                        "Mozilla/5.0 (compatible; LingaruBot/1.0; +https://app.armanflower.shop)"
                    ),
                    "Accept": "application/rss+xml, application/xml, text/xml, */*",
                },
            )
        except Exception as exc:
            logger.warning("RSS parse failed for %s: %s", src["id"], exc)
            continue

        if feed.bozo and not feed.entries:
            logger.warning("RSS feed empty/invalid for %s: %s", src["id"], feed.bozo_exception)
            continue

        picked = 0
        for entry in feed.entries:
            if picked >= per_source:
                break
            link = (entry.get("link") or "").strip()
            if not link or link in seen:
                continue

            title = _strip_html(entry.get("title", ""))
            if not title:
                continue

            summary = _strip_html(entry.get("summary") or entry.get("description") or "")

            published = None
            for key in ("published_parsed", "updated_parsed"):
                t = entry.get(key)
                if t:
                    from datetime import datetime

                    try:
                        published = datetime(*t[:6])
                    except Exception:
                        pass
                    break

            out.append(
                {
                    "source_id": src["id"],
                    "source_name": src["name"],
                    "topic": src.get("topic", "misc"),
                    "level": src.get("level", "B1"),
                    "title": title[:280],
                    "summary": summary[:SUMMARY_TRIM_CHARS],
                    "source_url": link,
                    "published": published,
                }
            )
            seen.add(link)
            picked += 1

        logger.info("RSS %s: picked %d fresh item(s)", src["id"], picked)

    # Light shuffle so a single LLM provider error doesn't always kill the same source
    random.shuffle(out)
    return out


# ── LLM rewrite ─────────────────────────────────────────────────────

ADAPT_SYSTEM_PROMPT = (
    "You rewrite real French news headlines into bite-sized study material "
    "for a B1-B2 French learner. Output ONLY valid JSON (no markdown, no fences) "
    "matching this schema strictly:\n"
    "{\n"
    '  "title": "<French headline, faithful to the original, max 90 chars>",\n'
    '  "summary": "<1-2 sentence English summary>",\n'
    '  "topic": "<one of: politics, sports, culture, economy, science, tech, '
    'society, environ, world>",\n'
    '  "level": "<A2 | B1 | B2>",\n'
    '  "article_fr": "<140-180 word French rewrite at the chosen level — keep '
    "the facts of the original, simplify vocabulary, prefer present/passé "
    'composé where natural>",\n'
    '  "article_en": "<full English translation of the rewrite>",\n'
    '  "vocabulary": [\n'
    '    {"french": "...", "english": "...", "pos": "...", "example_fr": "..."},\n'
    "    ... 6 entries total\n"
    "  ],\n"
    '  "expressions": [\n'
    '    {"fr": "...", "en": "...", "note": "..."},\n'
    "    ... 3 entries total\n"
    "  ],\n"
    '  "grammar_points": [\n'
    '    {"title": "...", "explanation": "...", "example_fr": "..."},\n'
    "    ... 2 entries total\n"
    "  ]\n"
    "}\n"
    "Rules:\n"
    "- Stay faithful to the source. Do not invent quotes or numbers not "
    "present in the headline/summary.\n"
    "- The vocabulary entries must come from your French rewrite, not arbitrary words.\n"
    "- Use the source's default topic if it fits; otherwise pick the closest match.\n"
    "- If the headline is too thin to write a 140-word article, write a "
    "shorter article (60-100 words is fine) — quality over length."
)


def _parse_llm_json(raw: str) -> dict:
    """LLMs love wrapping JSON in code fences. Strip them, then parse."""
    txt = raw.strip()
    if txt.startswith("```"):
        # remove leading and trailing fences
        txt = re.sub(r"^```(?:json)?\s*", "", txt)
        txt = re.sub(r"\s*```$", "", txt)
    return json.loads(txt)


def adapt_news_for_learners(item: dict) -> Optional[dict]:
    """Send one feed item through the LLM rewrite. Returns the parsed JSON dict
    or None on failure (caller decides whether to fall back / skip)."""

    user_msg = (
        f"Source: {item['source_name']} ({item['source_id']})\n"
        f"Default topic: {item['topic']}\n"
        f"Original headline: {item['title']}\n"
        f"Original summary: {item['summary'] or '(none — work from headline only)'}\n\n"
        f"Rewrite this for a French learner per the schema."
    )

    try:
        router = create_llm_router()
        response = router.generate(
            messages=[{"role": "user", "content": user_msg}],
            system_prompt=ADAPT_SYSTEM_PROMPT,
        )
    except Exception as exc:
        logger.warning("LLM call failed for %s: %s", item["source_id"], exc)
        return None

    try:
        return _parse_llm_json(response.content)
    except (json.JSONDecodeError, AttributeError) as exc:
        logger.warning(
            "LLM returned unparseable JSON for %s: %s\nRaw: %s",
            item["source_id"],
            exc,
            (response.content or "")[:300],
        )
        return None


# ── Persist ─────────────────────────────────────────────────────────

VALID_TOPICS = {
    "politics",
    "sports",
    "culture",
    "economy",
    "science",
    "tech",
    "society",
    "environ",
    "world",
    "misc",
}


def save_adapted_card(item: dict, adapted: dict) -> Optional[DiscoverCard]:
    """Persist the rewritten article as a DiscoverCard with type=news."""
    if not adapted:
        return None

    topic = adapted.get("topic") or item.get("topic") or "misc"
    if topic not in VALID_TOPICS:
        topic = item.get("topic", "misc")

    level = (adapted.get("level") or item.get("level") or "B1")[:2].upper()

    now = timezone.now()
    card = DiscoverCard.objects.create(
        type="news",
        title=adapted.get("title") or item["title"][:90],
        summary=adapted.get("summary", ""),
        topic=topic,
        level=level,
        source_url=item["source_url"],
        content_json={
            "article_fr": adapted.get("article_fr", ""),
            "article_en": adapted.get("article_en", ""),
            "vocabulary": adapted.get("vocabulary", []),
            "expressions": adapted.get("expressions", []),
            "grammar_points": adapted.get("grammar_points", []),
            "source_name": item["source_name"],
            "source_id": item["source_id"],
            "source_domain": _domain_of(item["source_url"]),
        },
        generated_at=now,
        expires_at=now + timedelta(days=NEWS_CARD_LIFETIME_DAYS),
    )
    return card


# ── Top-level orchestrator ──────────────────────────────────────────


def run_news_pipeline(
    sources: Optional[list[dict]] = None,
    limit_per_source: Optional[int] = None,
    max_total: Optional[int] = None,
) -> tuple[int, int]:
    """Fetch fresh items from RSS, rewrite each via LLM, save as DiscoverCard.

    Returns (created_count, skipped_count).
    """
    items = fetch_real_news(sources=sources, limit_per_source=limit_per_source)
    if max_total is not None:
        items = items[:max_total]

    if not items:
        logger.info("News pipeline: no fresh RSS items to process.")
        return 0, 0

    created = skipped = 0
    for item in items:
        adapted = adapt_news_for_learners(item)
        if not adapted:
            skipped += 1
            continue
        try:
            save_adapted_card(item, adapted)
            created += 1
        except Exception as exc:
            logger.exception("Failed to save adapted card for %s: %s", item["source_id"], exc)
            skipped += 1

    logger.info("News pipeline finished: %d created, %d skipped", created, skipped)
    return created, skipped


def fetch_one_fresh_card(topic: Optional[str] = None) -> Optional[DiscoverCard]:
    """On-demand single-card generator used by the 'Generate' button.

    Tries to find a fresh RSS item for the requested topic; if none, falls
    back to any topic. If LLM fails, the caller (services.py) handles the
    further fallback to synthetic / curated.
    """
    from apps.discover.sources import sources_for_topic

    items = fetch_real_news(
        sources=sources_for_topic(topic) if topic else None,
        limit_per_source=1,
    )
    if not items:
        return None

    item = items[0]
    adapted = adapt_news_for_learners(item)
    if not adapted:
        return None

    return save_adapted_card(item, adapted)
