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

# Run migrations (handled automatically on startup, but can also run manually)
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

Create `backend/config/settings/local.py` if it doesn't exist -- it should import from `dev.py` and override the database to use SQLite:

```python
from .dev import *

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}
```

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

> **v2.0.0 note:** all content-listing endpoints filter by the authenticated user's `target_language`. Detail / slug endpoints return 404 on cross-language access; list endpoints return 200 with an empty payload.

### Users (`/api/users/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/register/` | Create account |
| POST | `/api/users/login/` | Obtain JWT token |
| POST | `/api/users/token/refresh/` | Refresh JWT token |
| GET | `/api/users/me/` | Current user profile |
| POST | `/api/users/change-password/` | Change password |

### Content (`/api/content/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/content/topics/` | List all topics |
| GET | `/api/content/topics/{id}/` | Topic detail with lessons |
| GET | `/api/content/lessons/{id}/` | Full lesson (vocab, grammar, questions) |

### Practice (`/api/practice/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/practice/quiz/start/` | Start quiz session |
| POST | `/api/practice/quiz/{session_id}/answer/` | Submit answer |
| POST | `/api/practice/quiz/{session_id}/complete/` | Complete quiz |
| GET | `/api/practice/quiz/history/` | Quiz attempt history |

### Progress (`/api/progress/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/progress/srs/due/` | SRS cards due for review |
| POST | `/api/progress/srs/review/` | Submit SRS review result |
| GET | `/api/progress/mistakes/` | Mistake journal entries |
| POST | `/api/progress/mistakes/reviewed/` | Mark mistakes as reviewed |
| POST | `/api/progress/conjugation/check/` | Check conjugation answers |
| GET | `/api/progress/conjugation/verbs/` | List verbs for drills |

### Gamification (`/api/gamification/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gamification/stats/` | XP, level, streak |
| GET | `/api/gamification/badges/` | Earned and available badges |
| GET | `/api/gamification/leaderboard/` | User rankings |
| GET | `/api/gamification/history/` | XP transaction history |

### Assistant (`/api/assistant/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/assistant/chat/` | Send message, get AI response |
| POST | `/api/assistant/image-query/` | Upload image for AI analysis |
| POST | `/api/assistant/voice-chat/` | Voice-based AI conversation |
| GET | `/api/assistant/conversations/` | Conversation list |
| GET | `/api/assistant/conversations/{id}/` | Conversation detail |

### Media (`/api/media/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/media/tts/` | Generate audio for text |
| POST | `/api/media/pronunciation/check/` | Check pronunciation accuracy |
| POST | `/api/media/dictation/start/` | Start dictation exercise |
| POST | `/api/media/dictation/check/` | Check dictation transcription |

### Discover (`/api/discover/`)

The Discover feed surfaces short word, grammar, and trivia cards. **News has its own dedicated `/api/news/` namespace** (see below).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/discover/feed/` | Explore feed cards (excludes news) |
| POST | `/api/discover/generate-more/` | Generate fresh word + grammar + trivia cards |
| POST | `/api/discover/cards/{id}/interact/` | Mark card as seen, award XP |

### News (`/api/news/`)

A dedicated practice surface -- French news articles with vocabulary, expressions, and grammar points pulled out for guided study. Falls back to a curated 9-topic offline mock library when the LLM is unavailable.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/news/?topic={slug}` | Paginated list (filter by topic: `politics`, `sports`, `culture`, `economy`, `science`, `tech`, `society`, `environ`, `world`) |
| GET | `/api/news/{id}/` | Full article + `vocabulary[]`, `expressions[]`, `grammar_points[]` |
| POST | `/api/news/generate/` | Generate a new article (optional `{ "topic": "…" }`) |
| POST | `/api/news/{id}/interact/` | Mark as read, award XP |

