# Lingaru — System Design Specification

**Date:** 2026-04-04
**Status:** Approved
**Author:** Arman + Claude

## Overview

Lingaru is a French language learning application targeting B1→B2 progression. It provides structured lessons, interactive practice, AI-powered assistance, and a Telegram bot — all backed by a single Django monolith with a shared PostgreSQL database.

## Goals

- Practice French through vocabulary, grammar, reading, quizzes, and AI conversation
- Support both a React web UI and a Telegram bot as equal-citizen interfaces
- Use free-tier LLM APIs (Google Gemini primary, Groq fallback)
- Deploy on a Hetzner Linux server via Docker Compose
- Modular design — features added incrementally over time

## Architecture

### Approach: Monolith with Shared API

```
[React + Vite SPA] ──► [Django + DRF API] ◄── [Telegram Bot]
                              │
                    ┌─────────┴─────────┐
                [PostgreSQL]       [LLM Service]
                                   (Gemini/Groq)
```

- Single Django project serves the REST API
- React frontend and Telegram bot are both API clients
- Telegram bot runs as a separate process but imports Django models directly via `django.setup()`
- LLM integration as a Django service layer
- All services managed by Docker Compose

### Docker Compose Stack

| Service | Role |
|---|---|
| **nginx** | Reverse proxy, serves React static files + media |
| **django** | API server via Gunicorn (2-4 workers) |
| **bot** | Telegram bot process (same codebase, different entrypoint) |
| **celery** | Background tasks (LLM calls, news fetch, TTS generation) |
| **celery-beat** | Scheduled tasks (daily news, word of the day, streak checks) |
| **postgres** | Database |
| **redis** | Cache + Celery broker |

## Data Model

### Content Hierarchy

Topic → Lesson → (Vocabulary | GrammarRule | ReadingText | Question)

### Core Entities

#### User & Auth

**User**
- id, username, email, password_hash
- telegram_id (nullable) — links Telegram account
- native_language, target_level (B1→B2)
- daily_goal_minutes, created_at

#### Content

**Topic**
- id, name (FR + EN), description, icon, order, difficulty_level

**Lesson**
- id, topic_id (FK→Topic), type (vocab|grammar|text), title, content (JSON), order, difficulty

**Vocabulary**
- id, lesson_id (FK→Lesson), french, english, pronunciation (IPA), example_sentence, gender (m/f/n/a), part_of_speech, audio_url (nullable)

**GrammarRule**
- id, lesson_id (FK→Lesson), title, explanation (markdown), formula, examples (JSON array), exceptions (JSON array)

**ReadingText**
- id, lesson_id (FK→Lesson), title, content_fr, content_en, vocabulary_highlights (JSON), comprehension_questions

#### Practice

**Question**
- id, lesson_id (FK→Lesson), type (mcq|fill_blank|translate|match|listen|cloze|conjugation), prompt, correct_answer, wrong_answers (JSON), explanation, difficulty

**QuizAttempt**
- id, user_id, lesson_id, score, total_questions, time_taken_seconds, completed_at

**PronunciationAttempt**
- id, user_id, vocabulary_id, audio_file_url, transcription, accuracy_score, feedback

#### Progress & SRS

**UserProgress**
- id, user_id, topic_id, lesson_id, score, completed, last_practiced_at, streak_count

**SRSCard** (SM-2 algorithm)
- id, user_id, vocabulary_id, ease_factor, interval_days, next_review_at, repetitions, last_quality

**MistakeEntry**
- id, user_id, question_id, user_answer, correct_answer, mistake_type (gender|conjugation|preposition|spelling|other), created_at, reviewed (bool)

#### Gamification

**XPTransaction**
- id, user_id, activity_type, xp_amount, source_id, created_at

**UserStats**
- user_id (OneToOne→User), total_xp, level, current_streak, longest_streak, streak_freeze_available, last_active_date

**Badge**
- id, name, description, icon, criteria_type, criteria_value

**UserBadge**
- user_id, badge_id, earned_at

**XP Values:**

| Activity | XP |
|---|---|
| Complete vocabulary lesson | 10 |
| Complete grammar lesson | 15 |
| Complete reading text | 20 |
| Quiz — per correct answer | 5 |
| Quiz — perfect score bonus | 25 |
| Dictation exercise | 15 |
| Conjugation drill (per set) | 10 |
| Writing practice submitted | 20 |
| AI conversation (5+ exchanges) | 15 |
| Pronunciation attempt | 5 |
| SRS review session | 10 |
| Daily streak maintained | 5 x streak_days (capped at 50) |
| Word of the Day reviewed | 3 |

