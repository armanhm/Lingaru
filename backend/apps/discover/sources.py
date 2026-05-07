"""Curated French-language RSS sources for the news pipeline.

Each source is tagged with a default `topic` (one of the 9 topic slugs the
News page already filters by). When we pull an item, we use the source's
default topic if the item itself doesn't carry one.

Notes
- We intentionally favour publicly-available, government-friendly outlets
  with stable RSS endpoints. None of these require authentication.
- "RFI Journal en français facile" is the gold standard for B1 learners —
  short headlines and accessible vocabulary, already at the right level.
- Topic mapping is best-effort. The LLM rewrite step also returns a
  `topic` field, which wins over the source default if present.
"""

from __future__ import annotations

# Topic slugs (mirror apps.discover.models.DiscoverCard.NEWS_TOPICS)
TOPIC_POLITICS = "politics"
TOPIC_SPORTS = "sports"
TOPIC_CULTURE = "culture"
TOPIC_ECONOMY = "economy"
TOPIC_SCIENCE = "science"
TOPIC_TECH = "tech"
TOPIC_SOCIETY = "society"
TOPIC_ENVIRON = "environ"
TOPIC_WORLD = "world"


# Each entry: (id, name, default_topic, rss_url, learner_level)
# learner_level is informational; the LLM rewrite still targets B1-B2.
RSS_SOURCES = [
    # ── Tier 1: General-audience FR news (verified-working feeds) ────
    {
        "id": "francetvinfo-une",
        "name": "France Info · À la une",
        "topic": TOPIC_SOCIETY,
        "url": "https://www.francetvinfo.fr/titres.rss",
        "level": "B2",
        "preferred": True,  # take more items from France Info per cycle
    },
    {
        "id": "lemonde-une",
        "name": "Le Monde · Une",
        "topic": TOPIC_SOCIETY,
        "url": "https://www.lemonde.fr/rss/une.xml",
        "level": "B2",
    },
    {
        "id": "france24-une",
        "name": "France 24 · À la une",
        "topic": TOPIC_WORLD,
        "url": "https://www.france24.com/fr/rss",
        "level": "B2",
    },
    # ── Tier 2: Topical Le Monde feeds (one per topic for coverage) ──
    {
        "id": "lemonde-international",
        "name": "Le Monde · International",
        "topic": TOPIC_WORLD,
        "url": "https://www.lemonde.fr/international/rss_full.xml",
        "level": "B2",
    },
    {
        "id": "lemonde-politique",
        "name": "Le Monde · Politique",
        "topic": TOPIC_POLITICS,
        "url": "https://www.lemonde.fr/politique/rss_full.xml",
        "level": "B2",
    },
    {
        "id": "lemonde-economie",
        "name": "Le Monde · Économie",
        "topic": TOPIC_ECONOMY,
        "url": "https://www.lemonde.fr/economie/rss_full.xml",
        "level": "B2",
    },
    {
        "id": "lemonde-sciences",
        "name": "Le Monde · Sciences",
        "topic": TOPIC_SCIENCE,
        "url": "https://www.lemonde.fr/sciences/rss_full.xml",
        "level": "B2",
    },
    {
        "id": "lemonde-planete",
        "name": "Le Monde · Planète",
        "topic": TOPIC_ENVIRON,
        "url": "https://www.lemonde.fr/planete/rss_full.xml",
        "level": "B2",
    },
    {
        "id": "lemonde-culture",
        "name": "Le Monde · Culture",
        "topic": TOPIC_CULTURE,
        "url": "https://www.lemonde.fr/culture/rss_full.xml",
        "level": "B2",
    },
    {
        "id": "lemonde-pixels",
        "name": "Le Monde · Pixels (Tech)",
        "topic": TOPIC_TECH,
        "url": "https://www.lemonde.fr/pixels/rss_full.xml",
        "level": "B2",
    },
    {
        "id": "lequipe-une",
        "name": "L'Équipe · Toute l'actu",
        "topic": TOPIC_SPORTS,
        "url": "https://dwh.lequipe.fr/api/edito/rss?path=/",
        "level": "B2",
    },
]


def sources_for_topic(topic: str) -> list[dict]:
    """Return the subset of RSS_SOURCES tagged for this topic. If none match,
    fall back to all sources (the LLM may still produce a relevant article)."""
    if not topic:
        return list(RSS_SOURCES)
    matches = [s for s in RSS_SOURCES if s["topic"] == topic]
    return matches or list(RSS_SOURCES)
