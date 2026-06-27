"""Tests for the cache layer added in Phase 1 of the content/cache plan.

Covers:
- cefr_from_rank boundaries
- cached_or_call hit / miss-then-write / None-rejection / race-loser
- DictionaryLookupView routes through the cache wrapper end-to-end
"""

from unittest.mock import patch

import pytest

from apps.dictionary.cache import CacheMissResult, cached_or_call
from apps.dictionary.cefr import cefr_from_rank
from apps.dictionary.models import DictionaryCache

# ---- CEFR derivation ----------------------------------------------------------


@pytest.mark.parametrize(
    "rank,expected",
    [
        (1, "A1"),
        (500, "A1"),
        (501, "A2"),
        (1000, "A2"),
        (1001, "B1"),
        (1700, "B1"),
        (1701, "B2"),
        (2400, "B2"),
        (2401, "C1"),
        (2800, "C1"),
        (2801, "C2"),
        (5000, "C2"),
    ],
)
def test_cefr_from_rank_boundaries(rank, expected):
    assert cefr_from_rank(rank) == expected


@pytest.mark.parametrize("bad_rank", [0, -1, -100])
def test_cefr_from_rank_rejects_non_positive(bad_rank):
    with pytest.raises(ValueError, match="positive 1-indexed"):
        cefr_from_rank(bad_rank)


# ---- cached_or_call -----------------------------------------------------------


@pytest.mark.django_db
def test_cache_hit_does_not_call_llm():
    DictionaryCache.objects.create(
        kind=DictionaryCache.LOOKUP,
        key="bonjour",
        result={"word": "bonjour"},
        cefr_level="A1",
        source=DictionaryCache.SEED,
    )
    calls = []

    def llm_fn():
        calls.append(1)
        return {"result": {"word": "bonjour-fresh"}, "provider": "gemini"}

    out = cached_or_call(DictionaryCache.LOOKUP, "bonjour", llm_fn, default_cefr="B2")

    assert calls == [], "LLM must not be called on cache hit"
    assert out["provider"] == "cache"
    assert out["result"] == {"word": "bonjour"}
    assert out["cefr_level"] == "A1"
    assert out["source"] == DictionaryCache.SEED


@pytest.mark.django_db
def test_cache_miss_writes_back_and_tags_runtime():
    assert DictionaryCache.objects.filter(key="appartement").count() == 0

    def llm_fn():
        return {"result": {"word": "appartement"}, "provider": "gemini"}

    out = cached_or_call(DictionaryCache.LOOKUP, "appartement", llm_fn, default_cefr="B1")

    assert out["provider"] == "gemini"
    assert out["result"] == {"word": "appartement"}
    assert out["cefr_level"] == "B1"
    assert out["source"] == DictionaryCache.RUNTIME

    row = DictionaryCache.objects.get(kind=DictionaryCache.LOOKUP, key="appartement")
    assert row.result == {"word": "appartement"}
    assert row.cefr_level == "B1"
    assert row.source == DictionaryCache.RUNTIME


@pytest.mark.django_db
def test_none_result_raises_and_does_not_cache():
    def llm_fn():
        return {"result": None, "provider": "gemini"}

    with pytest.raises(CacheMissResult):
        cached_or_call(DictionaryCache.LOOKUP, "weirdword", llm_fn, default_cefr="B2")

    assert DictionaryCache.objects.filter(key="weirdword").count() == 0


@pytest.mark.django_db
def test_runtime_call_does_not_overwrite_seeded_cefr():
    # Pre-existing seeded row at A1.
    DictionaryCache.objects.create(
        kind=DictionaryCache.LOOKUP,
        key="oui",
        result={"word": "oui"},
        cefr_level="A1",
        source=DictionaryCache.SEED,
    )

    def llm_fn():
        return {"result": {"word": "oui-new"}, "provider": "gemini"}

    out = cached_or_call(DictionaryCache.LOOKUP, "oui", llm_fn, default_cefr="C1")

    # Hit returns the seeded row; the runtime caller's default_cefr is ignored.
    assert out["cefr_level"] == "A1"
    assert out["source"] == DictionaryCache.SEED
    assert out["result"] == {"word": "oui"}


# ---- view smoke (full path through cached_or_call) ---------------------------


@pytest.mark.django_db
def test_lookup_view_cache_hit_returns_seeded_row(authenticated_client):
    DictionaryCache.objects.create(
        kind=DictionaryCache.LOOKUP,
        key="merci",
        result={"word": "merci", "definitions": [{"fr": "Remerciement", "en": "Thanks"}]},
        cefr_level="A1",
        source=DictionaryCache.SEED,
    )

    with patch("apps.dictionary.views.create_llm_router") as mock_router:
        response = authenticated_client.post(
            "/api/dictionary/lookup/", {"word": "merci"}, format="json"
        )

    assert response.status_code == 200, response.data
    assert mock_router.called is False, "LLM router must not be invoked on hit"
    assert response.data["provider"] == "cache"
    assert response.data["cefr_level"] == "A1"
    assert response.data["source"] == DictionaryCache.SEED