#### AI & Conversations

**Conversation**
- id, user_id, title, context (topic/lesson ref), created_at

**Message**
- id, conversation_id (FK), role (user|assistant), content, provider (gemini|groq), tokens_used, created_at

**ImageQuery**
- id, user_id, conversation_id, image_file_url, extracted_text, ai_response

#### Media

**AudioClip**
- id, vocabulary_id (nullable), text_content, audio_file_url, provider, language

#### Discover / Explore

**DiscoverCard**
- id, type (news|word|grammar|topic|trivia), title, summary, content_json, source_url (nullable), image_url (nullable), generated_at, expires_at

**UserDiscoverHistory**
- id, user_id, card_id, seen_at, interacted (bool)

## Django Apps Structure

```
lingaru/
├── config/              # Django project settings
│   ├── settings/
│   │   ├── base.py
│   │   ├── dev.py
│   │   └── prod.py
│   ├── urls.py
│   └── celery.py
├── apps/
│   ├── users/           # Auth, profiles, Telegram linking
│   ├── content/         # Topics, Lessons, Vocabulary, Grammar, ReadingTexts
│   ├── practice/        # Questions, Quizzes, Conjugation, Dictation, Writing, Cloze
│   ├── progress/        # UserProgress, SRS cards, QuizAttempts, MistakeJournal
│   ├── gamification/    # XP, Levels, Streaks, Badges
│   ├── assistant/       # AI conversations, LLM service, image queries
│   ├── media/           # Audio clips, TTS/STT, pronunciation attempts
│   ├── discover/        # Explore feed, news, daily cards
│   └── bot/             # Telegram bot handlers, commands
├── services/            # Shared service layer
│   ├── llm/             # Gemini + Groq clients, fallback logic
│   ├── tts/             # Text-to-speech service
│   ├── stt/             # Speech-to-text service
│   └── news/            # RSS fetcher, content simplifier
├── manage.py
└── requirements.txt
```

## API Design

### Auth
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — obtain JWT token
- `POST /api/auth/telegram-link` — link Telegram account

### Content
- `GET /api/topics/` — list all topics
- `GET /api/topics/{id}/lessons/` — lessons for a topic
- `GET /api/lessons/{id}/` — full lesson (vocab + grammar + text + questions)

### Practice
- `POST /api/practice/quiz/start` — start a quiz for a lesson
- `POST /api/practice/quiz/submit` — submit quiz answers
- `POST /api/practice/dictation/check` — check dictation transcription
- `POST /api/practice/writing/submit` — submit writing for AI correction
- `POST /api/practice/conjugation/check` — check conjugation answers
- `POST /api/practice/cloze/check` — check cloze exercise

### Progress
- `GET /api/progress/dashboard` — overview stats
- `GET /api/progress/srs/due` — cards due for review
- `POST /api/progress/srs/review` — submit SRS review result
- `GET /api/progress/mistakes/` — mistake journal

### Gamification
- `GET /api/stats/` — XP, level, streak
- `GET /api/badges/` — earned and available badges
- `GET /api/leaderboard/` — user rankings

### Assistant
- `POST /api/assistant/chat` — send message, get AI response
- `POST /api/assistant/image-query` — upload image, get AI analysis
- `GET /api/assistant/conversations/` — conversation history

### Media
- `POST /api/media/tts` — generate audio for text
- `POST /api/media/stt` — transcribe audio
- `POST /api/media/pronunciation/check` — check pronunciation accuracy

### Discover
- `GET /api/discover/feed` — explore feed cards
- `POST /api/discover/generate-more` — generate fresh cards
- `GET /api/discover/news/{id}` — full news article with exercises

## Telegram Bot

### Commands
```
/start          — register / link account
/daily          — today's SRS review cards
/quiz [topic]   — start a quick quiz
/word           — word of the day
/grammar        — random grammar tip
/news           — news of the day
/dictation      — start a dictation exercise
/conjugate      — conjugation drill
/write [text]   — submit writing for AI correction
/chat           — start AI conversation
/stats          — your XP, streak, level
/help           — list commands
```

### Inline Interactions
- Voice messages → pronunciation practice (STT → compare)
- Photos → image queries (Gemini vision)
- Reply-based quiz answering

