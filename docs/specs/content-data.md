# Spec: Content Data (banks and seed commands)

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Content Data Pipeline](../wiki/Content-Data-Pipeline.md)

## 1. Purpose & scope

**In scope:**
- The repo-tracked content banks in `data/`.
- The management commands that load banks or Python-literal content into the database.
- The contracts those loaders must honour: keys, idempotency and language.

**Out of scope:**
- The runtime behaviour of the apps that read this content. See [content](content.md), [grammar-booster](grammar-booster.md), [discover-news](discover-news.md), [dictionary](dictionary.md), [exam-prep](exam-prep.md) and [notes](notes.md).
- Agent prompt content (see [agents](agents.md)).

## 2. Requirements

| ID | Requirement |
|---|---|
| FR-1 | Every bank in `data/` has exactly one loader command and can be loaded with no network or LLM access, except `dictionary_seed_fr.csv`, whose loader fills the cache from the LLM. |
| FR-2 | Loaders find `data/` relative to the repo root (`BASE_DIR.parent` or `__file__.parents[5]`), which is `/data` in the Docker image. Every bank loader except `import_notes` (which takes only `--path`) also supports `--dry-run`, and all of them accept `--path`. |
| FR-3 | JSON loaders validate required keys before writing and raise `CommandError` on invalid JSON, a missing file or missing keys. |
| FR-4 | Loaders are idempotent: re-running with an unchanged bank creates no duplicates. Each upserts on the stable key listed in §3. |
| FR-5 | By default, loaders skip rows that already exist. `--force` overwrites them. Notes always replace. Dictionary rows are never overwritten. |
| FR-6 | `--reset` (topics, grammar booster) deletes only content belonging to the bank's own taxonomy and language, inside a transaction for grammar. |
| FR-7 | Every row written by a FR bank loader has `language="fr"`, and `import_notes` writes `language="en"`. |
| FR-8 | `seed_dictionary_fr` derives `cefr_level` from frequency rank (see [dictionary](dictionary.md)), writes `source="seed"`, and writes failed lemmas to `data/dictionary_seed_failures.log` for `--retry-failed`. |

## 3. Data model (bank schemas)

### `data/topics_fr_<level>.json` (`level` ∈ `a1, a2, b1, b2, c1c2`)

```text
{
  _meta: {language: "fr", cefr_level, title, description},
  topics: [{
    name_fr*,            # stable key with language
    name_en, icon, order, difficulty_level, description,
    vocabulary: [{french*, english, gender (m|f|n|a), part_of_speech, example_sentence, pronunciation?}],
    phrases: [...],      # stored in Lesson.content.phrases
    reading: {title, content_fr, content_en, comprehension_questions[]},
    cultural_note: str   # stored in Lesson.content.cultural_note
  }]
}
```

Each topic produces up to 3 lessons, ordered 10, 20, 30:

| Lesson | Source | Title | Content |
|---|---|---|---|
| `vocab` | `vocabulary` | "Vocabulaire : <name_fr>" | rows bulk-created into `Vocabulary` |
| `text` | `reading` | the reading title | one `ReadingText` |
| `grammar` | `phrases` and `cultural_note` | "Expressions clés : <name_fr>" | JSON in `Lesson.content` |

### `data/grammar_booster_fr.json`

```text
{
  _meta: {language, title, note},
  categories: [{slug*, name*, icon, order, topics*: [{title*, slug*, cefr_level*, explanation* (markdown), summary, formula, examples[{fr, en}]}]}]
}
```

- Topic `order` is `index × 10` within its category.
- No drill items are supported in the bank today.

### `data/discover_trivia_fr.json`

```text
{
  _meta: {language, title, description},
  entries: [{slug* (unique in file), title*, fact_fr*, fact_en, summary, level, category, is_active (default true)}]
}
```

### `data/dictionary_seed_fr.csv`

- Header `rank,lemma,part_of_speech`.
- `rank` is an integer of 1 or more.
- `lemma` is lowercased by the loader.
- Rows are sorted by rank before processing.

### `data/structured_notes.json`

```text
{notes: [{note_number*, date* (ISO), title|null, words[{word, definition|null, example|null}]}]}
```

### Loader keys

| Loader | Key | Language |
|---|---|---|
| `seed_topics_fr` | `Topic(name_fr, language)` | `fr` |
| `seed_grammar_booster_fr` | `GrammarCategory.slug`, `GrammarTopic.slug` (global unique) | `fr` |
| `seed_discover_trivia_fr` | `TriviaTemplate(slug, language)` | `fr` |
| `seed_dictionary_fr` | `DictionaryCache(kind="lookup", key=lemma)` | none (no column) |
| `import_notes` | `Note(language, note_number)` | `en` |

## 4. API contract (command-line)

