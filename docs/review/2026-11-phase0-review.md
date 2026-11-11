# Phase 0 Review and Roadmap (November 2026)

> A full read-through of Lingaru (backend, AI stack, Telegram bot, frontend, infrastructure) done on 2026-11-11 against `main` @ `a351605`. This page summarises what we found and turns it into a phased plan. Each finding is a GitHub issue; the wiki and specs describe the system as it is today.

**Outputs of Phase 0**

| Deliverable | Where |
|-------------|-------|
| Wiki (how it works, how to work on it) | [`docs/wiki/`](../wiki/Home.md), mirrored to the GitHub Wiki |
| Specs (current-state contracts per domain) | [`docs/specs/`](../README.md#specs) |
| Findings as issues | [`phase-0-review` label](https://github.com/armanhm/Lingaru/issues?q=label%3Aphase-0-review) across three milestones |
| Security audit | Done; findings are tracked privately until fixed (see [`SECURITY.md`](../../SECURITY.md)) |

## Method

Five parallel reviews, each reading every non-generated file in its scope and running that scope's tests:

1. Backend core: config, users, content, practice, progress, gamification
2. AI stack: `services/*`, assistant, agents, memory, documents, media
3. Feature apps: bot, discover/news, dictionary, exam prep, grammar, notes, my notes, `data/`
4. Frontend: routing, API layer, state, pages, components, design tokens, i18n, build
5. Security and infrastructure: settings, Docker, nginx, CI/CD, dependencies, git hygiene

The findings were then deduplicated into 82 work items, each sized to roughly one PR.

## Health snapshot

| Area | Today |
|------|-------|
| Backend size | ~26k LOC app code (about 9k of it seed data as Python literals), ~53k LOC tests, 17 apps, 5 service packages |
| Backend tests | 740 tests: 737 pass, 3 fail. The failures are the `services/rag` embedder tests (stale mocks); CI never runs them because `services/` is outside `testpaths`. With LLM keys blanked the full suite takes ~40 s; with a real `.env` present some tests reach live LLM APIs and take minutes. Coverage on core apps is ~75%. |
| Frontend size | ~23k LOC JSX, 44 pages; the largest are `Assistant.jsx` (1.7k), `Settings.jsx` (1.4k), `MyNotesEdit.jsx` (0.9k) |
| Frontend bundle | One 1.1 MB JS chunk (294 KB gzipped), with no route-level code splitting |
| Frontend quality | ESLint: 0 errors, 43 warnings. No unit tests; e2e covers the login and register screenshots |
| i18n | 30 of 44 pages have no translated strings yet |
| Docs | The README and ARCHITECTURE had drifted from the code in about 30 places; replaced by this wiki and specs |

## What is good

- Clear domain split into Django apps, and a shared `services/` layer for LLM, RAG, TTS, STT and memory.
- Consistent per-user ownership scoping on user data, and no raw SQL, `eval` or pickle.
- A real provider abstraction with Gemini to Groq fallback, plus caching where LLM output is reused (dictionary).
- Good CI breadth (Ruff, pytest, ESLint, build, Trivy, Playwright, Lighthouse) and a deploy with a health check and code rollback.
- Hand-authored content banks in `data/` are replacing LLM generation for static content: the right direction.
- A coherent visual identity and a token system to build the redesign on.

## Main themes

1. **Integrity of learning data.** XP awards are not idempotent, exam scoring uses the wrong denominator, the conjugation checker matches the wrong verb, and Listening Challenge never awards XP. Progress numbers are therefore not fully trustworthy.
2. **Broken edges.** Oral exam recording calls an endpoint that does not exist; EE/EO grading runs with an empty system prompt; bot `/quiz` touches the ORM from async code; My Notes autosave can drop edits.
3. **Language scoping is incomplete.** Several endpoints, the dictionary cache, STT/TTS and the news generator still assume French.
4. **Request-path latency.** LLM, RSS and TTS calls run inline on sync workers; chat sends the full history every turn; memory extraction adds a second LLM call per turn; RAG is a brute-force scan.
5. **Duplication.** Five chat entry points build prompts differently, five LLM JSON parsers, two SM-2 implementations, six mini-games plus ten chat widgets with copied logic, ~9k lines of seeds as Python.
6. **Frontend weight.** No code splitting or asset caching; 117 hand-written fetch effects with no cancellation; very large page components; hard-coded Dashboard data.
7. **Safety nets.** Tests are not hermetic and run on SQLite while prod runs Postgres; deploy rollback does not cover migrations; there are no off-host backups.

## Roadmap

### Phase 0.5: Critical fixes (do first)

Small, high-value fixes plus the safety nets (hermetic tests, migration-safe deploys, backups) that make Phase 1 refactoring safe. Security hardening runs in parallel and is tracked privately.

| Issue | Title | Severity | Effort | Areas |
|---|---|---|---|---|
| [#66](https://github.com/armanhm/Lingaru/issues/66) | Fix EE/EO exam grading: system prompt lookup and score validation | critical | S | backend, ai |
| [#67](https://github.com/armanhm/Lingaru/issues/67) | Make XP awards idempotent and atomic across all award_xp callers | high | M | backend |
| [#68](https://github.com/armanhm/Lingaru/issues/68) | Fix exam session scoring: dedupe answers, real denominator, pending grading | high | M | backend |
| [#69](https://github.com/armanhm/Lingaru/issues/69) | Fix conjugation check matching the wrong verb via substring lookup | high | S | backend |
| [#70](https://github.com/armanhm/Lingaru/issues/70) | Make Telegram bot handlers async-safe and fix message formatting | high | M | bot |
| [#71](https://github.com/armanhm/Lingaru/issues/71) | Fix oral-expression exam recording calling a nonexistent endpoint | high | M | frontend, backend |
| [#72](https://github.com/armanhm/Lingaru/issues/72) | Fix My Notes autosave dropping edits typed during an in-flight save | high | M | frontend |
| [#73](https://github.com/armanhm/Lingaru/issues/73) | Add a language column to DictionaryCache keys | high | S | backend, ai |
| [#74](https://github.com/armanhm/Lingaru/issues/74) | Make backend tests hermetic and run every suite in CI on Postgres | high | L | backend, infra |
| [#75](https://github.com/armanhm/Lingaru/issues/75) | Make deploys migration-safe with pre-deploy backup and restart policies | high | M | infra |
| [#76](https://github.com/armanhm/Lingaru/issues/76) | Set up encrypted off-site backups for Postgres and media | high | M | infra |
| [#77](https://github.com/armanhm/Lingaru/issues/77) | Accept listening_challenge in MiniGameScoreView so it awards XP | medium | S | backend, frontend |

### Phase 1: Cooldown (refactor and optimise, no new features)

Suggested workstreams, in order:

| # | Workstream | Issues |
|---|-----------|--------|
| 1 | Backend performance: indexes, N+1, DB-side aggregation, retention, async jobs | #93 #94 #92 #95 #96 |
| 2 | AI layer: one `run_turn` pipeline, router hardening, JSON helper, prompt composition, token budget, memory cost, pgvector, TTS cache | #84 #85 #86 #78 #79 #87 #88 #89 #106 |
| 3 | Language scoping everywhere | #90 #80 #99 |
| 4 | Shared domain services: `record_activity`, shared grading and SM-2 | #91 #98 |
| 5 | Content as data: grammar drills JSON, seed consolidation, video processing | #100 #115 #97 |
| 6 | Frontend speed: code splitting, caching, compression | #81 |
| 7 | Frontend structure: split Assistant and Settings, `useMiniGame`, TanStack Query, state bugs, agent blocks, lint | #105 #104 #107 #108 #110 #119 #118 |
| 8 | Quality: Vitest + RTL, authed Playwright flows, a11y primitives and fixes, i18n coverage | #83 #111 #112 #113 #114 |
| 9 | Ops and DX: Docker hardening, logging and observability, API envelope consistency, cleanups | #101 #102 #116 #117 |
| 10 | Honest UI: remove fabricated Dashboard data, Safari recording | #82 #109 |
| 11 | Docs: close the remaining README and plan drift | #103 |

| Issue | Title | Severity | Effort | Areas |
|---|---|---|---|---|
| [#78](https://github.com/armanhm/Lingaru/issues/78) | Compose system prompts at runtime so RAG no longer drops the agentic footer | high | M | backend, ai |
| [#79](https://github.com/armanhm/Lingaru/issues/79) | Bound chat cost: history token budget, rolling summary, paged messages | high | M | backend, ai, bot |
| [#80](https://github.com/armanhm/Lingaru/issues/80) | Use the learner's target language for STT, TTS and dictation everywhere | high | M | backend, bot, ai |
| [#81](https://github.com/armanhm/Lingaru/issues/81) | Code-split routes and serve frontend assets with caching and compression | high | M | frontend, infra |
| [#82](https://github.com/armanhm/Lingaru/issues/82) | Remove fabricated Dashboard data and inert UI controls | high | M | frontend |
| [#83](https://github.com/armanhm/Lingaru/issues/83) | Add Vitest, RTL and msw and cover critical frontend logic | high | M | frontend |
| [#84](https://github.com/armanhm/Lingaru/issues/84) | Extract a single run_turn chat pipeline for web, voice, image and bot | medium | L | backend, ai, bot |
| [#85](https://github.com/armanhm/Lingaru/issues/85) | Harden the LLM router: client reuse, empty-reply fallback, retries, models | medium | M | backend, ai |
| [#86](https://github.com/armanhm/Lingaru/issues/86) | Consolidate LLM JSON parsing into one helper with native JSON mode | medium | M | backend, ai |
| [#87](https://github.com/armanhm/Lingaru/issues/87) | Cut memory overhead: extraction pre-filter, cached learner context | medium | M | backend, ai |
| [#88](https://github.com/armanhm/Lingaru/issues/88) | Move RAG retrieval to pgvector with model-tagged, page-aware chunks | medium | L | backend, ai |
| [#89](https://github.com/armanhm/Lingaru/issues/89) | Make TTS caching race-safe, language-validated and length-capped | medium | M | backend, ai |
| [#90](https://github.com/armanhm/Lingaru/issues/90) | Enforce target_language scoping across remaining endpoints and models | medium | L | backend |
| [#91](https://github.com/armanhm/Lingaru/issues/91) | Introduce record_activity service for streak, XP, badges and feedback | medium | L | backend |
| [#92](https://github.com/armanhm/Lingaru/issues/92) | Rewrite TrendReportView as a tested service with DB-side aggregation | medium | M | backend |
| [#93](https://github.com/armanhm/Lingaru/issues/93) | Add composite indexes for hot user and date filters, persistent DB conns | medium | M | backend |
| [#94](https://github.com/armanhm/Lingaru/issues/94) | Fix N+1 and redundant queries in notes, grammar, exam, practice and admin | medium | M | backend |
| [#95](https://github.com/armanhm/Lingaru/issues/95) | Add retention and pruning tasks for unbounded tables and media | medium | M | backend, infra |
| [#96](https://github.com/armanhm/Lingaru/issues/96) | Move slow generation endpoints to Celery jobs with polling | medium | L | backend, frontend, ai |
| [#97](https://github.com/armanhm/Lingaru/issues/97) | Harden process_video_lesson: language, atomic writes, permanent errors | medium | M | backend, ai, content |
| [#98](https://github.com/armanhm/Lingaru/issues/98) | Extract shared answer grading and SM-2 modules | medium | M | backend |
| [#99](https://github.com/armanhm/Lingaru/issues/99) | Finish Discover Phase 3: scope generation, dedupe trivia, drop fake news | medium | M | backend, bot, content |
| [#100](https://github.com/armanhm/Lingaru/issues/100) | Author grammar drills in JSON and retire the legacy seed_grammar | medium | L | backend, content |
| [#101](https://github.com/armanhm/Lingaru/issues/101) | Harden Docker images and compose services; split dev requirements | medium | M | infra, backend |
| [#102](https://github.com/armanhm/Lingaru/issues/102) | Configure logging and observability for backend and frontend | medium | M | backend, frontend, infra |
| [#103](https://github.com/armanhm/Lingaru/issues/103) | Fix documentation drift in README and ARCHITECTURE | medium | M | backend, frontend, infra, bot |
| [#104](https://github.com/armanhm/Lingaru/issues/104) | Split Settings.jsx into per-tab components with their own form state | medium | M | frontend |
| [#105](https://github.com/armanhm/Lingaru/issues/105) | Split Assistant.jsx and isolate composer state to stop re-render lag | medium | L | frontend |
| [#106](https://github.com/armanhm/Lingaru/issues/106) | Move assistant prompt engineering from the frontend to the backend | medium | M | frontend, backend, ai |
| [#107](https://github.com/armanhm/Lingaru/issues/107) | Extract useMiniGame, GameShell and shared text, media and time utils | medium | L | frontend |
| [#108](https://github.com/armanhm/Lingaru/issues/108) | Adopt TanStack Query for server state in the frontend | medium | L | frontend |
| [#109](https://github.com/armanhm/Lingaru/issues/109) | Support Safari audio recording and pass real audio format to Whisper | medium | M | frontend, backend, bot |
| [#110](https://github.com/armanhm/Lingaru/issues/110) | Fix assorted frontend state bugs: timers, nested components, auth boot | medium | M | frontend |
| [#111](https://github.com/armanhm/Lingaru/issues/111) | Add authed Playwright smoke flows and Lighthouse budgets | medium | M | frontend, infra |
| [#112](https://github.com/armanhm/Lingaru/issues/112) | Add accessible Dialog and Drawer primitives and migrate overlays | medium | M | frontend |
| [#113](https://github.com/armanhm/Lingaru/issues/113) | Fix accessible names, label links, keyboard traps, contrast and motion | medium | M | frontend |
| [#114](https://github.com/armanhm/Lingaru/issues/114) | Wire i18n through the 30 untranslated pages and shared components | medium | L | frontend, backend |
| [#119](https://github.com/armanhm/Lingaru/issues/119) | Render message blocks on the agent run page | medium | S | frontend |
| [#115](https://github.com/armanhm/Lingaru/issues/115) | Consolidate Python-literal seeds into JSON data and generic loaders | low | L | backend, content |
| [#116](https://github.com/armanhm/Lingaru/issues/116) | Standardise API list envelopes, error bodies and query param validation | low | M | backend, frontend |
| [#117](https://github.com/armanhm/Lingaru/issues/117) | Assorted backend cleanups: dead code, admin fields, stale names | low | M | backend, ai, bot |
| [#118](https://github.com/armanhm/Lingaru/issues/118) | Clear ESLint warnings, delete dead frontend code, enforce zero warnings | low | S | frontend |

### Phase 2: Smart features and redesign

Built on the Phase 1 foundations: a design system first, then the "smart tutor" capabilities (tool calling, streaming, closing the loop from chat corrections into SRS, adaptive level, episodic memory).

| Issue | Title | Severity | Effort | Areas |
|---|---|---|---|---|
| [#120](https://github.com/armanhm/Lingaru/issues/120) | Define design tokens and a core component library for the redesign | medium | L | frontend |
| [#121](https://github.com/armanhm/Lingaru/issues/121) | Show real skill breakdown and exam countdown on the Dashboard | medium | M | frontend, backend |
| [#122](https://github.com/armanhm/Lingaru/issues/122) | Let the assistant call tools instead of emitting fenced JSON blocks | medium | L | backend, ai |
| [#123](https://github.com/armanhm/Lingaru/issues/123) | Close the learning loop from chat corrections to mistakes and SRS | medium | L | backend, ai, frontend |
| [#124](https://github.com/armanhm/Lingaru/issues/124) | Stream assistant replies over SSE and build a real-time voice tutor | medium | L | backend, frontend, ai |
| [#125](https://github.com/armanhm/Lingaru/issues/125) | Add account deletion and data export | medium | M | backend, frontend |
| [#126](https://github.com/armanhm/Lingaru/issues/126) | Add episodic memory from summarised conversations | low | L | backend, ai |
| [#127](https://github.com/armanhm/Lingaru/issues/127) | Adapt tutoring level and correction density to the learner | low | L | backend, ai |
| [#128](https://github.com/armanhm/Lingaru/issues/128) | Make exam and grammar sessions reopenable from a URL | low | M | frontend, backend |
| [#129](https://github.com/armanhm/Lingaru/issues/129) | Pre-warm the conjugation cache and add an English trivia bank | low | M | backend, content |

## How to use this

- Pick issues from the current milestone; each has a problem statement, a proposal, acceptance criteria and file pointers.
- When a PR changes behaviour, update the matching page in `docs/specs/` in the same PR.
- After merging docs changes to `main`, run `scripts/sync_wiki.sh` to refresh the GitHub Wiki.
