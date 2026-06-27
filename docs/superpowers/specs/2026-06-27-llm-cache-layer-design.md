# LLM cache layer — design

**Date:** 2026-06-27
**Status:** Spec (Phase 1 / 2 of the [content & cache plan](../plans/2026-06-27-content-and-cache-plan.md))
**Apps touched:** `apps.dictionary`, `services.llm`

## Problem

Several features call the LLM with deterministic inputs that return the same answer for every user — the most prominent are Dictionary lookups (word → definition + examples) and verb conjugation (verb → conjugation table). Today, every request hits the provider router. Same word looked up by 100 users = 100 LLM calls.

## Goal

A cache-first read path that:

1. Returns the stored answer if we have one.
2. On miss, calls the LLM, writes the answer to the cache, returns it.
3. Tags entries with a CEFR level so other features (Word-of-the-Day, level-filtered Dictionary) can query by level.
4. Pre-warms at deploy time for the top ~3 000 lemmas and top ~300 verbs (rough math: ~5 000 LLM calls, ~$1 total).

## Existing infrastructure

- **`apps.dictionary.models.DictionaryCache`** already exists with `unique_together = (kind, key)` and a `result` JSON column.
- **`kind`** is one of `DictionaryCache.LOOKUP = "lookup"` (single-word entry) or `DictionaryCache.CONJUGATION = "conjugation"` (verb tables). Always use the module constants; the underlying strings are lowercase.
- **Cache key shape:**
  - `LOOKUP` rows: `key = <lemma>` (normalized).
  - `CONJUGATION` rows: `key = <infinitive>` — one row holds **all** tenses for a verb because `CONJUGATE_SYSTEM_PROMPT` in `apps/dictionary/views.py` returns the full table in a single JSON response. So Phase 2's pre-warm is **~300 LLM calls total**, not 300 × 8.
- **`services.llm.router.ProviderRouter`** is the single LLM entry point (Gemini primary, Groq fallback).
- **`_parse_json_response()` in `apps/dictionary/views.py`** returns `None` when the LLM emits malformed JSON. Anything that wraps the router must check for `None` before persisting (see "Failure handling" below).
- Dictionary views currently check the cache and fall through to the router on miss. **The miss path doesn't write back.** That's the bug we're fixing.

## Schema change

Add one column:

```python
class DictionaryCache(models.Model):
    # Existing columns:
    kind = models.CharField(max_length=12, choices=KIND_CHOICES)  # "lookup" | "conjugation"
    key = models.CharField(...)                                    # normalized lemma (LOOKUP)
                                                                   # or infinitive verb (CONJUGATION)
    result = models.JSONField()

    # NEW in this phase:
    cefr_level = models.CharField(
        max_length=2,
        choices=[("A1","A1"),("A2","A2"),("B1","B1"),
                 ("B2","B2"),("C1","C1"),("C2","C2")],
        null=True, blank=True,
        db_index=True,
    )
    source = models.CharField(
        max_length=16,
        choices=[("seed", "seed"), ("runtime", "runtime")],
        default="runtime",
        db_index=True,
    )
    updated_at = models.DateTimeField(auto_now=True)
```

- `cefr_level` is nullable so pre-existing rows (filled by user lookups before Phase 1) can stay untouched. The seed populates it via the frequency-rank → CEFR mapping; runtime misses default to the requesting `user.target_level`.
- `source` distinguishes seed-populated rows from runtime fill-ins. Lets the rollback section's `DictionaryCache.objects.filter(source="seed").delete()` work cleanly without nuking the user-driven cache.
- `updated_at` lets us later expire / refresh stale entries.

## Cache-first wrapper

A small helper in `services/llm/cache.py`:

```python
def cached_or_call(kind: str, key: str, llm_fn, default_cefr: str = None) -> dict:
    """
    Return cached result for (kind, key). On miss, call llm_fn(), persist
    the result, return it. CEFR is derived from default_cefr (e.g. the
    requesting user's target_level) when the cache row is created at runtime.
    Caller's llm_fn() MUST raise on failure (network, parse error, None
    result); we never persist None or partial results.
    """
    try:
        row = DictionaryCache.objects.get(kind=kind, key=key)
        return {"result": row.result, "provider": "cache", "cefr_level": row.cefr_level}
    except DictionaryCache.DoesNotExist:
        pass

    fresh = llm_fn()  # MUST raise on failure; see "Failure handling" below.
    if fresh is None or fresh.get("result") is None:
        raise ValueError(f"LLM returned no usable result for {kind}:{key}")

    # update_or_create lets a concurrent winner race in first; we overwrite
    # only the result (and stamp updated_at), not the CEFR — see "level drift"
    # note below — and we always tag the row as runtime-sourced so the seed's
    # CEFR can't be silently downgraded by a runtime call.
    row, created = DictionaryCache.objects.get_or_create(
        kind=kind, key=key,
        defaults={
            "result": fresh["result"],
            "cefr_level": default_cefr,
            "source": "runtime",
        },
    )
    if not created:
        # Lost the race; another request already wrote. Return the stored row,
        # not our just-generated one. The duplicate LLM call cost is acceptable
        # for Phase 1; see "Concurrent misses" below.
        return {"result": row.result, "provider": "cache",
                "cefr_level": row.cefr_level}

    return {**fresh, "cefr_level": default_cefr}
```

Dictionary and Conjugator views call this with their own `llm_fn` closure. No view-level cache plumbing duplicated.

### Concurrent misses

Two requests for the same uncached key arrive within ms of each other. Both check the cache (both miss), both call the LLM, both try to write. The losing writer's `get_or_create` returns the existing row instead of inserting a duplicate (`unique_together` on `(kind, key)` enforces this at the DB level). **We accept the duplicate LLM call** — it's bounded (at most one extra per first-time lookup) and avoids the complexity of advisory locks or a separate "miss" queue. If usage logs later show this matters, add `select_for_update` + a stale-while-revalidate variant.

