# Phase 12 — Dictionary & Verb Conjugator

**Date:** 2026-04-26
**Status:** Shipped
**App:** `apps.dictionary`

## Why

Learners constantly need to look up French words and conjugate verbs while practicing — a fast first-class lookup surface keeps them in flow instead of bouncing to external tools.

## Scope

- Word lookup with POS, gender, register, definitions, examples, synonyms, antonyms, etymology
- Verb conjugator across 8 tenses (Présent, Imparfait, Passé composé, Futur simple, Conditionnel présent, Subjonctif présent, Impératif, Plus-que-parfait)
- LLM-backed with caching so repeat lookups stay free
- Cross-linked: a word lookup with `part_of_speech === "verb"` shows a "Conjugate …" link

## Models

- `DictionaryEntry` — lemma (unique), payload (JSON), created_at — caches LLM responses
- `ConjugationCache` — verb (unique), payload (JSON), created_at — caches conjugation tables

## Endpoints (`/api/dictionary/`)

- `POST lookup/` — `{ "word": "..." }` → `{ result: { word, part_of_speech, gender, register, definitions[], examples[], synonyms[], antonyms[], etymology } }`
- `POST conjugate/` — `{ "verb": "..." }` → `{ result: { verb, auxiliary, past_participle, present_participle, tenses } }`

## Frontend

`Dictionary.jsx` — single page with two tabs: 📖 Dictionary / ✏️ Verb conjugator. Search input with magnifier icon, gradient tab pills, top-band gradient on results card. Quick words and quick verbs pre-populated below the input.
