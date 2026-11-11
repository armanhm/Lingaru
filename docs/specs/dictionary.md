# Spec: Dictionary and Conjugator

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Dictionary and Conjugator](../wiki/Dictionary-and-Conjugator.md)

## 1. Purpose & scope

**In scope:**
- `backend/apps/dictionary/`:
  - the word lookup and verb conjugation endpoints
  - the cache-first `DictionaryCache` layer
  - CEFR tagging
  - the `seed_dictionary_fr` pre-warm command
  - `data/dictionary_seed_fr.csv`

**Out of scope:**
- LLM provider internals.
- The frontend Dictionary page.
- Conjugation quiz questions (`progress/seed_conjugations`, which belongs to the content app).

## 2. Requirements

| ID | Requirement |
|---|---|
| FR-1 | `POST /api/dictionary/lookup/` normalises `word` with `strip().lower()`, rejects empty input and input longer than 100 characters, and returns the cached entry for `(lookup, word)` if one exists. |
| FR-2 | On a lookup cache miss, the LLM is called with the language-specific lookup prompt (EN prompt when `target_language == "en"`, FR prompt otherwise). The parsed JSON is stored with `source="runtime"` and `cefr_level = user.target_level`, then returned. |
| FR-3 | `POST /api/dictionary/conjugate/` returns 400 `feature_unavailable_for_language` for EN learners. Otherwise it normalises `verb` (empty or more than 60 characters is rejected) and uses the same cache-first flow with `kind="conjugation"`. |
| FR-4 | An LLM response that cannot be parsed into a JSON object is never cached and results in 502. |
| FR-5 | Any other exception during a miss results in 502, and the error is logged. |
| FR-6 | When two requests miss on the same key at the same time, both may call the LLM. The second writer returns the first writer's row unchanged (`get_or_create`). |
| FR-7 | A runtime write never overwrites an existing row's `cefr_level` or `source`. |
| FR-8 | `seed_dictionary_fr` reads `rank,lemma,part_of_speech` rows, lowercases lemmas, sorts by rank, skips lemmas already cached as `lookup`, and writes new rows with `source="seed"` and `cefr_level = cefr_from_rank(rank)`. |
| FR-9 | `cefr_from_rank` maps 1-500 → A1, 501-1000 → A2, 1001-1700 → B1, 1701-2400 → B2, 2401-2800 → C1, 2801 and above → C2, and raises `ValueError` for ranks below 1. |
| FR-10 | `parse_json_response` accepts plain JSON, JSON inside a fence, or the first `{...}` span in prose. It returns `None` on failure. |

## 3. Data model

### `DictionaryCache` (default table `dictionary_dictionarycache`)

| Field | Type | Constraints |
|---|---|---|
| `kind` | Char(12) | choices `lookup`, `conjugation` |
| `key` | Char(120) | indexed; normalised input |
| `result` | JSON | the LLM payload (shapes below) |
| `cefr_level` | Char(2) | null; choices A1..C2; indexed |
| `source` | Char(16) | choices `seed`, `runtime`; default `runtime`; indexed |
| `created_at` / `updated_at` | DateTime | auto |

- `unique_together = (kind, key)`.
- **No `language` discriminator** (see D-1).

`result` shapes (as requested by the prompts; not validated):

| kind | Shape |
|---|---|
| lookup | `{word, part_of_speech, definitions[{fr, en}], examples[{fr, en}], synonyms[], antonyms[], etymology \| null, register, gender \| null}` |
| conjugation | `{verb, auxiliary, past_participle, present_participle, tenses: {"Présent" \| "Imparfait" \| "Passé composé" \| "Futur simple" \| "Conditionnel présent" \| "Subjonctif présent" \| "Impératif" \| "Plus-que-parfait": {pronoun: form}}}` |

## 4. API contract

Both endpoints require JWT authentication (`IsAuthenticated`).

### `POST /api/dictionary/lookup/`

**Request:** `{"word": "maison"}`

| Status | Body |
|---|---|
| 200 | `{"result": {...}, "provider": "cache" \| "<llm provider>", "cefr_level": "A1".."C2" \| null, "source": "seed" \| "runtime"}` |
| 400 | `{"detail": "word is required."}` or `{"detail": "word is too long."}` |
| 502 | `{"detail": "Could not parse dictionary response. Try again."}` (unparseable) or `{"detail": "Dictionary lookup failed. Please try again."}` (other error) |

### `POST /api/dictionary/conjugate/`

**Request:** `{"verb": "aller"}`

| Status | Body |
|---|---|
| 200 | same envelope as lookup |
| 400 | `{"detail": "Conjugation drills are not yet available for English.", "code": "feature_unavailable_for_language"}` (EN learners); `verb is required.`; `verb is too long.` |
| 502 | `{"detail": "Could not parse conjugation response. Try again."}` or `{"detail": "Conjugation failed. Please try again."}` |

## 5. Business rules & invariants

- Cache key normalisation is `strip().lower()`. The seed command and the views must agree on it.
- Rows are never auto-expired. Seeded rows keep their seeded CEFR forever.
- The input limit is 100 characters for a lookup and 60 for a conjugation. `key` itself is 120 characters.
- The seed command is idempotent: existing `(lookup, lemma)` rows are skipped without an LLM call.

## 6. Background jobs

| Command | Flags | Notes |
|---|---|---|
| `seed_dictionary_fr` | `--path`, `--limit N`, `--dry-run`, `--retry-failed`, `--sleep S` | About 3000 LLM calls on a full run. Failures are written (overwritten) to `data/dictionary_seed_failures.log`. |
| `scripts/build_dictionary_seed_fr.py` | n/a | Offline script that regenerates the CSV from the frequency list |

There are no Celery tasks.

## 7. Dependencies

- `services.llm.factory.create_llm_router`.
- `users.User.target_language` and `target_level`.
- `data/dictionary_seed_fr.csv`.

## 8. Deviations / open questions

| # | Deviation |
|---|---|
| D-1 | There is no `language` on `DictionaryCache`, so EN and FR entries collide on the same `(kind, key)`. This breaks the project rule that content is language-scoped. Proposed: add `language` and make `(kind, language, key)` unique. |
| D-2 | Content plan Phase 2 (pre-warm about 300 verbs into `kind=conjugation`) is not implemented. |
| D-3 | Runtime rows inherit the requester's `target_level` as `cefr_level`, which is not a property of the word. |
| D-4 | The `result` shape is not validated before caching. |
| D-5 | Cache misses call the LLM synchronously inside the request. |
| D-6 | The prompts live in `views.py` and are imported by the seed command. Back-compat aliases `LOOKUP_SYSTEM_PROMPT` and `_parse_json_response` remain. |
