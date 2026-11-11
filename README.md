# Lingaru
A comprehensive French language learning application targeting B1 to B2 progression. Lingaru combines structured lessons, interactive practice, AI-powered assistance, and a Telegram bot -- all backed by a Django monolith with a React frontend.

<img width="1577" height="906" alt="image" src="https://github.com/user-attachments/assets/2640737a-eb5e-40a0-ba04-391e72e28098" />


## Features

| Phase | Features |
|-------|----------|
| 1 - Foundation | Django project, JWT auth, PostgreSQL, Docker Compose, React shell |
| 2 - Content | Topics, lessons, vocabulary, grammar, reading texts, admin management |
| 3 - Practice | Quiz engine (MCQ, fill-blank, translate), Duolingo-style UI |
| 4 - Telegram Bot | Bot setup, `/start`, `/quiz`, `/word`, `/daily`, `/stats` |
| 5 - AI Assistant | Gemini/Groq chat, writing correction, grammar explanations, image queries |
| 6 - Gamification | XP, streaks, badges, leaderboard |
| 7 - Audio | TTS for vocabulary, STT for pronunciation, dictation exercises |
| 8 - Discover | Explore feed, daily content cards (word / grammar / trivia) |
| 9 - Advanced Practice | Conjugation drills, cloze exercises, mistake journal, SRS (SM-2) |
| 10 - Multimodal | Image queries (Gemini vision), voice conversation practice |
| 11 - RAG | Document upload, PDF indexing, context-aware AI answers |
| 12 - Dictionary | French dictionary lookups + verb conjugator (cached LLM-generated entries) |
| 13 - Mini Games | 6 mini-games -- Word Scramble, Match Pairs, Gender Snap, Missing Letter, Speed Round, Listening Challenge |
| 14 - Exam Prep | TCF / TEF practice -- diagnostic, week-by-week plan, section-by-section drills, mocks history |
| 15 - Grammar Booster | Dedicated grammar app: 6 categories, 11 topics, 90 drill items, SM-2 mastery scoring |
| 16 - News | Standalone `/news` page -- articles by topic with vocab, expressions, and grammar tabs |
| 17 - UI Overhaul | Premium token system (Inter + Instrument Serif + JetBrains Mono), Hybride dashboard (compass + recommended session), redesigned Assistant (single-column chat with drawers), gradient top-band cards across all pages |
| 18 - i18n | App-chrome translations (EN/FR) -- `i18next` + `react-i18next`, persisted per-user via `user.ui_language`. French stays the learning target; UI chrome is localizable. |
| 19 - Agents | Admin-editable specialised assistants (slug, system prompt, mode, suggested questions). `/agents` gallery + dedicated run pages, plus `@-mention` routing from the main chat composer. |
| 20 - Agentic Mode | Inline practice widgets in chat: the assistant emits `action` / `feature_widget` blocks (quiz, conjugate, dictionary lookup, grammar drill, mini-game, news, SRS) that mutate-in-place inside the chat bubble. |
| 21 - Observability | Sentry (backend + frontend), health probe (`/api/health/`), CI (Ruff + pytest + ESLint + Playwright + Lighthouse + Trivy + coverage), auto-deploy to Hetzner with migration rollback. |
| 22 - Multi-language | English alongside French. Per-user `target_language`; admin-editable EN agent prompts; per-language LLM routing; flag indicator next to logo. v2.0.0. |

## Tech Stack

**Backend:** Django 5.1, Django REST Framework, Simple JWT, Celery + Redis, PostgreSQL, Gunicorn

**Frontend:** React 18, Vite 5, React Router 6, Axios, Tailwind CSS 3, i18next (EN/FR app chrome)

**AI/ML:** Google Gemini (primary), Groq (fallback), gTTS, PyPDF2

**Infrastructure:** Docker Compose, Nginx, Redis, PostgreSQL 16

**Observability:** Sentry (Django + React), `/api/health/` liveness probe, GitHub Actions CI + auto-deploy

**Telegram:** python-telegram-bot 21

## Quick Start (Docker Compose)

