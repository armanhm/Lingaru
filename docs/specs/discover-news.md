# Spec: Discover and News

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Discover and News](../wiki/Discover-and-News.md)

## 1. Purpose & scope

**In scope:**
- `backend/apps/discover/`:
  - the Discover feed (word, grammar and trivia cards)
  - the trivia bank
  - the News surface (RSS pipeline, LLM rewrite, fallbacks)
  - interaction tracking and XP
  - Celery tasks and management commands
- The routes mounted at `/api/discover/` and `/api/news/`.

**Out of scope:**
- Vocabulary and GrammarRule authoring (the `content` app).
- LLM provider internals.
- The Telegram `/news` formatter (see [telegram-bot.md](telegram-bot.md)).

## 2. Requirements

| ID | Requirement |
|---|---|
| FR-1 | `generate_daily_cards()` produces, for every distinct `User.target_language` (or `["fr"]` when there are no users), at most one `word`, one `grammar` and one `trivia` card. A generator that raises or returns `None` is skipped and logged. |
| FR-2 | Word cards come from a random `content.Vocabulary` with `language=lang`. The headword is `english` for `en` and `french` otherwise. The summary is `"<headword>, <translation>"`. |
| FR-3 | Grammar cards come from a random `content.GrammarRule` with `language=lang`. The summary is the first 200 characters of the explanation. |
| FR-4 | Trivia cards are copied from a random active `TriviaTemplate` with `language=lang`. No LLM is called. When the bank for `lang` is empty, no trivia card is made. |
| FR-5 | Word, grammar and trivia cards expire 24 h after generation. News cards expire 7 days after generation. |
| FR-6 | The feed lists every non-news card in the user's `target_language`, whether expired or not. Each card carries `seen` and `interacted` booleans for the requesting user. Ordering is `seen` ascending, then `generated_at` descending. |
| FR-7 | A user's first interaction with a card creates or updates `UserDiscoverHistory(interacted=True)` and awards 3 XP. Later interactions award 0. |
| FR-8 | `fetch_real_news()` reads each configured RSS source and skips entries with no link, no title, or a link already stored as a news `source_url`. It takes at most 3 items from a `preferred` source and 1 from any other (or `limit_per_source` when given), then shuffles the result. |
| FR-9 | `adapt_news_for_learners(item)` sends the headline and summary to the LLM with `ADAPT_SYSTEM_PROMPT`. Code fences are stripped before parsing the JSON. It returns `None` on an LLM or parse failure. |
| FR-10 | `save_adapted_card()` stores a `news` card with `source_url` and `content_json` containing `article_fr, article_en, vocabulary, expressions, grammar_points, source_name, source_id, source_domain`. The topic falls back to the source default when the LLM's topic is invalid. The level is uppercased and cut to 2 characters (default `B1`). |
| FR-11 | `run_news_pipeline(max_total)` processes at most `max_total` fresh items and returns `(created, skipped)`. |
| FR-12 | `generate_news_card(topic, lang)` tries, in order: (1) for `fr` only, one fresh RSS item for the topic (all sources when no topic, or when no source matches); (2) an LLM-synthetic article using the `news_generator` prompt; (3) the curated offline mock for that topic, or a random one. The resulting card is saved with a 7-day expiry. |
| FR-13 | News list and detail are limited to `type="news"` and the user's `target_language`. The list also excludes expired cards. Opening the detail view marks the card seen and awards no XP. |
| FR-14 | `seed_discover_trivia_fr` loads `data/discover_trivia_fr.json` into `TriviaTemplate`, keyed on `(slug, "fr")`. It skips existing slugs unless `--force`. It validates the required keys and that slugs are unique within the file. |
| FR-15 | `pick_trivia_template(user, lang)` returns an active template the user has not seen when one exists, otherwise a random active template, or `None` when the bank is empty. `generate_trivia_card_from_bank` also records `UserTriviaSeen`. |

## 3. Data model

### `DiscoverCard` (`discover_cards`)

