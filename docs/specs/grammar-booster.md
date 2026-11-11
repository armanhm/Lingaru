# Spec: Grammar Booster

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Grammar Booster](../wiki/Grammar-Booster.md)

## 1. Purpose & scope

**In scope:**
- `backend/apps/grammar/`:
  - the grammar taxonomy (categories, topics)
  - drill items
  - drill and diagnostic sessions
  - SM-2 mastery
  - XP
  - the `seed_grammar` and `seed_grammar_booster_fr` commands
  - `data/grammar_booster_fr.json`

**Out of scope:**
- The legacy `content.GrammarRule` (used by Discover).
- XP and streak internals.
- Frontend rendering.

## 2. Requirements

| ID | Requirement |
|---|---|
| FR-1 | All taxonomy reads are scoped to `request.user.target_language` and to `is_active=True` topics. |
| FR-2 | The hub lists every category in the user's language that has at least one active topic. For each it gives `topic_count`, `mastered_count` (status `mastered`) and `avg_mastery` (mean of the user's mastery scores, with 0 for unstarted topics, rounded to 1 dp). |
| FR-3 | The hub picks `recommended_topic` as the first of: the earliest-due `GrammarMastery` (`next_review_at <= now`); the non-mastered mastery record with the lowest score; the first active topic in the user's language the user has not started; otherwise `null`. |
| FR-4 | The topic list supports filtering by `category` (slug) and `level`. Each item includes `drill_count` and the requesting user's `mastery` and `status`. |
| FR-5 | Topic detail is looked up by slug within the user's language and returns 404 if not found. |
| FR-6 | Starting a drill session requires `topic_id` (400 otherwise), a topic in the user's language (404 otherwise) and at least one drill (400 otherwise). It returns at most 10 randomly ordered drills and records `mastery_before`. |
| FR-7 | Starting a diagnostic session uses up to 12 active topics at `user.target_level`. If there are fewer than 5, it uses 12 random active topics of any level. It returns one random drill per topic that has drills, and 400 if none do. |
| FR-8 | Submitting an answer to an owned, open session stores a `GrammarAnswer` with the client-reported `is_correct`, and increments `session.score` when true. It returns 404 for another user's session and 400 for a completed one. |
| FR-9 | Completing a session sets `completed_at`. For drill sessions it applies `update_mastery` and stores `mastery_after`. It awards XP when greater than 0 and calls `check_streak`. Completing an already-completed session returns the stored summary without side effects. |
| FR-10 | `seed_grammar_booster_fr` validates the JSON and upserts categories by slug (`language="fr"`). It skips topics whose slug exists unless `--force`. `--reset` deletes the FR topics of the file's categories inside a transaction. `--dry-run` writes nothing. |
| FR-11 | `seed_grammar` upserts its categories and topics by slug and replaces each of its topics' drill items. |

## 3. Data model

| Model (table) | Field | Type | Constraints / notes |
|---|---|---|---|
| `GrammarCategory` (`grammar_categories`) | `name` | Char(100) | |
| | `slug` | Slug(120) | **unique (global)** |
| | `description` | Text | |
| | `icon` | Char(10) | emoji |
| | `order` | PositiveInt | |
| | `language` | Char(8) | fr or en, default fr, indexed |
| | *Meta* | | ordering `order, name` |
| `GrammarTopic` (`grammar_topics`) | `category` | FK GrammarCategory | cascade, related `topics` |
| | `title` | Char(200) | |
| | `slug` | Slug(200) | **unique (global)** |
| | `cefr_level` | Char(2) | A1..C2, default A2 |
| | `summary` | Char(300) | |
| | `explanation` | Text | markdown |
| | `formula` | Char(400) | |
| | `examples` | JSON list | `[{fr, en}]` |
| | `exceptions` | JSON list | |
| | `common_mistakes` | JSON list | `[{wrong, right, note}]` |
| | `order` | PositiveInt | |
| | `is_active` | Bool | |
| | `created_at` | DateTime | |
| | `language` | Char(8) | indexed |
| | *Meta* | | ordering `category__order, order, cefr_level` |
| `GrammarDrillItem` (`grammar_drill_items`) | `topic` | FK | cascade, related `drills` |
| | `type` | Char(15) | `fill_blank`, `mcq`, `transform`, `error_detect`, `reorder` |
| | `prompt`, `correct_answer` | Text | |
| | `options` | JSON list | MCQ |
| | `explanation` | Text | |
| | `difficulty` | PositiveSmallInt | 1-5 |
| | `language` | Char(8) | indexed |
| `GrammarMastery` (`grammar_mastery`) | `user`, `topic` | FK | unique `(user, topic)` |
| | `attempts`, `correct_count` | PositiveInt | |
| | `mastery_score` | Float | 0-100 |
| | `last_drilled_at`, `next_review_at` | DateTime null | |
| | `interval_days` | Float | default 1.0 |
| | `ease_factor` | Float | default 2.5 |
| `GrammarSession` (`grammar_sessions`) | `user` | FK | |
| | `topic` | FK null | null for diagnostic |
| | `mode` | Char(12) | `drill` or `diagnostic` |
| | `score`, `total` | PositiveInt | |
| | `mastery_before`, `mastery_after` | Float null | |
| | `started_at`, `completed_at` | DateTime | ordering `-started_at` |
| `GrammarAnswer` (`grammar_answers`) | `session` | FK | cascade |
| | `drill_item` | FK | SET_NULL |
| | `user_answer` | Text | |
| | `is_correct` | Bool | |
| | `answered_at` | DateTime | |