```bash
# Clone the repo
git clone <repo-url> && cd Lingaru

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your keys (see Environment Variables below)

# Start all services (production mode)
docker compose up -d --build

# Or use dev mode (hot reload, exposed ports)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Run migrations (NOT run at container start; run once after the first start and after each pull)
docker compose exec django python manage.py migrate

# Create a superuser
docker compose exec django python manage.py createsuperuser
```

The app will be available at:
- **Web UI:** http://localhost (via Nginx) or http://localhost:5173 (Vite dev server)
- **API:** http://localhost/api/ or http://localhost:8000/api/
- **Admin:** http://localhost/admin/

## Local Development (without Docker)

For quick iteration you can run the backend with SQLite and the frontend dev server directly.

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Use local settings (SQLite, DEBUG=True)
export DJANGO_SETTINGS_MODULE=config.settings.local
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

`backend/config/settings/local.py` (SQLite, eager Celery, local-memory cache) is included in the repo.

## Project Structure

```
Lingaru/
├── backend/
│   ├── apps/
│   │   ├── users/          # Auth, registration, profiles
│   │   ├── content/        # Topics, lessons, vocabulary, grammar (legacy GrammarRule)
│   │   ├── practice/       # Quiz engine, sessions, answers
│   │   ├── progress/       # SRS cards, mistake journal, conjugation drills
│   │   ├── gamification/   # XP, streaks, badges, leaderboard
│   │   ├── assistant/      # AI chat, image queries, voice chat
│   │   ├── media/          # TTS, pronunciation, dictation
│   │   ├── discover/       # Explore feed, daily cards, dedicated News API
│   │   ├── documents/      # PDF upload, RAG indexing
│   │   ├── dictionary/     # French dictionary lookups + verb conjugator
│   │   ├── exam_prep/      # TCF/TEF prep -- exercises, sessions, history
│   │   ├── grammar/        # Grammar Booster -- categories, topics, drills, mastery (SM-2)
│   │   ├── agents/         # Specialised assistants (admin-editable), agent runs
│   │   └── bot/            # Telegram bot handlers
│   ├── config/             # Django settings, URLs, WSGI, Celery
│   │   └── settings/       # base.py, dev.py, prod.py, test.py
│   ├── services/           # Shared service layer
│   │   ├── llm/            # Gemini + Groq clients, fallback routing
│   │   ├── tts/            # Text-to-speech
│   │   ├── stt/            # Speech-to-text
│   │   └── rag/            # Document retrieval
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/            # Axios client
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts (auth, etc.)
│   │   ├── hooks/          # Custom hooks
│   │   └── pages/          # Route pages
│   └── package.json
├── nginx/                  # Nginx config
├── docker-compose.yml      # Production stack
├── docker-compose.dev.yml  # Dev overrides (hot reload, exposed ports)
└── .env.example
```

## API Endpoints

All endpoints live under `/api/` and (except registration, login and `/api/health/`) require a JWT `Authorization: Bearer` header. Content endpoints are scoped to the user's `target_language`. The full contract for each domain (every endpoint, request and response shape, status codes) is in its spec:

| Prefix | Domain | Spec |
|--------|--------|------|
| `/api/users/` | Registration, login, token refresh, profile | [users-auth](docs/specs/users-auth.md) |
| `/api/content/` | Topics, lessons, vocabulary, video lessons | [content](docs/specs/content.md) |
| `/api/practice/` | Lesson quiz sessions | [practice](docs/specs/practice.md) |
| `/api/progress/` | SRS, mistakes, conjugation, lesson/topic progress | [progress-srs](docs/specs/progress-srs.md) |
| `/api/gamification/` | XP, streaks, badges, leaderboard, trend, mini-games | [gamification](docs/specs/gamification.md) |
| `/api/assistant/` | Chat, voice, image, conversations | [assistant](docs/specs/assistant.md) |
| `/api/agents/` | Specialised assistants | [agents](docs/specs/agents.md) |
| `/api/memory/` | Learner memory notes | [memory](docs/specs/memory.md) |
| `/api/documents/` | Uploads for RAG | [documents-rag](docs/specs/documents-rag.md) |
| `/api/media/` | TTS, pronunciation, dictation | [media-audio](docs/specs/media-audio.md) |
| `/api/discover/`, `/api/news/` | Explore feed, News | [discover-news](docs/specs/discover-news.md) |
| `/api/dictionary/` | Lookup, conjugator | [dictionary](docs/specs/dictionary.md) |
| `/api/exam-prep/` | TCF/TEF practice | [exam-prep](docs/specs/exam-prep.md) |
| `/api/grammar/` | Grammar Booster | [grammar-booster](docs/specs/grammar-booster.md) |
| `/api/notes/`, `/api/my-notes/` | Our Notes, My Notes | [notes](docs/specs/notes.md) |
| `/api/health/` | Liveness + DB probe (200 / 503) | [infrastructure](docs/specs/infrastructure.md) |

