# Grammar Booster — Hand-authored JSON refactor

**Date:** 2026-06-24
**Status:** Shipped (PRs #38, #39)
**App:** `apps.grammar`

## Why

Phase 15 (Grammar Booster, 2026-04-26) shipped with LLM-generated grammar content. That was the fastest way to launch, but it left three problems:

1. **Cost & latency** — every fresh seed re-spent tokens; cold cache meant slow first loads for learners.
2. **Quality drift** — different runs produced different explanations for the same rule, with occasional factual errors (e.g. wrong auxiliary for *passer* in passé composé).
3. **Editorial control** — fixing a bad example or wording required prompt tweaks, not a one-line edit.

We hit the point where "let the model write it" cost more than "write it once, store it" — both in money and in trust.

## What changed

Replaced the LLM generation path with a hand-authored JSON file at the repo root, imported by an idempotent management command. Same models, same API, same UI. Only the **source of truth** for the content changed.

## Source of truth

- **File:** `data/grammar_booster_fr.json`
- **Shape:** 8 categories, ~50 topics, all CEFR-tagged with full explanation, formula, examples, and exceptions.
- **Schema:**
  ```json
  {
    "categories": [
      {
        "slug": "tenses",
        "name": "Les temps",
        "icon": "...",
        "order": 1,
        "topics": [
          {
            "slug": "passe-compose-avoir",
            "title": "Passé composé avec avoir",
            "cefr_level": "A2",
            "summary": "...",
            "explanation": "Markdown body.",
            "formula": "...",
            "examples": [{"fr": "...", "en": "..."}, ...],
            "exceptions": ["..."],
            "common_mistakes": ["..."]
          }
        ]
      }
    ]
  }
  ```

## Seed command

`backend/apps/grammar/management/commands/seed_grammar_booster_fr.py`

- Reads `data/grammar_booster_fr.json` (overridable via `--path`).
- Idempotent: `update_or_create` keyed on `(slug, language='fr')`.
- Flags: `--force` (rewrite existing topics), `--reset` (delete topics in this taxonomy before reseeding, transactional), `--dry-run` (validate JSON + print plan).
- Validates required keys before any DB write.

## Drill items

Drill items (`GrammarDrillItem`) remain in the same shape as Phase 15 — the refactor only touched the explanation/formula/example payload. Drill content is still authored alongside topics in the JSON.

## Code paths removed

- The LLM client call inside the old `seed_grammar_booster` no longer runs. No request-time LLM calls existed for grammar in the first place; the deletion was strictly in the seed pipeline.

## Migration to prod

1. Deploy code (workflow runs `migrate` automatically).
2. SSH to server: `docker compose exec django python manage.py seed_grammar_booster_fr --reset`.
3. Verify count: `GrammarTopic.objects.filter(language='fr').count() == ~50`.

## Lessons learned

- "LLM-generated and store" still leaves the burn-down problem of re-running seeds against a changing model. Storing the source as JSON in the repo gives us git-level review and zero cost on re-seed.
- The seed-from-JSON pattern (`data/<feature>_<lang>.json` → `seed_<feature>_<lang>.py` → `update_or_create` keyed on a stable slug) is now the canonical shape. Topics overhaul re-used it the next day.
