# Lingaru — Architecture

A short tour of how the moving parts fit together. Pair this with the original system design in [`superpowers/specs/2026-04-04-lingaru-system-design.md`](superpowers/specs/2026-04-04-lingaru-system-design.md) and the per-phase plans under [`superpowers/plans/`](superpowers/plans/).

## High-Level Shape

```
                  ┌────────────────────────────────────────────┐
                  │             Nginx (port 80)                │
                  │  serves React static  │  /api/* → Django   │
                  └────────────┬───────────────────┬───────────┘
                               │                   │
              ┌────────────────▼─────┐    ┌────────▼─────────┐
              │  React 18 / Vite     │    │  Django 5.1 +    │
              │  Tailwind, i18next   │    │  DRF (Gunicorn)  │
              │  Sentry, Axios       │    │  Sentry, JWT     │
              └──────────────────────┘    └──────┬───────────┘
                                                 │
   ┌──────────┐   ┌──────────┐   ┌──────────┐    │
   │ Telegram │   │  Celery  │   │  Celery  │    │
   │   bot    │   │  worker  │   │   beat   │    │
   └────┬─────┘   └────┬─────┘   └────┬─────┘    │
        │              │              │           │
        └──────────────┴──────────────┴───────────┤
                                                 │
                          ┌──────────────────────┴──────────────────┐
                          │                                         │
                    ┌─────▼──────┐                            ┌─────▼─────┐
                    │ PostgreSQL │                            │   Redis   │
                    │     16     │                            │ broker +  │
                    └────────────┘                            │   cache   │
                                                              └───────────┘
                                                                    │
                                                                    │
                                            ┌───────────────────────┴────────┐
                                            │   External LLMs                │
                                            │   Gemini (primary, vision)     │
                                            │   Groq   (text fallback)       │
                                            └────────────────────────────────┘
```

All Django-derived services (`django`, `celery`, `celery-beat`, `bot`) are built from the same image and the same code — only the entrypoint command differs. This means a migration deployed for the API is *automatically* available to the bot and to background workers.

## Backend Layout

```
backend/
├── apps/                    # Django apps, each is a bounded domain
│   ├── users/               # auth, registration, profile, ui_language
│   ├── content/             # topics, lessons, vocab, grammar (legacy)
│   ├── practice/            # quiz sessions, question delivery, scoring
│   ├── progress/            # SRS (SM-2), mistake journal, conjugation drills
│   ├── gamification/        # XP, streaks, badges, leaderboard
│   ├── assistant/           # AI chat, image queries, voice chat, conversations
│   ├── media/               # TTS, pronunciation, dictation
│   ├── discover/            # Explore feed cards, dedicated News API
│   ├── documents/           # PDF upload + RAG index
│   ├── dictionary/          # word lookups + verb conjugator (cached)
│   ├── exam_prep/           # TCF/TEF drills, mocks, history
│   ├── grammar/             # Grammar Booster (SM-2 mastery)
│   ├── agents/              # specialised assistants (admin-editable)
│   └── bot/                 # Telegram handlers (shares the same models)
├── config/
│   ├── settings/
│   │   ├── base.py          # shared
│   │   ├── dev.py           # DEBUG=True, PostgreSQL in Docker
│   │   ├── local.py         # DEBUG=True, SQLite (no Docker needed)
│   │   ├── test.py          # SQLite + faster password hasher
│   │   └── prod.py          # DEBUG=False, Sentry, security headers
│   ├── urls.py              # API root (mirrored in README)
│   ├── wsgi.py
│   └── celery.py
└── services/                # cross-app service layer
    ├── llm/                 # Gemini + Groq providers, ProviderRouter
    ├── tts/                 # gTTS
    ├── stt/                 # speech-to-text
    └── rag/                 # PDF chunking + retrieval
```

### Why a `services/` layer?

The LLM router, TTS, STT, and RAG aren't tied to any one app. The `assistant`, `media`, `documents`, `discover`, and `grammar` apps all call into them. Keeping them at the project root avoids circular imports between apps and makes the dependency direction one-way: **apps depend on services, services don't depend on apps**.

### LLM Provider Routing

`services/llm/router.py` defines a `ProviderRouter` with a primary + optional fallback:

- **Text generation:** Gemini → Groq fallback on exception. Logged at WARNING.
- **Image + text (vision):** Gemini only. No fallback (Groq doesn't do vision). Raises directly.

Each provider implements `BaseProvider` (`generate`, `generate_with_image`) and is instantiated by `services/llm/factory.py` based on env vars.

If neither key is set, most LLM-backed endpoints return a curated offline mock so the app stays usable for development.

## Frontend Layout

```
frontend/src/
├── api/             # Axios client with JWT interceptor + refresh
├── components/      # Reusable UI primitives + composite widgets
├── contexts/        # AuthContext, theme/locale wiring
├── hooks/           # useAuth, useToast, etc.
├── i18n.js          # i18next bootstrap (EN/FR)
├── locales/         # en.json, fr.json — UI chrome strings
├── lib/             # framework-agnostic helpers
├── pages/           # one file per route
├── sentry.js        # Sentry init (no-op if VITE_SENTRY_DSN is empty)
├── utils/           # tiny pure helpers
├── App.jsx          # router + global layout
└── main.jsx         # entry
```

Routes are 1:1 with files in `pages/`. New surface? Add a page, register the route in `App.jsx`, add its label to both `locales/*.json`.

## Cross-Cutting Conventions

- **Auth:** JWT (Simple JWT). The Axios client refreshes on 401. The Telegram bot identifies users by their `telegram_chat_id` field on the `User` model, set on `/start`.
- **Time zones:** all timestamps are stored UTC; the frontend formats locally. Don't store local-time strings.
- **i18n:** Only the UI chrome is translated. The *learning content* (vocab, lessons, grammar explanations) stays in French — that's the point of the app. UI chrome strings go in `locales/{en,fr}.json` and are looked up via `useTranslation()`.
- **SM-2 / SRS:** the SRS scheduler in `apps/progress/services/srs.py` is the canonical implementation; the Grammar Booster's mastery scheduler shares the same algorithm. Don't fork it.
- **Em-dashes:** the codebase has been purged of `—` in user-facing strings and commit messages. Use ` -- ` or `:` instead.
- **Comments:** none unless the *why* is non-obvious. Identifiers should carry intent.

## Request Lifecycle (Typical Chat Turn)

1. User types in `Assistant.jsx`, hits Enter.
2. Frontend POSTs `/api/assistant/chat/` with `{ conversation_id?, message }`.
3. Django middleware verifies JWT → loads `request.user`.
4. `ChatView` resolves the active agent (if `@-mentioned`), pulls its system prompt, assembles the message history from the `Conversation` model.
5. View calls `services.llm.router.ProviderRouter.generate(...)`.
6. Router tries Gemini; on exception, falls back to Groq.
7. Response is parsed for `action` / `feature_widget` blocks (agentic mode) and persisted on the `Message` row.
8. Frontend receives the JSON, mutates the in-place message bubble (so widgets render where the text would have).

## Background Work

`apps/*/tasks.py` modules register Celery tasks. The `celery-beat` service schedules:

- Daily Discover content (words, grammar tips, trivia) at a configured hour.
- Streak rollover checks at midnight UTC.
- Periodic warm-up of LLM-cached entries (dictionary, conjugations) where worthwhile.

Synchronous user-triggered LLM calls go inline in the request — they're already async-friendly (the client is non-blocking from the user's perspective because the page shows a spinner) and going through Celery would add a polling round-trip.

Anything that's slow *and* can be deferred (TTS generation for a whole vocab list, RAG indexing a fresh PDF) goes through Celery.

## CI / Deploy

`.github/workflows/ci.yml` runs on every push and PR. `deploy.yml` triggers on a successful CI run against `main` and:

1. SSH to the Hetzner host.
2. Capture the currently deployed SHA.
3. `git pull`, rebuild, run migrations.
4. Smoke-test `/api/health/`.
5. If the smoke test fails, reset the working tree to the captured SHA and redeploy.

Lighthouse and visual-regression workflows gate PRs that touch the frontend.

## Where to Add Things

| You want to... | Touch... |
|----------------|----------|
| Add a new REST endpoint | Pick the right app under `apps/`, add a view + URL, document it in `README.md#api-endpoints`. |
| Add a new specialised assistant | `/admin/agents/agent/` — no code change needed. Edit `apps/agents/management/commands/` if you want it seeded. |
| Add a new locale | Drop a file in `frontend/src/locales/`, add it to `SUPPORTED_LANGUAGES` in `frontend/src/i18n.js`. |
| Add a new LLM provider | Implement `BaseProvider` in `services/llm/`, wire it through `factory.py`. |
| Add a new frontend route | One file in `frontend/src/pages/`, register in `App.jsx`. |
| Add a new background job | Define a `@shared_task` in the right app's `tasks.py`. Schedule it in `config/celery.py` if periodic. |