## Telegram Bot Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram.
2. Copy the bot token into your `.env` file as `TELEGRAM_BOT_TOKEN`.
3. The bot runs as a separate service in Docker Compose (the `bot` service).

**Available commands:**

| Command | Description |
|---------|-------------|
| `/start` | Register or link account |
| `/daily` | Today's SRS review summary |
| `/quiz [topic]` | Start a quick quiz |
| `/word` | Word of the day |
| `/grammar` | Random grammar tip |
| `/conjugate` | Conjugation drill |
| `/stats` | XP, streak, level |
| `/help` | List commands |

The bot shares the same Django codebase and database -- it calls Django models directly via `django.setup()`.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DJANGO_SECRET_KEY` | Django secret key for cryptographic signing | Yes |
| `DEBUG` | Enable debug mode (`True`/`False`) | No (default: `False`) |
| `ALLOWED_HOSTS` | Comma-separated list of allowed hostnames | Yes (prod) |
| `DB_NAME` | PostgreSQL database name | Yes |
| `DB_USER` | PostgreSQL user | Yes |
| `DB_PASSWORD` | PostgreSQL password | Yes |
| `DB_HOST` | PostgreSQL host | Yes |
| `DB_PORT` | PostgreSQL port | No (default: `5432`) |
| `REDIS_URL` | Redis connection URL | Yes |
| `CELERY_BROKER_URL` | Celery broker URL (Redis) | Yes |
| `CELERY_RESULT_BACKEND` | Celery result backend (Redis) | Yes |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed CORS origins | Yes |
| `TELEGRAM_BOT_TOKEN` | Telegram bot API token | No (bot won't start without it) |
| `GEMINI_API_KEY` | Google Gemini API key (primary LLM) | No (AI features disabled) |
| `GROQ_API_KEY` | Groq API key (fallback LLM) | No (fallback disabled) |
| `SENTRY_DSN` | Sentry DSN for backend + frontend error tracking | No (Sentry off if empty) |
| `SENTRY_ENVIRONMENT` | Sentry environment tag (e.g. `production`, `staging`) | No (default: `production`) |
| `SENTRY_TRACES_SAMPLE_RATE` | Performance trace sample rate (0.0 – 1.0) | No (default: `0.1`) |
| `SENTRY_RELEASE` | Release identifier (typically the git SHA, set in CI) | No |
| `LINGARU_MEMORY_ENABLED` | Enable chat-side memory layer: inject learner context + auto-detect remember intent. Defaults to off; set to `true`/`1` to enable. | No (default: off) |

**`LINGARU_MEMORY_ENABLED` is a kill switch only for the chat-side memory wiring.** The `/api/memory/notes/` REST endpoints and the Settings → Memory tab work regardless.

## Testing

```bash
# Run all backend tests
cd backend
pytest

# Run with coverage
pytest --cov=apps

# Run tests for a specific app
pytest apps/progress/
pytest apps/practice/