### Grammar Booster (`/api/grammar/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/grammar/hub/` | Categories + mastery aggregates + recommended-next topic |
| GET | `/api/grammar/categories/` | List all 6 grammar categories |
| GET | `/api/grammar/topics/` | List topics, filterable by category and CEFR level |
| GET | `/api/grammar/topics/{slug}/` | Topic detail (markdown explanation, formula, examples, exceptions, common mistakes) |
| POST | `/api/grammar/sessions/start/` | Start a drill session (`{ topic_id?, mode: "drill"\|"diagnostic" }`) |
| POST | `/api/grammar/sessions/{id}/answer/` | Submit a drill answer |
| POST | `/api/grammar/sessions/{id}/complete/` | Finish session, update SM-2 mastery, award XP |

### Exam Prep (`/api/exam-prep/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/exam-prep/hub/` | Countdown, readiness gauge, week plan, weak topics |
| GET | `/api/exam-prep/exercises/` | List exercises (filter by exam, section, level) |
| POST | `/api/exam-prep/sessions/start/` | Start a section drill or full mock |
| POST | `/api/exam-prep/sessions/{id}/respond/` | Submit an answer |
| POST | `/api/exam-prep/sessions/{id}/complete/` | Finish, score, persist to history |
| GET | `/api/exam-prep/sessions/history/` | Past mocks and section drills |

### Dictionary (`/api/dictionary/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/dictionary/lookup/` | Look up a French word -- POS, gender, definitions, examples, synonyms, antonyms, etymology |
| POST | `/api/dictionary/conjugate/` | Conjugate a verb across 8 tenses |

### Documents (`/api/documents/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/upload/` | Upload PDF for RAG indexing |
| GET | `/api/documents/` | List uploaded documents |
| DELETE | `/api/documents/{id}/` | Delete a document |
| GET | `/api/documents/{id}/chunks/` | View document chunks |

### Agents (`/api/agents/`)

Specialised assistants, each with their own system prompt, suggested questions, and capabilities. Agents are admin-editable (via Django admin) so the gallery can be tuned without redeploying. The chat composer `@-mention` popover and the `/agents` gallery share the same source of truth.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents/` | Gallery payload (lean -- no system prompt) |
| GET | `/api/agents/{slug}/` | Full agent detail for the run page |
| POST | `/api/agents/{slug}/start/` | Create a fresh conversation pinned to this agent |
| GET | `/api/agents/{slug}/runs/` | User's recent conversations with this agent (last 20) |

### Memory (`/api/memory/`)

User-curated notes the assistant remembers across conversations. Notes are scoped to the authenticated user; the assistant cannot edit or delete them, only the user can. Phase A: CRUD only. Phase B will wire these into the chat system prompt and add auto-detection.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/memory/notes/` | List active notes. Add `?include_inactive=true` to also include soft-deleted ones. |
| POST | `/api/memory/notes/` | Create a note (`{content, category?}`). `category` defaults to `"other"`. |
| PATCH | `/api/memory/notes/{id}/` | Edit content, category, or `is_active`. |
| DELETE | `/api/memory/notes/{id}/` | Soft-delete (sets `is_active=False`). Idempotent. |

Categories: `goal`, `preference`, `background`, `weakness`, `other`.

### Health (`/api/health/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health/` | Liveness + readiness probe (returns 200 if Django can reach the DB, 503 otherwise). Used by the deploy smoke test. |

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

# Migrations run automatically on startup via the django service command.
# To run manually:
docker compose exec django python manage.py migrate
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

Deeper docs live in [`docs/`](docs/):

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) -- system overview, request lifecycle, key conventions
- [`docs/superpowers/specs/2026-04-04-lingaru-system-design.md`](docs/superpowers/specs/2026-04-04-lingaru-system-design.md) -- full original system design
- [`docs/superpowers/plans/`](docs/superpowers/plans/) -- per-phase implementation plans (phases 1 through 17 are written up; 18 through 21 are documented inline in the features table and commit history)
- [`CONTRIBUTING.md`](CONTRIBUTING.md) -- dev workflow, commit conventions, how to run tests/lint locally
- [`SECURITY.md`](SECURITY.md) -- vulnerability disclosure policy

## License

[MIT](LICENSE) -- see the `LICENSE` file.
