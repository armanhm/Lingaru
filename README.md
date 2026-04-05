# Lingaru

A comprehensive French language learning application targeting B1 to B2 progression. Lingaru combines structured lessons, interactive practice, AI-powered assistance, and a Telegram bot -- all backed by a Django monolith with a React frontend.

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
| 8 - Discover | Explore feed, news fetcher, daily content cards |
| 9 - Advanced Practice | Conjugation drills, cloze exercises, mistake journal, SRS (SM-2) |
| 10 - Multimodal | Image queries (Gemini vision), voice conversation practice |
| 11 - RAG | Document upload, PDF indexing, context-aware AI answers |

## Tech Stack

**Backend:** Django 5.1, Django REST Framework, Simple JWT, Celery + Redis, PostgreSQL, Gunicorn

**Frontend:** React 18, Vite 5, React Router 6, Axios, Tailwind CSS 3

**AI/ML:** Google Gemini (primary), Groq (fallback), gTTS, PyPDF2

**Infrastructure:** Docker Compose, Nginx, Redis, PostgreSQL 16

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
│   │   ├── content/        # Topics, lessons, vocabulary, grammar
│   │   ├── practice/       # Quiz engine, sessions, answers
│   │   ├── progress/       # SRS cards, mistake journal, conjugation drills
│   │   ├── gamification/   # XP, streaks, badges, leaderboard
│   │   ├── assistant/      # AI chat, image queries, voice chat
│   │   ├── media/          # TTS, pronunciation, dictation
│   │   ├── discover/       # Explore feed, daily cards
│   │   ├── documents/      # PDF upload, RAG indexing
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

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/discover/feed/` | Explore feed cards |
| POST | `/api/discover/generate-more/` | Generate fresh cards |
| POST | `/api/discover/cards/{id}/interact/` | Record card interaction |

### Documents (`/api/documents/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/upload/` | Upload PDF for RAG indexing |
| GET | `/api/documents/` | List uploaded documents |
| DELETE | `/api/documents/{id}/` | Delete a document |
| GET | `/api/documents/{id}/chunks/` | View document chunks |

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