# Run a specific test
pytest apps/progress/tests/test_srs_service.py -v
```

Test settings use SQLite and are configured in `backend/config/settings/test.py`. The pytest configuration is in `backend/pytest.ini`.

## CI / Quality Gates

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Triggers | What it does |
|----------|----------|--------------|
| `ci.yml` | Push & PR (`main`, `dev`) | Ruff lint + format check, Django pytest with coverage, ESLint, frontend build, Trivy filesystem scan, Playwright e2e |
| `lighthouse.yml` | PR with frontend changes | Lighthouse CI against a built preview (perf / a11y / SEO / best-practices budgets in `frontend/lighthouserc.json`) |
| `visual-regression.yml` | PR with frontend changes | Playwright screenshot diff |
| `deploy.yml` | After successful CI on `main`, or manual dispatch | SSH to Hetzner, capture previous SHA, pull, build, migrate, smoke-test `/api/health/`, auto-rollback on failure |

Dependabot (`.github/dependabot.yml`) groups weekly PRs across pip, npm, GitHub Actions, and Docker.

## Internationalization

The app supports **EN / FR** for the UI chrome (nav, settings, buttons, toasts). French remains the *learning target* -- chrome-language and learning-language are independent.

- **Frontend:** `i18next` + `react-i18next` + browser language detector. Strings live in `frontend/src/locales/{en,fr}.json`.
- **Persistence:** the user's preference is stored in `localStorage` (`lingaru-ui-language`) and mirrored to `user.ui_language` on the server, so it follows them across devices.
- **Adding a language:** drop a new `{lang}.json` into `frontend/src/locales/`, add it to `SUPPORTED_LANGUAGES` in `frontend/src/i18n.js`.

## Observability

- **Backend:** `sentry-sdk[django,celery]` initialised in `config/settings/prod.py` when `SENTRY_DSN` is set. Performance traces sampled per `SENTRY_TRACES_SAMPLE_RATE`.
- **Frontend:** `@sentry/react` initialised in `frontend/src/sentry.js`. The deploy workflow stamps `SENTRY_RELEASE` with the git SHA so issues group across releases.
- **Health probe:** `GET /api/health/` returns 200 if Django can hit Postgres, 503 otherwise. The deploy job hits this after migrations and rolls back if it fails.

## Deployment

The app is designed for deployment on a Hetzner Linux server via Docker Compose.

```bash
# On the server
git pull origin main
docker compose up -d --build

# Migrations are not run at container start; apply them as a one-off
# before restarting (the deploy workflow does this):
docker compose run --rm django python manage.py migrate
```

**Production checklist:**

- Set `DEBUG=False` and configure `ALLOWED_HOSTS`
- Set a strong `DJANGO_SECRET_KEY`
- Configure HTTPS via Let's Encrypt / Certbot in front of Nginx
- Set up Gemini and/or Groq API keys for AI features
- Set up the Telegram bot token
- PostgreSQL data is persisted via Docker volume `postgres_data`
- Media files (audio, uploaded documents) are stored in the `media_files` volume

**Docker Compose services:**

| Service | Role |
|---------|------|
| `nginx` | Reverse proxy, serves React static files + media |
| `django` | API server via Gunicorn (3 workers) |
| `bot` | Telegram bot process |
| `celery` | Background task worker (LLM calls, TTS, etc.) |
| `celery-beat` | Scheduled tasks (daily content, streak checks) |
| `postgres` | PostgreSQL 16 database |
| `redis` | Cache + Celery broker |

## Documentation

Full docs live in [`docs/`](docs/README.md) and are mirrored to the [GitHub Wiki](https://github.com/armanhm/Lingaru/wiki):

- [Wiki Home](docs/wiki/Home.md): how every part works, with [Getting Started](docs/wiki/Getting-Started.md), [Architecture](docs/wiki/Architecture.md) and [Conventions](docs/wiki/Conventions.md)
- [Specs](docs/README.md#specs): the current contract for each domain (API, data model, rules)
- [Phase 0 Review and Roadmap](docs/review/2026-11-phase0-review.md): current priorities, linked to GitHub issues
- [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`SECURITY.md`](SECURITY.md)
- [`docs/superpowers/`](docs/superpowers/): historical design docs and per-phase plans

## License

[MIT](LICENSE) -- see the `LICENSE` file.
