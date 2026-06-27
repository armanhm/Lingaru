# Content overhaul + LLM cache plan

**Date:** 2026-06-27
**Status:** Plan — Phase 1 starting next
**Apps touched:** `apps.dictionary`, `apps.exam_prep`, `apps.discover`, `apps.content`

## Why

Topics (PR #41) and Grammar Booster (PR #39) are now hand-authored. Everywhere else, generative LLM calls still happen at user request time — Dictionary lookups, verb conjugations, Discover trivia, Discover news, Exam Prep generation. Each of those is either cacheable (same input → same output) or pre-authorable.

Goals:

1. **LLM calls remain only where they must** — chat (per-user context) and Exam Prep EE/EO grading (per-student essay).
2. **All other "generate this" calls become cache-first**, with the LLM as the back-fill on a miss. Cache writes propagate to all users.
3. **Authoring stays in the repo** — JSON files in `data/`, idempotent seed commands keyed on stable slugs.

## North-star rules

- **Chat and EE/EO grading**: LLM-allowed at request time.
- **Everywhere else**: read from a JSON bank or a pre-warmed cache. On cache miss, call the LLM, write the result back, return.
- **No silent stagnation**: every cache miss adds to the cache. The bill shrinks toward zero as users explore the long tail.

## Phases (sequenced)

| # | Phase | Ships | Effort | LLM calls killed |
|---|---|---|---|---|
| 1 | Dictionary pre-warm + CEFR tagging + cache-first view | `seed_dictionary_fr.py`, migration adding `cefr_level`, top 3 000 lemmas pre-warmed at seed time | 1 session | Dictionary lookups (cache hit + miss-then-cache) |
| 2 | Conjugator pre-warm | `seed_conjugations_fr.py` — top ~300 verbs → `DictionaryCache(kind=DictionaryCache.CONJUGATION)` (one row per verb holds all 8 tenses; the LLM prompt returns the full table), cache-first view | 1 session | Verb conjugations |
| 3 | Discover → JSON bank | `data/discover_fr.json` (~200 trivia + ~200 Word-of-the-Day + ~100 culture cards), `seed_discover_fr.py`. News drops the LLM fallback (RSS-only). | 2 sessions | Trivia + news daily generation |
| 4 | Exam Prep → JSON | `data/exam_prep_fr.json` (4 sections × 6 levels), `seed_exam_prep_fr.py`. EE/EO grading still LLM. | 2 sessions | Exam content sourcing (was hardcoded Python; now JSON + richer) |
| 5 | Reading-text variety | `data/readings_extra/<level>.json` — 3-5 alternate readings per topic | 1 session per level | Zero LLM calls killed; UX gain only |

Phase 1 → Phase 2 share the cache wrapper; both are biggest-bang-for-buck single-PR wins. After that, 3 / 4 / 5 are independent.

## Phase 1 — Dictionary pre-warm (immediate next)

See [the cache spec](../specs/2026-06-27-llm-cache-layer-design.md) for full design. Key decisions locked in:

- **Lemma source:** Lonsdale & Le Bras top-3 000 French lemma frequency list (free, CSV).
- **CEFR derivation from frequency rank:**
  - rank 1–500 → A1
  - 501–1000 → A2
  - 1001–1700 → B1
  - 1701–2400 → B2
  - 2401–2800 → C1
  - 2801–3000 → C2
- **On cache miss at runtime:** call LLM, write entry to `DictionaryCache` with derived CEFR, return.
- **Seed-time pre-warm:** the seed command calls the LLM ~3 000 times once and writes to the cache. Rough budget at Gemini Flash pricing (~$0.075/M input + $0.30/M output, ~500 in / ~400 out tokens per lookup): **~$0.50 total**.
- **CEFR tagging on the cache table:** adds `cefr_level` column to `DictionaryCache`; lets Phase 3 Word-of-the-Day be level-aware.

### Deliverables (Phase 1 only)

1. **Schema migration** — `apps/dictionary/migrations/000X_add_cefr_level_to_cache.py`.
2. **`data/dictionary_seed_fr.csv`** — top 3 000 lemmas with rank → CEFR bucket. Just metadata; the entries themselves are LLM-populated at seed time.
3. **`apps/dictionary/management/commands/seed_dictionary_fr.py`** — reads the CSV, calls the LLM router for each missing entry, writes to `DictionaryCache(kind=DictionaryCache.LOOKUP, cefr_level=..., source="seed")`. Idempotent — re-runs skip already-cached rows. Flags: `--limit N` (for partial runs), `--dry-run`, `--retry-failed`.
4. **Dictionary view change** — `apps/dictionary/views.py`: cache-first; on miss, LLM call writes back with derived CEFR (lemma not in the seeded list defaults to the user's current `target_level`).
5. **Tests** — cache hit, cache miss writes back, CEFR derivation from rank.

### Phase 1 deploy steps

1. Merge PR.
2. Deploy workflow runs `migrate` automatically (adds `cefr_level` column).
3. SSH to Hetzner once: `docker compose exec django python manage.py seed_dictionary_fr` (~30 min — 3000 LLM calls, ~$0.50).
4. Verify: `DictionaryCache.objects.filter(kind='LOOKUP').count()` should report ≥3000.

## Open questions (resolved during planning)

- ~~Source of the lemma list?~~ → Lonsdale & Le Bras top-3 000.
- ~~"Suggest this word" button on miss?~~ → Not needed; misses transparently call LLM and write back.
- ~~CEFR tagging on cache entries?~~ → Yes.

## Follow-ups (not in this scope)

- Cron / weekly script to refresh stale cache entries (e.g. > 6 months old).
- Admin endpoint to clear a single cached entry when content is wrong.
- Telemetry: log cache hit rate per kind so we can see Phase 1/2's impact in PostHog.
