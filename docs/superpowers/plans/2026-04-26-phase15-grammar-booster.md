# Phase 15 — Grammar Booster

**Date:** 2026-04-26
**Status:** Shipped
**App:** `apps.grammar`

## Why

`apps.content.GrammarRule` was thematic — grammar that lives inside topical lessons (greetings, art, history). Learners preparing for B2 also need **structural** grammar practice — pure focus on tenses, pronouns, articles, negation, moods, sentence structure. That's a different surface and a different mental model, so it gets its own app rather than overloading `content`.

## Scope

- 6 categories: tenses, pronouns, articles, negation, moods, structure
- 11 topics seeded (passé composé avoir/être, imparfait, futur simple, direct/indirect object pronouns, definite/partitive articles, ne…pas, subjunctive present, forming questions)
- 90 drill items across 5 types: `fill_blank | mcq | transform | error_detect | reorder`
- SM-2-style mastery scoring per (user, topic): `mastery_score 0–100`, `interval_days`, `ease_factor` (default 2.5)
- Diagnostic mode (one drill per topic at user's CEFR level) and topic drill mode (10 random items)

## Models

- `GrammarCategory` — slug, icon, order
- `GrammarTopic` — category FK, slug, cefr_level, summary, explanation (markdown), formula, examples (JSON), exceptions (JSON), common_mistakes (JSON)
- `GrammarDrillItem` — topic FK, type, prompt, correct_answer, options (JSON), explanation, difficulty
- `GrammarMastery` — user, topic, attempts, correct_count, mastery_score, last_drilled_at, next_review_at, interval_days, ease_factor
- `GrammarSession`, `GrammarAnswer`

## Scoring constants (`apps.grammar.scoring`)

- `CORRECT_GAIN = 5`, `WRONG_PENALTY = 3`
- `MASTERED_THRESHOLD = 80`, `MASTERED_MIN_ATTEMPTS = 10`
- `XP_PER_CORRECT_DRILL = 3`, `XP_DRILL_PERFECT_BONUS = 10`

## Endpoints (`/api/grammar/`)

| Method | Path | Purpose |
|---|---|---|
| GET | `hub/` | Categories + mastery aggregates + recommended next topic |
| GET | `categories/`, `topics/`, `topics/{slug}/` | Browse |
| POST | `sessions/start/` | `{ topicId?, mode: "drill" \| "diagnostic" }` |
| POST | `sessions/{id}/answer/` | Record answer (client validates with 350 ms feedback delay) |
| POST | `sessions/{id}/complete/` | Update mastery, award XP, check streak |

## Recommended-topic priority

1. Topic with `next_review_at <= now` (due for review)
2. Weakest non-mastered topic the user has touched
3. First not-started topic at user's CEFR level

## Frontend

- `GrammarHub` — gradient hero, mastery rings, recommended-topic card, category tiles
- `GrammarLibrary` — filterable by category / CEFR level / status (`not_started | learning | practiced | mastered | all`)
- `GrammarTopic` — markdown explanation, formula chip, examples, exceptions, common-mistakes block
- `GrammarDrill` — MCQ with lettered badges, text drills with accent-insensitive comparison, ring-state on feedback, TriumphHero done screen
