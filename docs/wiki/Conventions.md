# Conventions

> The rules every change to Lingaru follows: code layout, naming, language scoping, git workflow and docs. If a convention here disagrees with the code, the code is wrong or this page is stale: open an issue.

**Related:** [Architecture](Architecture.md) · [Testing and CI](Testing-and-CI.md) · [`CONTRIBUTING.md`](../../CONTRIBUTING.md)

## Git workflow

| Rule | Detail |
|------|--------|
| Branch from `main` | `<type>/<short-slug>`: `feat/`, `fix/`, `perf/`, `refactor/`, `docs/`, `test/`, `chore/`, `hotfix/`, `style/` |
| Commits | [Conventional Commits](https://www.conventionalcommits.org/) with an optional scope: `feat(assistant): ...`, `fix(topics): ...` |
| PRs | One coherent change per PR. Link the issue (`Closes #123`). Squash on merge; the PR title becomes the commit subject. |
| CI must be green | Ruff, pytest, ESLint, build, Trivy, Playwright. See [Testing and CI](Testing-and-CI.md). |

## Backend (Django)

### Where code goes

| Kind of code | Location |
|--------------|----------|
| A bounded domain (models, views, serializers, urls, admin, tasks) | `backend/apps/<domain>/` |
| Business logic used by views, tasks or the bot | `apps/<domain>/services.py` (or a `services/` package). Views stay thin: parse, call a service, serialize. |
| Cross-app infrastructure (LLM, TTS, STT, RAG, memory extraction) | `backend/services/<name>/` |
| Periodic or slow work | `@shared_task` in `apps/<domain>/tasks.py`; schedule in `config/celery.py` / `CELERY_BEAT_SCHEDULE` |
| Content seeding | Data in `data/*.json|csv`, loader in `apps/<domain>/management/commands/seed_*.py` |

### Rules

- **Language scoping.** Every content model has a `language` field. Querysets for user-facing content filter on `request.user.target_language`. LLM prompts are looked up per language via `services/llm/prompts.get_system_prompt(language, mode)`; never index `SYSTEM_PROMPTS` directly.
- **Ownership scoping.** Anything user-owned is fetched through `request.user` (for example `Model.objects.filter(user=request.user)`), never by bare primary key.
- **XP and streaks** go through `apps/gamification/services.py` (`award_xp`, streak helpers). Do not write `UserStats` directly.
- **SRS.** The SM-2 implementation lives in `apps/progress/services.py`. Reuse it rather than writing another scheduler.
- **Time.** Store UTC (`timezone.now()`); the frontend formats for display.
- **Queries.** Use `select_related` / `prefetch_related` for anything rendered in a list; add an index for any new hot filter.
- **External calls** (LLM, HTTP, RSS) need a timeout and must not run while a DB transaction is open.
- **Tests** live in `apps/<app>/tests/` and must not call real external APIs: mock the provider.

### Style

- Ruff lint + format, config in `backend/pyproject.toml` (line length 100, double quotes).
- Comments explain the non-obvious *why*, not the *what*.

## Frontend (React)

- One file per route in `src/pages/`, registered in `App.jsx`.
- All HTTP goes through the Axios client in `src/api/` (it attaches the JWT and handles refresh). No raw `fetch`.
- UI chrome strings go in `src/locales/{en,fr}.json` and are read with `useTranslation()`. Learning content is never translated by i18n.
- Use the design tokens (CSS variables / Tailwind theme) rather than hard-coded colours or pixel font sizes. See [Frontend Design System](Frontend-Design-System.md).
- ESLint must pass with no new warnings.

## Writing

- **No em-dashes** (the Unicode long dash) in user-facing strings, docs or commit messages. Use ` -- ` or `:`.
- Docs live in `docs/`:
  - `docs/wiki/`: how things work and how to work on them. Mirrored to the GitHub Wiki by `scripts/sync_wiki.sh`; edit here, never in the Wiki UI.
  - `docs/specs/`: the contract each domain honours (API, data model, rules). Update the spec in the same PR that changes behaviour.
  - `docs/superpowers/`: historical phase plans and design docs. Read-only history.
- A PR that adds or changes an endpoint updates the matching spec's API section.

## Security

Never commit secrets. `.env` is gitignored; `.env.example` holds placeholders only. Report vulnerabilities privately as described in [`SECURITY.md`](../../SECURITY.md), not as public issues.