### Level drift

When `default_cefr` doesn't match the seed-time CEFR for a row, we **prefer the seeded value** (it was derived from the frequency rank, which is more accurate than "whatever the requesting user's target_level happens to be"). The wrapper's `get_or_create` only writes `cefr_level` when the row is newly created, so a runtime call that loses the race won't downgrade the seeded label. Admin operations that need to relabel a row do so explicitly via `DictionaryCache.objects.filter(...).update(cefr_level=...)`, not through the wrapper.

## CEFR derivation

From frequency rank, single mapping function in `apps/dictionary/cefr.py`:

```python
def cefr_from_rank(rank: int) -> str:
    if rank <= 500:   return "A1"
    if rank <= 1000:  return "A2"
    if rank <= 1700:  return "B1"
    if rank <= 2400:  return "B2"
    if rank <= 2800:  return "C1"
    return "C2"
```

Brackets are deliberately chosen to approximate the Common European Framework's vocab-size bands (A1: ~500 lemmas, A2: ~1000 cumulative, B1: ~2000, B2: ~4000). The Lonsdale corpus has more-frequent words skewing slightly easier than CEFR averages, so we use slightly wider A1/A2 ranges than the strict CEFR vocab counts.

## Seed inputs

- **`data/dictionary_seed_fr.csv`** — pulled from Lonsdale & Le Bras top-5 000 list, truncated to top 3 000. Columns: `rank,lemma,part_of_speech`.
- **`data/conjugation_seed_fr.csv`** — top ~300 verbs (subset of Lonsdale where `part_of_speech == 'v'`).

Both files are committed to the repo so `seed_X` is reproducible without an external network call.

## Idempotency

- `get_or_create(kind=kind, key=key, ...)` on every write (never `update_or_create` — we don't want runtime calls to overwrite seeded `cefr_level`).
- The seed command's main loop checks for an existing row before calling the LLM:
  ```python
  if DictionaryCache.objects.filter(kind=DictionaryCache.LOOKUP, key=lemma).exists():
      continue
  ```
- Re-running the seed costs zero LLM calls if nothing's been deleted.

## Failure handling at seed time

- **Network / provider error:** log, mark a `dictionary_seed_failures.log`, skip and continue. `--retry-failed` flag re-attempts only the logged misses.
- **Malformed LLM output:** `_parse_json_response` returns `None` — the seed loop treats `None` like a network error: log + skip + no row written. **Never write a `None` result to the cache.**
- The seed is **not transactional** at the run level — partial completion is fine and resumable.

## Failure handling at request time (cache miss)

- The view's `llm_fn` closure validates the parsed response before returning — raises `ValueError` if `_parse_json_response` returned `None` or if the schema check fails. `cached_or_call` propagates the exception.
- The view catches it and returns HTTP 503 with a `Retry-After` hint, **no cache write**. We don't poison the cache with errors.
- (Future:) record the failure in a `DictionaryRequestLog` for retry batching — not in Phase 1.

## What this does NOT do

- **No on-the-fly cache invalidation.** If a cached entry turns out to be wrong, an admin needs to delete the row by hand for now. (Follow-up: admin endpoint.)
- **No cross-language sharing.** EN dictionary (future) gets its own seed file and its own cache rows; we don't share the table by hashing on `(kind, lang, key)` because the existing schema doesn't have `lang`. Adding it is a separate migration when EN ships.
- **No streaming.** Lookups and conjugations are point queries; streaming would burn cache complexity for no UX win.

## Testing

- Cache hit returns immediately, no LLM call (mock the router; assert it wasn't called).
- Cache miss writes back: count cache rows before/after, assert delta = 1, `source="runtime"`.
- CEFR derivation: rank=1 → A1, rank=500 → A1, rank=501 → A2, rank=3000 → C2 (boundary checks).
- **None result**: `llm_fn` returns `{"result": None, ...}` → wrapper raises `ValueError`, **no row written**.
- **Race condition**: two concurrent misses for the same key → exactly one row exists after both complete (DB unique constraint enforces it); both responses are consistent (same result content).
- **Level drift**: row exists with `source="seed", cefr_level="A1"`; runtime call with `default_cefr="C1"` returns the seeded row unchanged.
- Failed LLM call: 503 returned, cache row count unchanged.

## Observability

- Tag `provider="cache"` on cache hits, `provider="gemini"|"groq"` on misses (already done today).
- (Follow-up:) PostHog event `llm_cache_hit` / `llm_cache_miss` with `kind` and `cefr_level` properties. Lets us see hit rate climb over time.

## Migration plan

1. Migration adds `cefr_level` (nullable, indexed) and `source` (default `"runtime"`, indexed) columns.
2. Deploy. Existing cache rows backfill to `source="runtime"`, `cefr_level=NULL` — they keep working.
3. SSH once: run `seed_dictionary_fr` (~30 min, ~3 000 LLM calls). Then `seed_conjugations_fr` (~5 min, ~300 calls — one per verb; the conjugation table comes back whole).
4. Flip Dictionary and Conjugator views to use the cache-first wrapper. Cache misses (rare after seed) write back automatically with `source="runtime"`.

## Rollback

If something goes wrong post-merge:

- The migration is additive (two nullable/defaulted columns). Reverse migration drops both. Cache rows that were filled post-deploy keep their `result`; only the CEFR tag and source marker are discarded.
- The seed is data-only and clean to undo because of `source`: `DictionaryCache.objects.filter(source="seed").delete()` wipes the seed rows without touching the cache filled by real user lookups.