JSON bank (`data/grammar_booster_fr.json`): `{_meta, categories: [{slug, name, icon?, order?, topics: [{title, slug, cefr_level, explanation, summary?, formula?, examples?}]}]}`.

## 4. API contract

Base path `/api/grammar/`. Every endpoint requires `IsAuthenticated`. None are paginated.

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `hub/` | n/a | 200 `{categories: [{id, name, slug, icon, topic_count, mastered_count, avg_mastery}], recommended_topic: TopicList \| null, total_topics, total_mastered, due_for_review}` |
| GET | `categories/` | n/a | 200 `[{id, name, slug, description, icon, order, topic_count}]` |
| GET | `topics/?category=<slug>&level=<A1..C2>` | n/a | 200 `TopicList[]` |
| GET | `topics/<slug>/` | n/a | 200 `TopicDetail`; 404 `{"detail": "Topic not found."}` |
| POST | `sessions/start/` | `{topic_id?: int \| null, mode?: "drill" \| "diagnostic"}` | 201 `{session_id, mode, topic: TopicList \| null, items: DrillItem[]}`; 400 (missing topic_id, no drills); 404 (topic) |
| POST | `sessions/<session_id>/answer/` | `{drill_item_id: int, user_answer: str (blank ok), is_correct: bool}` | 200 `{ok: true, running_score}`; 400 completed; 404 |
| POST | `sessions/<session_id>/complete/` | n/a | 200 `{id, mode, score, total, accuracy, mastery_before, mastery_after, mastery_delta, new_status, completed_at, xp_earned?}` (`xp_earned` only on the first completion); 404 |

Shapes:

| Shape | Fields |
|---|---|
| TopicList | `id, title, slug, summary, cefr_level, formula, category_name, category_slug, category_icon, drill_count, mastery (0-100, 1 dp), status` |
| TopicDetail | TopicList + `explanation, examples, exceptions, common_mistakes` |
| DrillItem | `id, type, prompt, correct_answer, options, explanation, difficulty` |

## 5. Business rules & invariants

| Rule | Value |
|---|---|
| XP | `3 × score`, +10 when `total > 0 and score == total`; `activity_type = "grammar_<mode>"`; nothing awarded at 0 |
| Mastery delta | `+5 × correct − 3 × wrong`, clamped to [0, 100] |
| Status | `mastered`: score ≥ 80 and attempts ≥ 10; `practiced`: ≥ 50; `learning`: below 50 with attempts > 0; `not_started`: no attempts |
| SM-2 quality | `round(accuracy × 5)` |
| Interval | q < 3: 1 day; first session: 2 days; interval < 6: 6 days; otherwise `round(interval × ease, 1)` |
| Ease | `max(1.3, ease + 0.1 − (5−q)(0.08 + (5−q) × 0.02))` |
| Drill session size | at most 10 items; diagnostic: at most 12 |
| Accuracy (response) | `round(score / total × 100, 1)` or 0 |

## 6. Background jobs

There are no Celery tasks.

| Command | Flags | Notes |
|---|---|---|
| `seed_grammar_booster_fr` | `--path`, `--force`, `--reset`, `--dry-run` | Loads `data/grammar_booster_fr.json` (path resolved relative to the repo root). Creates no drills. |
| `seed_grammar` | none | Legacy Python literal seed (categories, topics, drills). Replaces the drills of its topics on each run. |

## 7. Dependencies

- `gamification.services.award_xp` and `check_streak`.
- `users.User.target_language` and `target_level`.
- `data/grammar_booster_fr.json`.

## 8. Deviations / open questions

| # | Deviation |
|---|---|
| D-1 | The JSON booster (49 topics) contains no drills and the loader creates none, so those topics cannot be drilled. `docs/superpowers/plans/2026-06-24-grammar-booster-json-refactor.md` says drills are authored in the JSON. |
| D-2 | Category and topic slugs are globally unique although the tables are language-scoped. `(slug, language)` would match the multi-language design. `seed_grammar` upserts by slug without a language. |
| D-3 | In the hub, `GrammarMastery` (for the aggregates, `due_for_review` and the recommendation) is not filtered by `topic__language`. |
| D-4 | Answer grading is reported by the client. XP and session scores are not idempotent: answers are not deduplicated per drill item, `score` is not capped at `total`, and `drill_item_id` is not checked against the session. |
| D-5 | Query counts: the hub runs one topic query per category, `categories/` runs one count per category, and diagnostic runs one drill query per topic. |
| D-6 | `seed_grammar` deletes and recreates drills, which sets `GrammarAnswer.drill_item` to NULL in history. |
| D-7 | The status thresholds are duplicated between `models.GrammarMastery.status` and `scoring.status_for`. |
| D-8 | The `StartSessionView` docstring says "Returns 8-12 drill items", but the code caps at 10 (drill) or 12 (diagnostic). |