## LLM Service Layer

```
LLMService
├── GeminiProvider (primary)
│   ├── text generation (chat, corrections, explanations)
│   ├── vision (image understanding)
│   └── rate limit tracking
├── GroqProvider (fallback)
│   ├── text generation
│   ├── Whisper STT
│   └── rate limit tracking
├── TTSService
│   └── gTTS or Google Cloud TTS
└── ProviderRouter
    ├── try primary → fallback on rate limit / error
    └── log provider usage + token counts
```

### System Prompts (pre-configured per use case)
- **Conversation partner** — patient French tutor, responds at B1-B2 level
- **Grammar corrector** — corrects French text, explains each error
- **News simplifier** — rewrites news articles at B1-B2 level
- **Quiz generator** — generates questions from lesson content

## Frontend (React + Vite)

### Pages
```
/                       — Dashboard (streak, XP, due reviews, quick actions)
/topics                 — Topic grid
/topics/:id             — Lesson list for topic
/lesson/:id             — Lesson view (vocab cards, grammar, reading)
/practice/quiz/:id      — Quiz interface (Duolingo-style)
/practice/dictation     — Dictation exercise
/practice/writing       — Writing practice + AI correction
/practice/conjugation   — Conjugation drills
/practice/conversation  — AI chat interface
/discover               — Explore feed (news, tips, random content)
/discover/news/:id      — Full news article with exercises
/progress               — Stats, streaks, badges, mistake journal
/settings               — Profile, Telegram linking, daily goal
```

### Tech Stack
- React 18+ with Vite
- React Router for routing
- Axios for API calls
- Tailwind CSS for styling
- JWT auth stored in httpOnly cookies or localStorage

## Deployment

### Hetzner Server
- Docker Compose manages all services
- Nginx serves React static build + proxies /api/ to Django
- PostgreSQL data persisted via Docker volumes
- Media files (audio, images) stored locally or in object storage later
- HTTPS via Let's Encrypt / Certbot

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection
- `DJANGO_SECRET_KEY`
- `TELEGRAM_BOT_TOKEN`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `GOOGLE_TTS_API_KEY` (if using Cloud TTS)

## Implementation Phases

| Phase | Features |
|---|---|
| **1 - Foundation** | Django project, User model, Auth (JWT), PostgreSQL, Docker Compose, basic React shell with routing |
| **2 - Content** | Topics, Lessons, Vocabulary, Grammar, Reading texts, Django Admin for content management |
| **3 - Practice** | Quiz engine (MCQ, fill-blank, translate), Duolingo-style UI |
| **4 - Telegram Bot** | Core bot setup, /start, /quiz, /word, /stats |
| **5 - AI Assistant** | Gemini/Groq integration, chat, writing correction, grammar explanation |
| **6 - Gamification** | XP, streaks, badges, leaderboard |
| **7 - Audio** | TTS for vocab, STT for pronunciation, dictation |
| **8 - Discover** | Explore feed (word / grammar / trivia cards) |
| **9 - Advanced Practice** | Conjugation drills, cloze exercises, mistake journal, SRS |
| **10 - Multimodal** | Image queries, voice conversation practice |
| **11 - RAG** | Textbook document indexing, context-aware answers |
| **12 - Dictionary** | French dictionary lookups + verb conjugator (cached LLM-generated entries) |
| **13 - Mini Games** | 6 games — Word Scramble, Match Pairs, Gender Snap, Missing Letter, Speed Round, Listening Challenge |
| **14 - Exam Prep** | TCF / TEF prep — diagnostic, week plan, section drills, mocks history |
| **15 - Grammar Booster** | Dedicated grammar app — 6 categories, 11 topics, 90 drill items, SM-2 mastery scoring |
| **16 - News** | Standalone /news surface — articles by topic with vocab, expressions, grammar tabs |
| **17 - UI Overhaul** | Premium token system, Hybride dashboard, redesigned Assistant, gradient top-band cards across all pages |

Each phase is self-contained and deployable. Features can be reordered based on priorities.

---

## Addendum (April 2026) — Phases 12–17

This addendum captures the apps and surfaces added after the original 11-phase plan landed. Models live alongside existing Django apps (`apps.dictionary`, `apps.exam_prep`, `apps.grammar`); UI sits on the same React + Vite + Tailwind base as the rest of the app.

### Phase 12 — Dictionary (`apps.dictionary`)

