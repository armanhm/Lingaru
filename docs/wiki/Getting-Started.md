# Getting Started

> Run Lingaru on your machine in about 10 minutes, either fully in Docker or with a SQLite backend plus the Vite dev server.

**Related:** [Configuration and Settings](Configuration-and-Settings.md) · [Content Data Pipeline](Content-Data-Pipeline.md) · [Testing and CI](Testing-and-CI.md)

## Prerequisites

| Tool | Version | Needed for |
|------|---------|------------|
| Docker + Compose v2 | recent | Option A |
| Python | 3.12 | Option B, running tests |
| Node.js | 20+ | Frontend dev server, lint, build |
| A Gemini and/or Groq API key | free tier is fine | AI features (optional) |

## Option A: everything in Docker (closest to production)

```bash
cp .env.example .env            # then edit: set DJANGO_SECRET_KEY, optionally GEMINI_API_KEY / GROQ_API_KEY
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
docker compose exec django python manage.py createsuperuser
```

The dev override (`docker-compose.dev.yml`) runs Django with `runserver` and hot reload, mounts `./backend` and `./data`, and exposes:

| URL | What |
|-----|------|
| http://localhost | Nginx: built React app + `/api` + `/admin` |
| http://localhost:8000 | Django directly |
| localhost:5433 | PostgreSQL (mapped from 5432) |
| localhost:6379 | Redis |

Migrations run automatically when the `django` container starts.

## Option B: SQLite backend + Vite (fastest iteration)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DJANGO_SETTINGS_MODULE=config.settings.local   # SQLite, DEBUG, eager Celery, locmem cache
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# Frontend (second terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api to :8000
```

`config/settings/local.py` already exists in the repo. Celery tasks run inline (`CELERY_TASK_ALWAYS_EAGER`), so you do not need Redis or a worker.

## Load content

A fresh database is empty. Seed it in the order described in [Content Data Pipeline](Content-Data-Pipeline.md). The JSON/CSV banks live in `data/`.

## Accounts

- Sign-ups through the web UI are created **inactive** and must be approved in Django admin (`/admin/users/user/`, action "Approve selected accounts"). Your superuser is active immediately.
- Each user picks a **target language** (`fr` or `en`); all content lists are filtered by it. See [Users and Auth](Users-and-Auth.md).

## AI features

Without `GEMINI_API_KEY` / `GROQ_API_KEY`, LLM-backed features (assistant, dictionary misses, exam grading, news generation) fail or fall back to canned content. See [LLM Providers and Prompts](LLM-Providers-and-Prompts.md).

## Telegram bot (optional)

Set `TELEGRAM_BOT_TOKEN` and start the `bot` service (`docker compose up -d bot`) or run `python manage.py run_bot` locally. See [Telegram Bot](Telegram-Bot.md).

## Run the checks CI runs

```bash
cd backend && ruff check . && ruff format --check . && pytest
cd frontend && npm run lint && npm run build
```

Details and gotchas (for example, keep real API keys out of your shell when running tests): [Testing and CI](Testing-and-CI.md).

## Next steps

- Read [Architecture](Architecture.md) for the big picture.
- Read [Conventions](Conventions.md) before your first PR.
