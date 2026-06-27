"""Cache-first wrapper around DictionaryCache lookups.

Implements the policy from the design spec:
- on hit, return the row (no LLM call)
- on miss, call llm_fn() and persist; raise on None / failed parse
- never overwrite a seeded row's cefr_level from a runtime call
- accept the rare duplicate LLM call from concurrent misses (the
  unique (kind, key) constraint makes the second writer lose cleanly).
"""

from typing import Callable

from apps.dictionary.models import DictionaryCache


class CacheMissResult(Exception):
    """Raised when an llm_fn could not produce a usable result.

    Views catch this and translate to a 502/503 — we never persist it.
    """


def cached_or_call(
    kind: str,
    key: str,
    llm_fn: Callable[[], dict],
    default_cefr: str | None = None,
) -> dict:
    """Return cached result, or call llm_fn and persist on miss.

    Args:
        kind: DictionaryCache.LOOKUP or .CONJUGATION
        key: normalized lemma (lookup) or infinitive (conjugation)
        llm_fn: zero-arg callable returning {"result": dict | None, "provider": str}.
            Two equivalent failure modes are supported:
              1. Raise any exception (network error, timeout, etc.).
              2. Return {"result": None, "provider": "..."} to signal a clean
                 parse failure without a traceback.
            Either way, no row is persisted on failure — the wrapper raises
            CacheMissResult that the view translates to a 502.
        default_cefr: CEFR level to tag the new row with on miss (e.g. the
            requesting user's target_level). Ignored when the row already
            exists; seeded rows keep their seeded level.

    Returns:
        {"result": ..., "provider": "cache" | "<llm-provider>",
         "cefr_level": ..., "source": ...}
    """
    try:
        row = DictionaryCache.objects.get(kind=kind, key=key)
        return {
            "result": row.result,
            "provider": "cache",
            "cefr_level": row.cefr_level,
            "source": row.source,
        }
    except DictionaryCache.DoesNotExist:
        pass

    fresh = llm_fn()
    if not fresh or fresh.get("result") is None:
        raise CacheMissResult(f"LLM returned no usable result for {kind}:{key}")

    # get_or_create (not update_or_create): if a concurrent winner already
    # wrote, return their row unchanged — we do not overwrite an existing
    # row's cefr_level / source from a runtime path.
    row, created = DictionaryCache.objects.get_or_create(
        kind=kind,
        key=key,
        defaults={
            "result": fresh["result"],
            "cefr_level": default_cefr,
            "source": DictionaryCache.RUNTIME,
        },
    )
    if not created:
        return {
            "result": row.result,
            "provider": "cache",
            "cefr_level": row.cefr_level,
            "source": row.source,
        }

    return {
        "result": fresh["result"],
        "provider": fresh.get("provider", "unknown"),
        "cefr_level": default_cefr,
        "source": DictionaryCache.RUNTIME,
    }