LLM-backed lookup with a caching layer so repeat lookups stay free.

- `POST /api/dictionary/lookup/` — body `{ "word": "..." }` → `{ result: { word, part_of_speech, gender, register, definitions[], examples[], synonyms[], antonyms[], etymology } }`
- `POST /api/dictionary/conjugate/` — body `{ "verb": "..." }` → `{ result: { verb, auxiliary, past_participle, present_participle, tenses: { Présent, Imparfait, Passé composé, Futur simple, Conditionnel présent, Subjonctif présent, Impératif, Plus-que-parfait } } }`
- LLM responses cached in `DictionaryEntry` and `ConjugationCache` models keyed by lemma.

### Phase 13 — Mini Games (frontend-only)

Six gameplay loops, each with its own settings (count / timer / preview duration) on the Settings page:

| Game | Mechanic |
|---|---|
| Word Scramble | Drag-letters or type to unscramble; comma-separated synonyms accepted; 350 ms feedback delay |
| Match Pairs | French ↔ English memory grid with preview window; matched pairs stay revealed; topic-coordinated colours (FR=info, EN=purple, matched=success) |
| Gender Snap | Le / La timed tap challenge with feminine = pink, masculine = info |
| Missing Letter | Fill in the missing letter, accent-insensitive comparison |
| Speed Round | True / False rapid-fire with overall countdown |
| Listening Challenge | TTS-driven listen-and-type with hints |

Mini-game scores post to `/api/gamification/mini-game/score/`.

### Phase 14 — Exam Prep (`apps.exam_prep`)

End-to-end TCF / TEF practice. Same hub-list-detail-session pattern as Grammar Booster.

**Models** — `ExamSection`, `ExamExercise`, `ExamSession`, `ExamResponse`. Sessions carry mode (`section_drill | mock`), exam (`tcf | tef`), and level. Responses store user answer + AI-graded score where applicable (writing / speaking).

**Endpoints** (`/api/exam-prep/`):
- `GET hub/` — countdown, readiness gauge, week plan, weak topics
- `GET exercises/` — filter by exam/section/level
- `POST sessions/start/` — `{ exam, section?, mode }`
- `POST sessions/{id}/respond/` — submit answer
- `POST sessions/{id}/complete/` — score + persist
- `GET sessions/history/` — past mocks

### Phase 15 — Grammar Booster (`apps.grammar`)

Distinct from `apps.content.GrammarRule` (which is theme-attached). This app is **structural** practice (tenses, pronouns, articles, negation, moods, sentence structure).

**Models**

- `GrammarCategory` — slug, icon, order (6 seeded: tenses, pronouns, articles, negation, moods, structure)
- `GrammarTopic` — category FK, slug, cefr_level, summary, explanation (markdown), formula, examples (JSON), exceptions (JSON), common_mistakes (JSON)
- `GrammarDrillItem` — topic FK, type (`fill_blank | mcq | transform | error_detect | reorder`), prompt, correct_answer, options (JSON), explanation, difficulty
- `GrammarMastery` — user, topic, attempts, correct_count, mastery_score 0–100, last_drilled_at, next_review_at, interval_days, ease_factor (default 2.5) — SM-2 with `CORRECT_GAIN=5`, `WRONG_PENALTY=3`, `MASTERED_THRESHOLD=80`, `MASTERED_MIN_ATTEMPTS=10`
- `GrammarSession`, `GrammarAnswer` — practice telemetry

**XP** — `XP_PER_CORRECT_DRILL=3`, `XP_DRILL_PERFECT_BONUS=10`.

**Endpoints** (`/api/grammar/`):
- `GET hub/` — categories + mastery aggregates + recommended next topic (priority: due-for-review → weakest non-mastered → first not-started)
- `GET categories/`, `GET topics/`, `GET topics/{slug}/`
- `POST sessions/start/` — `{ topicId?, mode: "drill" | "diagnostic" }` — diagnostic picks one drill per topic at user's CEFR level
- `POST sessions/{id}/answer/` — records answer (no server-side grading; client validates against `correct_answer` returned in serializer with 350 ms feedback delay)
- `POST sessions/{id}/complete/` — calls `update_mastery`, awards XP, calls `check_streak`

Seeded with 90 real drill items (passé composé avoir/être, imparfait, futur simple, direct/indirect object pronouns, definite/partitive articles, ne…pas, subjunctive present, forming questions).

