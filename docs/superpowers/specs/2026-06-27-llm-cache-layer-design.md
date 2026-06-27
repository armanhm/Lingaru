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
- **`kind`** is one of `LOOKUP` (single-word entry) or `CONJUGATION` (verb tables).
- **`services.llm.router.ProviderRouter`** is the single LLM entry point (Gemini primary, Groq fallback).
- Dictionary views currently check the cache and fall through to the router on miss. **The miss path doesn't write back.** That's the bug we're fixing.

## Schema change

Add one column:

```python
class DictionaryCache(models.Model):
    kind = models.CharField(...)         # 'LOOKUP' | 'CONJUGATION'
    key = models.CharField(...)          # normalized lemma or "verb|tense"
    result = models.JSONField()
    # NEW:
    cefr_level = models.CharField(
        max_length=2,
        choices=[("A1","A1"),("A2","A2"),("B1","B1"),
                 ("B2","B2"),("C1","C1"),("C2","C2")],
        null=True, blank=True,
        db_index=True,
    )
    updated_at = models.DateTimeField(auto_now=True)
```

`cefr_level` is nullable because cache entries from pre-existing user lookups (pre-Phase-1) won't have one. The seed back-fills them via the frequency-rank → CEFR mapping; runtime misses use the requester's `user.target_level` as a default.

`updated_at` lets us later expire / refresh stale entries.

## Cache-first wrapper

A small helper in `services/llm/cache.py`:

```python
def cached_or_call(kind: str, key: str, llm_fn, default_cefr: str = None) -> dict:
    """
    Return cached result for (kind, key). On miss, call llm_fn(), persist
    the result, return it. CEFR is derived from default_cefr (e.g. the
    requesting user's target_level) when the cache row is created at runtime.
    """
    try:
        row = DictionaryCache.objects.get(kind=kind, key=key)
        return {"result": row.result, "provider": "cache", "cefr_level": row.cefr_level}
    except DictionaryCache.DoesNotExist:
        pass

    fresh = llm_fn()  # raises on failure — caller decides whether to swallow
    DictionaryCache.objects.update_or_create(
        kind=kind, key=key,
        defaults={"result": fresh["result"], "cefr_level": default_cefr},
    )
    return {**fresh, "cefr_level": default_cefr}
```

Dictionary and Conjugator views call this with their own `llm_fn` closure. No view-level cache plumbing duplicated.

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

- `update_or_create(kind=kind, key=key, ...)` on every write.
- The seed command's main loop checks for an existing row before calling the LLM:
  ```python
  if DictionaryCache.objects.filter(kind="LOOKUP", key=lemma).exists():
      continue
  ```
- Re-running the seed costs zero LLM calls if nothing's been deleted.

## Failure handling at seed time

- **Network / provider error:** log, mark a `dictionary_seed_failures.log`, skip and continue. `--retry-failed` flag re-attempts only the logged misses.
- **Malformed LLM output:** validate against a schema (Pydantic or dataclass), log + skip on mismatch.
- The seed is **not transactional** at the run level — partial completion is fine and resumable.

## Failure handling at request time (cache miss)

- LLM call wrapped in try/except. On failure, return HTTP 503 with a `Retry-After` hint, **no cache write**. We don't want to poison the cache with errors.
- (Future:) record the failure in a `DictionaryRequestLog` for retry batching — not in Phase 1.

## What this does NOT do

- **No on-the-fly cache invalidation.** If a cached entry turns out to be wrong, an admin needs to delete the row by hand for now. (Follow-up: admin endpoint.)
- **No cross-language sharing.** EN dictionary (future) gets its own seed file and its own cache rows; we don't share the table by hashing on `(kind, lang, key)` because the existing schema doesn't have `lang`. Adding it is a separate migration when EN ships.
- **No streaming.** Lookups and conjugations are point queries; streaming would burn cache complexity for no UX win.

## Testing

- Cache hit returns immediately, no LLM call (mock the router; assert it wasn't called).
- Cache miss writes back: count cache rows before/after, assert delta = 1.
- CEFR derivation: rank=1 → A1, rank=3000 → C2, rank=2401 → C1 (boundary check).
- Failed LLM call: 503 returned, cache row count unchanged.

## Observability

- Tag `provider="cache"` on cache hits, `provider="gemini"|"groq"` on misses (already done today).
- (Follow-up:) PostHog event `llm_cache_hit` / `llm_cache_miss` with `kind` and `cefr_level` properties. Lets us see hit rate climb over time.

## Migration plan

1. Migration adds `cefr_level` nullable column + index.
2. Deploy. Existing cache rows keep working (null CEFR).
3. SSH once: run `seed_dictionary_fr` (~30 min, ~3 000 LLM calls). Then `seed_conjugations_fr` (~5 min, ~2 400 calls).
4. Flip Dictionary view to use the cache-first wrapper. Cache misses (rare after seed) write back automatically.

## Rollback

If something goes wrong post-merge:

- The migration is additive (one nullable column). Reverse migration drops the column. Cache rows that were filled post-deploy keep their content; the column drop just discards the CEFR tag.
- The seed is data-only; it can be re-run or wiped via `DictionaryCache.objects.filter(provider_at_seed='seed').delete()` (we'll add a `source` marker).
