"""Regression for the NewsListSerializer content_json over-reads.

Before the fix, each of get_read_minutes / get_source_name /
get_source_domain re-read obj.content_json. With 24 articles in a page,
that's 72 lookups when 24 would do. The fix memoizes the dict on the
obj for the duration of the serializer pass.

We assert the memoization works by counting attribute accesses via a
property that increments on read.
"""

import pytest

from apps.discover.serializers import NewsListSerializer


class _CountingCard:
    """Minimal stand-in for DiscoverCard that records reads of content_json."""

    def __init__(self, content):
        self._content = content
        self.read_count = 0

    @property
    def content_json(self):
        self.read_count += 1
        return self._content

    # The fields the serializer reads directly via ModelSerializer's
    # to_representation; populated as attributes so the serializer doesn't
    # hit the (nonexistent) DB.
    id = 1
    title = "Titre"
    summary = "Résumé"
    topic = "politics"
    level = "B1"
    source_url = ""
    image_url = ""
    generated_at = None
    seen = False
    interacted = False


def test_content_json_read_once_per_row():
    card = _CountingCard(
        {
            "article_fr": " ".join(["mot"] * 260),  # 260 / 130 = 2 min
            "source_name": "Le Monde",
            "source_domain": "lemonde.fr",
        }
    )
    data = NewsListSerializer(card).data

    assert data["read_minutes"] == 2
    assert data["source_name"] == "Le Monde"
    assert data["source_domain"] == "lemonde.fr"

    # Pre-fix: 3 reads (one per derived field). Post-fix: 1 read (memoized).
    assert card.read_count == 1, (
        f"NewsListSerializer read content_json {card.read_count} times; "
        "should memoize and read once per row"
    )