| Field | Type | Constraints / notes |
|---|---|---|
| `type` | Char(10) | choices `news`, `word`, `grammar`, `trivia` |
| `title` | Char(300) | |
| `summary` | Text | default "" |
| `content_json` | JSON | default `{}`; shape depends on type (below) |
| `source_url` | URL(500) | null; news only |
| `image_url` | URL(500) | null |
| `generated_at` | DateTime | default now |
| `expires_at` | DateTime | null |
| `topic` | Char(12) | choices `politics, sports, culture, economy, science, tech, society, environ, world, misc`; blank allowed |
| `level` | Char(2) | CEFR hint, blank allowed |
| `language` | Char(8) | choices `fr`, `en`; default `fr`; **indexed** |

Meta: ordering `-generated_at`. Property: `is_expired`.

`content_json` shapes:

| type | keys |
|---|---|
| word | `french, english, pronunciation, example, gender, part_of_speech` |
| grammar | `explanation, formula, examples, exceptions` |
| trivia | `fact_fr, fact_en` |
| news | `article_fr, article_en, vocabulary[{french, english, pos, example_fr}], expressions[{fr, en, note}], grammar_points[{title, explanation, example_fr}]`, plus `source_name, source_id, source_domain` for RSS cards |

### `TriviaTemplate` (`discover_trivia_templates`)

| Field | Type | Notes |
|---|---|---|
| `slug` | Slug(100) | indexed |
| `language` | Char(8) | indexed, default `fr` |
| `title` | Char(300) | |
| `summary` | Text | |
| `fact_fr` | Text | required |
| `fact_en` | Text | |
| `level` | Char(2) | CEFR |
| `category` | Char(40) | free-form |
| `is_active` | Bool | indexed, default true |
| `created_at` / `updated_at` | DateTime | |

Unique `(slug, language)` (`unique_trivia_slug_per_lang`). Ordering `language, slug`.

### `UserTriviaSeen` (`discover_user_trivia_seen`)

- Fields: `user` FK (cascade, related `trivia_seen`), `template` FK (cascade, related `seen_by`), `seen_at`.
- Unique `(user, template)`.

### `UserDiscoverHistory` (`discover_user_history`)

- Fields: `user` FK (cascade, related `discover_history`), `card` FK (cascade, related `view_history`), `seen_at`, `interacted` Bool.
- Unique `(user, card)`.

## 4. API contract

All endpoints require JWT authentication (`IsAuthenticated`). All are language-scoped by `request.user.target_language` unless noted otherwise.

### `GET /api/discover/feed/`

- **Query:** `page`.
- **200:** `{count, next, previous, results: DiscoverCard[]}`, 20 per page.
- **DiscoverCard fields:** `id, type, title, summary, content_json, source_url, image_url, generated_at, expires_at, topic, level, language, seen, interacted`.
- **Scope:** excludes `type="news"`.

### `POST /api/discover/generate-more/`

- **Body:** `{"rounds": int}` (optional, default 3, clamped to 1..5; invalid values become 3).
- **200:** `{generated: int, rounds: int, cards: DiscoverCard[]}`.
- **Language:** not scoped to the requester. Cards are made for every active language.

### `POST /api/discover/cards/<card_id>/interact/` (alias `POST /api/news/<card_id>/interact/`)

- **Body:** none.
- **404:** the card is not in the user's language.
- **200, first time:** `{"already_interacted": false, "xp_awarded": 3, "total_xp": int}`.
- **200, repeat:** `{"already_interacted": true, "xp_awarded": 0}`.

### `GET /api/news/`

- **Query:** `topic` (optional slug), `page`.
- **Scope:** `type=news`, language-scoped, `expires_at` null or in the future.
- **200:** `{count, next, previous, results: {articles: NewsList[], topics: [{topic, count}]}}`, 24 per page.
- **NewsList fields:** `id, title, summary, topic, level, source_url, source_name, source_domain, image_url, generated_at, read_minutes, seen, interacted`.
- `read_minutes` = max(1, round(words in `article_fr` / 130)).
- `topics` counts all news cards in the language, including expired ones.

### `GET /api/news/<pk>/`

- **200:** NewsDetail with `id, title, summary, topic, level, source_url, source_name, source_domain, image_url, generated_at, article_fr, article_en, vocabulary, expressions, grammar_points, read_minutes, seen, interacted`.
- **404:** `{"detail": "Not found."}`.
- **Side effect:** creates a `UserDiscoverHistory` row (seen).

### `POST /api/news/generate/`

- **Body:**
  - `topic`: optional; used for RSS source selection, and in the synthetic prompt only when it is a valid topic.
  - `count`: default 3, clamped to 1..5.
