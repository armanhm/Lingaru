# Contributing to Lingaru

Thanks for your interest! Lingaru is a personal-scale French-learning project but PRs and issues are welcome.

## TL;DR

```bash
# Backend
cd backend
ruff check . && ruff format --check .
DJANGO_SETTINGS_MODULE=config.settings.test pytest

# Frontend
cd frontend
npm run lint
npm run build
npx playwright test          # e2e, optional
```

If those four commands pass locally, CI will pass too.

## Getting Set Up

See the [README](README.md#local-development-without-docker) for the SQLite-backed local dev setup. The short version:

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DJANGO_SETTINGS_MODULE=config.settings.local
python manage.py migrate
python manage.py runserver

# Frontend
cd frontend
npm install
npm run dev
```

You'll want at least one of `GEMINI_API_KEY` / `GROQ_API_KEY` in your env if you're touching AI features. Most LLM-backed endpoints have an offline fallback (mock data) so they will still respond without a key, just with canned content.

## Branching & Commits

- **Branch:** off `main`. Name it `<type>/<short-slug>`, e.g. `feat/agent-translation`, `fix/quiz-streak-edge-case`.
- **Commit style:** [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `refactor:`, `test:`. Scope is optional but appreciated: `feat(assistant): …`.
- **Squash on merge.** Keep the PR title clean — it becomes the merge commit subject.

Examples from the existing history:

```
feat(agentic): 10 inline practice widgets in chat (mutate-in-place)
fix(assistant): auto-resume last chat, widget polish, agent routing
ci: auto-migrate, auto-rollback, Trivy, Lighthouse, coverage, Playwright, backups
```

## Code Style

- **Python:** Ruff (lint + format). Configuration lives in `backend/pyproject.toml`. Run `ruff check . --fix && ruff format .` before committing.
- **JavaScript / JSX:** ESLint (config in `frontend/eslint.config.js`). Run `npm run lint`.
- **No `// what this does` comments.** Code should be self-explanatory; reserve comments for the non-obvious *why*.
- **No em-dashes in user-facing strings or commit messages.** The codebase has been purged of them; please don't reintroduce them.

## Tests

- Backend tests live in `backend/apps/<app>/tests/` and run under `pytest`. Settings module: `config.settings.test` (SQLite).
- Frontend e2e specs live in `frontend/e2e/` and run under Playwright.

A PR that ships behavior change without a test will probably get nudged for one. A PR that ships a regression test for an existing bug — even without the fix — is also welcome.

## Where to Look

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system overview and conventions.
- [`docs/superpowers/specs/2026-04-04-lingaru-system-design.md`](docs/superpowers/specs/2026-04-04-lingaru-system-design.md) — the original design doc.
- [`docs/superpowers/plans/`](docs/superpowers/plans/) — per-phase plans. If you're adding a new phase, follow the same shape.
- [`README.md#api-endpoints`](README.md#api-endpoints) — REST surface, kept in sync with `backend/config/urls.py`.

## Reporting Bugs

Open a GitHub issue with:

- What you expected to happen.
- What actually happened (logs / stack traces / screenshots help a lot).
- Your environment (Docker Compose vs local, browser, Python / Node version if local).
- A minimal reproduction if you can.

For **security issues**, see [SECURITY.md](SECURITY.md) — please don't file those publicly.

## Code of Conduct

Be kind. Assume good intent. Disagree on technical merit, not on people. Project maintainer reserves the right to close threads that turn personal.