### Phase 16 — News (`apps.discover`, alternate URL namespace)

Reuses `DiscoverCard` with two new optional fields on the model:

- `topic` — choices: `politics, sports, culture, economy, science, tech, society, environ, world, misc`
- `level` — CEFR `A1 | A2 | B1 | B2 | C1 | C2`

Discover feed now `.exclude(type="news")` so each surface has a clear purpose. News cards live for 7 days (vs 24h for Discover types).

`content_json` shape for news:

```json
{
  "article_fr": "...",
  "article_en": "...",
  "vocabulary":     [{ "french", "english", "pos", "example_fr" }],
  "expressions":    [{ "fr", "en", "note" }],
  "grammar_points": [{ "title", "explanation", "example_fr" }]
}
```

Backed by `services.llm` with a curated 9-topic offline fallback library so the feature works without a live LLM. `seed_news` management command bulk-loads the fallback set.

**Endpoints** (`/api/news/`):
- `GET ` — paginated list, optional `?topic=` filter, returns `{ articles, topics }`
- `GET {id}/` — full article
- `POST generate/` — generate one (optional topic)
- `POST {id}/interact/` — mark read, award XP

### Phase 17 — UI Overhaul

#### Design tokens

Tailwind config carries: `primary` (indigo-violet), `accent` (coral), `success`, `danger`, `warn`, `info`, `surface` (slate), `paper`, `ink`. Typography scale: `display-xl, display, h1, h2, h3, h4, body-lg, body, caption, eyebrow` with baked-in line-height and tracking. Custom shadows: `card, card-hover, card-elevated, glow-primary, glow-success, glow-danger, glow-accent`. Custom keyframes: `fade-in, fade-in-up, slide-in-*, scale-in, pop-in, bounce-in, shake, confetti-pop, confetti-fall, pulse-glow, recording-pulse, count-up, shimmer, float, gradient-shift, spin-slow, flame, pulse-soft`.

Fonts: **Inter** (UI), **Instrument Serif** (display headlines + pull quotes — `font-editorial` utility), **JetBrains Mono** (numerics).

CSS component layer: `.card, .card-hover, .card-elevated, .btn-primary/secondary/ghost/accent/danger/success, .btn-sm/md/lg/xl, .badge-*, .input, .input-error, .focus-ring, .section-label, .eyebrow-primary, .stat-pill, .kbd, .glass, .skeleton, .underline-wavy`.

Shared UI components: `PageHeader, EmptyState, Confetti, TriumphHero, Skeleton/SkeletonText/SkeletonCard/SkeletonCircle/SkeletonGrid`.

#### Dashboard — Hybride direction

- Header: French date · 24h clock, time-of-day greeting (Bonjour / Bon après-midi / Bonsoir), streak-flame + XP pill
- Hero: dark ink + primary panel with a recommended subjunctif drill on the **left** (col-span 7), `CompassDial` SVG radar with 6 skill axes on the **right** (col-span 5)
- Today's plan trio inside the hero
- Bottom row: TCF countdown / Mot du jour / Quick rail (4 tiles)
- Citation du jour card (13 curated French quotes, daily rotation, FR ↔ EN toggle, AudioPlayButton)
- Recent activity panel (sourced from `trend.top_activities` + `trend.sample_mistakes`)

#### Assistant — single-column chat with drawers

- Sticky header: history-drawer toggle, "Nouvelle" pill, scenario/mode title, Tuteur avatar button, Erreurs flag button
- HistoryDrawer (left): mode picker, scenario tile grid, search, real conversation history
- TuteurDrawer (right): persona card, mode + scenario pickers
- ErreursDrawer (right): per-message correction list (wired for backend issues when surfaced)
- 10 scenario-specific copy bundles (placeholder, starter chips, mise-en-situation sentence, header blurb)
- Bypasses the Layout's max-width wrapper for an edge-to-edge feel

#### Layout

Sidebar nav: groups have an optional `collapsible` flag — Practice is collapsible (chevron header, persisted to `localStorage` under `lingaru.sidebar.collapsedSections.v1`). Auto-expands when the active route lives inside a collapsed section. Mistakes was demoted to a Progress page header action; Documents was demoted to a Settings → Security card.

The Assistant route is special-cased in `Layout.jsx` to render full-bleed (no `max-w-7xl mx-auto px-4…py-8` wrapper).

---

Each phase is self-contained and deployable. Features can be reordered based on priorities.