- **201:** `{generated: int, cards: NewsDetail[]}`.
- **503:** `{"detail": "News generation failed. Try again later."}` when no card was created.
- **Language:** cards are generated for the default language `fr`; the view does not pass the user's language.

## 5. Business rules & invariants

| Rule | Value |
|---|---|
| Discover interaction XP | 3, once per (user, card), `activity_type="discover_interact"`, `source_id=str(card.pk)` |
| Card expiry | word, grammar, trivia: 24 h; news: 7 days |
| News dedupe | by exact `source_url` among existing news cards (no DB constraint) |
| RSS per-source cap | `preferred`: 3, others: 1 |
| LLM input caps | title ≤ 280 characters, summary ≤ 1200 characters |
| Pipeline batch size | `max_total=10` per scheduled run |
| Valid news topics | `politics, sports, culture, economy, science, tech, society, environ, world, misc` |
| Trivia seed idempotency | keyed on `(slug, "fr")`; `--force` overwrites; removing an entry from the JSON does not deactivate it |

## 6. Background jobs

| Name | Type | Schedule / usage | What it does |
|---|---|---|---|
| `discover.generate_daily_feed` | Celery task | every 86400 s (beat) | `generate_daily_cards()`; returns the count |
| `discover.fetch_real_news_pipeline` | Celery task | 07:00 and 19:00 UTC, `max_total=10` | `run_news_pipeline`; returns `{created, skipped}` |
| `generate_feed` | mgmt cmd | manual | same as the daily task |
| `fetch_news [--max N] [--clear]` | mgmt cmd | manual | runs the RSS pipeline; `--clear` deletes all news cards first |
| `seed_news [--clear]` | mgmt cmd | manual | one `generate_news_card` per topic except `misc` (FR) |
| `seed_news_en` | mgmt cmd | manual | one EN card per topic, skipping topics with an active EN card |
| `seed_discover_trivia_fr [--path] [--force] [--dry-run]` | mgmt cmd | after deploy | loads the trivia bank |

## 7. Dependencies

- **Apps:** `content` (`Vocabulary`, `GrammarRule`), `users` (`target_language`), `gamification` (`award_xp`).
- **Services:** `services.llm.factory.create_llm_router`, `services.llm.prompts.get_system_prompt` (`news_generator`).
- **Libraries:** `feedparser`.
- **External:** the 11 RSS endpoints in `apps/discover/sources.py`.
- **Data:** `data/discover_trivia_fr.json`.

## 8. Deviations / open questions

| # | Deviation |
|---|---|
| D-1 | `DiscoverCard` has no retention policy. The feed shows expired cards on purpose, so rows grow without limit. |
| D-2 | `generate-more` creates shared cards for every language on every call. Intent is probably the requester's language only. |
| D-3 | Trivia selection for the feed does not use `UserTriviaSeen`, so duplicate trivia cards can appear. `generate_trivia_card_from_bank` and `pick_trivia_template` are only called from tests. |
| D-4 | `POST /api/news/generate/` does not pass `request.user.target_language`, so EN users get FR-generated cards that the EN-scoped list then hides. |
| D-5 | The content plan (`docs/superpowers/plans/2026-06-27-content-and-cache-plan.md`, Phase 3) calls for RSS-only news. The LLM-synthetic and curated-mock layers remain. The synthetic layer writes invented articles. |
| D-6 | The synthetic layer catches only `RuntimeError`, `JSONDecodeError` and `KeyError`, and does not strip code fences. Other provider errors reach the view. |
| D-7 | News `title` from the LLM is not length-checked against `max_length=300`, `level` is not validated against CEFR values, and the parsed `published` date is discarded. |
| D-8 | Topic counts in the news list include expired cards. |
| D-9 | No composite index for `(language, type, -generated_at)` and no index on `source_url`. Dedupe loads every news URL into memory. |
| D-10 | The interact endpoint uses get-or-create and a separate award without a transaction, so concurrent first interactions may award twice. |
| D-11 | There is no EN trivia bank. `seed_discover_trivia_fr` hard-codes `language="fr"` and ignores `_meta.language`. |
| D-12 | The seed command docstrings for `seed_news` describe "offline mock" behaviour, but the command tries RSS and the LLM first. |
