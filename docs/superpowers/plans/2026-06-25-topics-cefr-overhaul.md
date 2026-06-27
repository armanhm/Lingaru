# Topics — hand-authored CEFR overhaul

**Date:** 2026-06-25 → 2026-06-27
**Status:** Shipped (PRs #41, #42, #43, #44)
**App:** `apps.content`

## Why

The `content` app shipped with a thin set of topics created by the original `seed_content` command — 10–12 FR topics, mostly A1, with placeholder icon strings (`"hand-wave"`, `"utensils"`) instead of emoji, and no consistent CEFR tagging. Topics were the entry point for almost every other feature (Lessons → SRS → Practice → Reading), so anaemic content there bottlenecked everything downstream.

Goal: a **rich CEFR-tagged topic library** big enough that a learner could practice general French from A1 → C1/C2 without ever leaving the app, and without runtime LLM calls.

## Scope

5 JSON files at the repo root, one per CEFR level:

| Level | Topics | Reading length (FR words, avg) |
|---|---|---|
| A1 — Découverte | 12 | ~200 |
| A2 — Survie | 11 | ~250 |
| B1 — Seuil | 13 | ~320 |
| B2 — Avancé | 12 | ~450 |
| C1-C2 — Autonome/Maîtrise | 10 | ~640 |
| **Total** | **58** | |

Each topic ships:
- ~25 vocabulary entries (FR + EN + gender + part-of-speech + example sentence)
- ~12 key phrases with usage notes
- 1 parallel FR/EN reading text with 4 comprehension questions
- 1 cultural note (often referencing Quebec/Canada cross-context at higher levels)

~16 000 lines / ~900 KB of source-of-truth content. No LLM at runtime.

## Source of truth

```
data/
  topics_fr_a1.json
  topics_fr_a2.json
  topics_fr_b1.json
  topics_fr_b2.json
  topics_fr_c1c2.json
```

Per-topic schema (matches `apps.content` models):

```json
{
  "name_fr": "...",
  "name_en": "...",
  "icon": "🎓",            // emoji only, no icon-pack names
  "order": 700,
  "difficulty_level": 4,   // 1=A1, 2=A2, 3=B1, 4=B2, 5=C1-C2
  "description": "...",
  "vocabulary": [
    {"french": "...", "english": "...", "gender": "m|f|a",
     "part_of_speech": "...", "example_sentence": "..."}
  ],
  "phrases": [{"fr": "...", "en": "...", "note": "..."}],
  "reading": {
    "title": "...",
    "content_fr": "...",
    "content_en": "...",
    "comprehension_questions": [{"q": "...", "a": "..."}]
  },
  "cultural_note": "..."
}
```

`difficulty_level` is an **integer** (not the CEFR string) because that matches the existing `Topic.difficulty_level` column. C1 and C2 share level 5 because the seed content bundles them as a single "C1-C2" level; the frontend tabs still split them visually.

## Seed command

`backend/apps/content/management/commands/seed_topics_fr.py`

- Loads one or more level files via `--level a1|a2|b1|b2|c1c2|all`.
- Idempotent: `Topic.objects.update_or_create(name_fr=..., language='fr', defaults={...})`.
- For each topic creates 3 lessons (vocab, reading, phrases) plus `Vocabulary` rows (bulk_create) and `ReadingText` rows.
- Flags: `--force` (rewrite lessons of existing topics), `--reset` (wipe lessons under listed topics before reseed), `--dry-run`, `--path` (override JSON path).
- Path resolves via `settings.BASE_DIR.parent / "data"` — repo root.

## Docker context change (PR #42)

The seed needs `data/` inside the container. The Dockerfile originally built with `context: ./backend`, so `data/` (at the repo root) was never copied in.

**Changed:**
- `backend/Dockerfile`: build context is now the repo root. `COPY backend/ /app/` + `COPY data/ /data/`.
- `docker-compose.yml`: switched django/celery/celery-beat/bot from `build: ./backend` to `build: { context: ., dockerfile: backend/Dockerfile }`. Extracted into a YAML anchor `&backend-build` to keep the file DRY.
- `docker-compose.dev.yml`: dropped the redundant `build:` block (compose merges base + override).
- `.github/workflows/ci.yml`: switched the Trivy build step from `docker build ./backend` to `docker build -f backend/Dockerfile .`.

## Dockerignore regression fix (PR #43)

The original `.dockerignore` had `**/media` and `**/staticfiles` — patterns that match anywhere in the tree. When the build context widened, those patterns silently excluded `backend/apps/media/` (a real Django app), causing `ModuleNotFoundError: No module named 'apps.media'` on container boot.

**Fix:** scope to `backend/staticfiles` and `backend/media` (the actual `MEDIA_ROOT` / `STATIC_ROOT` directories) so `apps/media/` ships.

## Topics page UX (PR #44)

`/topics` previously showed a flat grid of all topics. With 58+ topics that's a wall. Added:

- **CEFR tab strip** at top: A1 · A2 · B1 · B2 · C1 · C2.
- **Default tab = `user.target_level`** (from `apps.users.User.target_level`), falls back to B2.
- An effect synchronises `activeLevel` with `target_level` once `/users/me/` resolves (AuthContext loads async — without the effect the default always landed on B2).
- Each tab shows the level key + a descriptive label (Beginner / Elementary / Intermediate / Upper Intermediate / Advanced / Proficiency) + a count chip.
- Desktop: 6-column tab row spanning the same width as the 3-column card grid. Mobile: wraps to 2-3 columns.
- Card badge fixed: used to look up a `DIFFICULTY_BADGE` dict by string (`"A1"`) but the API returns integers — so cards showed the raw digit. Now the badge string is derived from the active level.

Also disabled DRF pagination on `TopicListView` (`pagination_class = None`). The frontend's `getTopics()` was reading `res.data.results` without paginating, so the default 20-per-page silently capped visible topics. Topic lists are small enough that returning the full set in one response is cheap.

This is a **coupled change** — backend and frontend ship together in PR #44:
- Backend: response shape changes from `{results: [...], count: N, ...}` to a plain `[...]` array.
- Frontend: `getTopics().then((res) => setTopics(res.data.results || res.data))` already falls back to the bare array, so it works for both shapes.
- Tests: `TestTopicListView` updated — `response.data["results"]` → `response.data`.

Any other client of `/api/content/topics/` (mobile, bot, embeds) must read `res.data` as a list, not look for `.results`. The frontend was the only consumer at the time of the change.

## Migrations

`backend/apps/content/migrations/0004_drop_legacy_icon_named_topics.py`

One-shot data migration: deletes any FR Topic whose `icon` is `"hand-wave"` or `"utensils"` (the two pre-overhaul A1 rows that displayed literal text). Idempotent; reverse is no-op. Cascades to dependent Lesson/Vocabulary/ReadingText rows.

## Deploy notes

- Workflow runs `migrate` automatically — the 0004 cleanup happens on deploy.
- **Seed is still manual the first time** (no LLM cost, but needs explicit run):
  ```bash
  ssh hetzner
  cd ~/Lingaru
  docker compose exec django python manage.py seed_topics_fr --level all
  ```
- TODO (separate plan): wire `seed_topics_fr --level all` into `deploy.yml` so future content updates ship without an ssh step.

## Counts after seed (post-prod)

```
FR topics total: 58
  L1 (A1):     12
  L2 (A2):     11
  L3 (B1):     13
  L4 (B2):     12
  L5 (C1-C2):  10
```

Pre-existing FR topics from `seed_content` that didn't name-collide with the new set stayed in place (most got tagged as their original difficulty); the icon-named legacy duplicates were removed by migration 0004.

## Follow-ups (not in this scope)

- Automate seed step in deploy workflow.
- Reading-text variety pass: 3-5 alternate readings per topic, so a learner revisiting a topic sees fresh material. See the Content & cache plan ([2026-06-27-content-and-cache-plan](2026-06-27-content-and-cache-plan.md)).