| Command | Flags | Effect |
|---|---|---|
| `seed_topics_fr` | `--level {a1,a2,b1,b2,c1c2,all}` (default all), `--force`, `--reset`, `--dry-run`, `--path` | Upserts topics. New topics get lessons. `--force` deletes and recreates an existing topic's FR lessons. `--reset` wipes the lessons of the file's topics up front. A missing level file is skipped with a warning. |
| `seed_grammar_booster_fr` | `--path`, `--force`, `--reset`, `--dry-run` | Upserts categories and topics. Existing topic slugs are skipped unless `--force`. |
| `seed_discover_trivia_fr` | `--path`, `--force`, `--dry-run` | Upserts templates. Existing slugs are skipped unless `--force`. Not wrapped in a transaction. |
| `seed_dictionary_fr` | `--path`, `--limit N`, `--dry-run`, `--retry-failed`, `--sleep S` | One LLM call per uncached lemma |
| `import_notes` | `--path`, `--force` (no-op) | One transaction. Upserts notes and replaces their words. |
| `seed_content` | none | FR starter content. No-op if any `Topic` exists. |
| `seed_demo_data` | none | FR topics 3-8 and 12 Discover cards. Per-topic skip by `name_fr`. |
| `seed_extended_content` | none | FR topics 9-20. Per-topic skip. |
| `seed_content_en` | none | EN topics, lessons and vocabulary. No-op if any EN `Topic` exists. |
| `seed_questions_en` | none | One MCQ per EN vocabulary item, skipping lessons that already have questions |
| `seed_conjugations` | none | "Conjugaison" topic, lesson and questions (`get_or_create`) |
| `seed_grammar` | none | Legacy grammar taxonomy and drills; replaces drills per topic |
| `seed_exam_exercises`, `seed_exam_all_levels` | none | `get_or_create(section, cefr_level, title)` |
| `seed_agents` / `seed_agents_en` | `--clear` / `--force` | Agent gallery |
| `seed_badges` | none | Badge definitions |
| `seed_flashcards` | `--username` | SRS card per vocabulary item per user |
| `seed_news`, `seed_news_en`, `generate_feed`, `fetch_news` | see [discover-news](discover-news.md) | Discover and news cards |

## 5. Business rules & invariants

- **Stable keys are the identity of authored content.** Renaming a key in a bank creates a new row, and the old row stays.
- **Removals are not propagated.** Dropping an entry from a bank does not delete or deactivate its database row.
- **Order constraints for a fresh database:**
  - `seed_content` must run before any other topic-creating command.
  - `seed_content_en` must run before any EN topic exists, including the "Our Notes" topic created at runtime.
  - `generate_feed` needs Vocabulary, GrammarRule and the trivia bank.
  - The full recommended order is in the wiki.
- **No secrets or personal data in banks.** `structured_notes.json` holds only vocabulary.
- **No em-dashes in new prose.** This is a repository convention. Existing banks use French typography.

## 6. Background jobs

- No Celery tasks load banks.
- Loaders are run manually after deploy. The deploy workflow (`.github/workflows/deploy.yml`) runs only `migrate`.
- Migration `content/0004_drop_legacy_icon_named_topics` is a data migration that removes two legacy FR topics.

## 7. Dependencies

- Django ORM models in `content`, `grammar`, `discover`, `dictionary`, `notes`, `exam_prep`, `progress`, `agents` and `gamification`.
- The LLM router (`seed_dictionary_fr`, `seed_news*`, `fetch_news`).
- `scripts/build_dictionary_seed_fr.py` (offline CSV builder).

## 8. Deviations / open questions

| # | Deviation |
|---|---|
| D-1 | About 9000 lines of authored content remain as Python literals in `seed_content`, `seed_demo_data`, `seed_extended_content`, `seed_content_en`, `seed_grammar`, `seed_exam_*` and `seed_conjugations`. This contradicts the "JSON bank + loader" pattern. Helper functions are duplicated across `seed_demo_data` and `seed_extended_content`. |
| D-2 | `seed_exam_exercises` and `seed_exam_all_levels` duplicate their loader logic and use `get_or_create`, so content edits never apply. |
| D-3 | `grammar_booster_fr.json` has no drills, so drills depend on the legacy `seed_grammar` taxonomy. |
| D-4 | JSON loaders hard-code `language="fr"` and ignore `_meta.language`. There are no EN banks yet. |
| D-5 | `seed_discover_trivia_fr` is not transactional. A mid-run failure leaves a partial load. |
| D-6 | `seed_content` and `seed_content_en` use global "any topic exists" guards instead of per-topic keys. |
| D-7 | `DictionaryCache` keys have no language. A future EN dictionary bank would collide with FR rows. |
| D-8 | There are two `data/` path conventions and no `settings.DATA_DIR`. No CI job dry-runs the banks. |
| D-9 | Content plan (`docs/superpowers/plans/2026-06-27-content-and-cache-plan.md`) status: Phase 1 is done; Phase 2 (conjugation pre-warm) is not started; Phase 3 is partial (trivia only, 100 of a planned ~200; no WOTD or culture bank); Phase 4 (`data/exam_prep_fr.json`) is not started; Phase 5 is not started. The plan header still says "Phase 1 starting next". |
