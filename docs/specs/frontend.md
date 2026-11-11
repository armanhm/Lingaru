# Spec: Frontend (web client)

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Frontend Architecture](../wiki/Frontend-Architecture.md), [Internationalization](../wiki/Internationalization.md), [Mini Games](../wiki/Mini-Games.md), [Frontend Design System](../wiki/Frontend-Design-System.md)

## 1. Purpose & scope

**In scope:** the React SPA in `frontend/`. That covers:

- Routing and navigation.
- The session contract with the Django API.
- The API client conventions.
- Loading, error and empty conventions.
- Build output, browser support, performance and visual budgets.
- Accessibility expectations.

**Out of scope:**

- Backend endpoint semantics, which are owned by each app's spec.
- The Telegram bot.
- Visual tokens, covered by [design-system.md](design-system.md).

## 2. Requirements

### Routing and navigation

| ID | Requirement |
|---|---|
| FR-1 | The app is a single-page app served from `/`. Unknown client paths render `NotFound` (`*` route). nginx falls back to `index.html` for any non-file path. |
| FR-2 | `/login` and `/register` are public. Every other route is nested under `ProtectedRoute` + `Layout` and redirects to `/login` when there is no authenticated user. |
| FR-3 | The index route `/` resolves by `user.mode`: `general` (or null) renders the Dashboard, `exam` redirects to `/exam-prep`, `agentic` redirects to `/assistant`. |
| FR-4 | The sidebar shows only the items allowed for the user's mode (`MODE_CONFIG[mode].visible`) and target language (an item-level `languages` list). In agentic mode, Dashboard and Assistant collapse into one "Home" item pointing at `/assistant`. |
| FR-5 | When `user.mode` is null, `OnboardingModal` is shown over the layout until the user picks a mode, level and target language. |
| FR-6 | The full route table is in §4.3. Each route maps to exactly one module in `src/pages/`. |

### Session

| ID | Requirement |
|---|---|
| FR-10 | Login posts credentials to `/api/users/login/`, receives a JWT pair, then loads the profile from `/api/users/me/`. |
| FR-11 | Every API request carries `Authorization: Bearer <access>` when a session exists. |
| FR-12 | On a 401, the client attempts exactly one token refresh through `/api/users/token/refresh/` and retries the original request once. If the refresh fails, the session is cleared and the browser navigates to `/login`. |
| FR-13 | Registration returns `202 {status: "pending_approval", ...}` and does not create a session. A login attempt by an unapproved account surfaces the server's `detail` message. |
| FR-14 | Logout clears the client session and the in-memory user, then navigates to `/login`. |
| FR-15 | Only `AuthContext` and `api/client.js` read or write session credentials. |

### Preferences, theme, language

| ID | Requirement |
|---|---|
| FR-20 | The theme (light/dark) is applied before first paint from the saved preference or `prefers-color-scheme`, and persisted on toggle. |
| FR-21 | The UI language follows `user.ui_language` once logged in, and the browser or localStorage detection before that. `<html lang>` always matches the active UI language. |
| FR-22 | `user.mode` is mirrored to `<html data-mode>`, and the favicon switches to `/favicon-<mode>.png`. |
| FR-23 | Changing the target language in Settings PATCHes `target_language` and `ui_language` together, then reloads the page. |
| FR-24 | Mini-game lengths and timers are read from `user.preferences.<game>_*`, with per-page defaults. |

### Agentic chat

| ID | Requirement |
|---|---|
| FR-30 | Assistant replies render prose as Markdown (GFM). Raw HTML in Markdown is not rendered. |
| FR-31 | `reply.blocks[]` render through a type registry (`audio`, `vocab_card`, `expression`, `conjugation_table`, `quiz`, `action`, `feature_widget`). Unknown block types render nothing and do not throw. |
| FR-32 | `feature_widget` blocks render one of the registered inline widgets by `widget` slug. Unknown slugs render nothing. |
| FR-33 | On first visit, the Assistant auto-resumes the most recent conversation unless the user starts a new one. |

### Exam grading

| ID | Requirement |
|---|---|
| FR-40 | For asynchronously graded exam answers (EE/EO), the client polls `/api/exam-prep/responses/<id>/grading/` until the status leaves `pending`. The interval grows from 500 ms to 1500 ms in 250 ms steps, with a 60 s timeout. Errors are typed `timeout`, `not_found`, `server` or `network`. |

## 3. Data model

The client persists no domain data. Server data is fetched per page.

### 3.1 User profile (`GET /api/users/me/`, fields the client reads)

| Field | Type | Use |
|---|---|---|
| `id`, `username`, `email` | int, str, str | Header, Settings |
| `mode` | `"general"\|"exam"\|"agentic"\|null` | Landing, nav, theme, onboarding |
| `target_language` | `"fr"\|"en"` | Content language, feature availability |
| `ui_language` | `"en"\|"fr"\|null` | i18next language |
| `target_level` | `"A1".."C2"` | Settings, Topics default tab |
| `proficiency_level` | `"A1".."C2"\|"unsure"\|null` | Settings |
| `daily_goal_minutes` | int | Settings |
| `preferences` | object (free-form JSON) | Game settings and other toggles; merged over `DEFAULT_PREFS` in Settings |
| `telegram_id` | int\|null | Settings badge |

### 3.2 Client storage keys (non-credential)

| Key | Store | Value |
|---|---|---|
| `theme` | local | `"dark"\|"light"` |
| `lingaru-ui-language` | local | `"en"\|"fr"` |
| `lingaru.sidebar.collapsedSections.v1` | local | `{[labelKey]: boolean}` |
| `myNotes:splitPct` | local | number from 25 to 75 |
| `lingaru:last-activity` | session | `{label, url, ts}`, expires after 10 min |
| `exam_session_<sessionId>` | session | Payload from `POST /exam-prep/sessions/start/` |
| `grammar_session_<sessionId>` | session | Payload from `POST /grammar/sessions/start/` |
| `celebrated-streak-<n>` | session | `"1"` |

## 4. API contract

### 4.1 Client contract (`src/api/client.js`)

| Aspect | Contract |
|---|---|
| Base URL | `import.meta.env.VITE_API_URL`, defaulting to `/api`. In dev, Vite proxies `/api` to `http://localhost:8000`. |
| Default headers | `Content-Type: application/json`. For `FormData` bodies Axios sets the multipart boundary. |
| Auth | Request interceptor adds the Bearer header (FR-11). |
| 401 handling | Response interceptor: one refresh, one retry (FR-12). A request is never retried twice (`_retry` flag). |
| Module layout | One module per backend app in `src/api/`. Each export is a thin function returning the Axios promise. Pages read `res.data`. |
| Pagination | DRF `PageNumberPagination`, default `PAGE_SIZE=20`: `{count, next, previous, results[]}`. Some endpoints return bare arrays or objects, and callers handle both (`res.data.results \|\| res.data`). `normalizeVocabResponse()` normalises `/content/vocabulary/random/`. |
| Media URLs | `audio_url` values may be relative (`/media/...`). Callers prefix the origin derived from the API base. |

### 4.2 Error contract

| Server shape | Client behaviour |
|---|---|
| `{detail: "..."}` | Shown as-is (inline error or toast) |
| `{field: ["msg", ...]}` (DRF validation) | First message of the relevant field is shown (Settings, MyNotesEdit) |
| Network error or no response | Generic localised or literal fallback message |
| 401 | Refresh and retry (§4.1), otherwise redirect to `/login` |

### 4.3 Route → endpoint map

| Route | Endpoints used |
|---|---|
| `/login`, `/register` | `POST /users/login/`, `GET /users/me/`, `POST /users/register/` |
| `/`, `/dashboard` | `GET /gamification/stats/`, `GET /gamification/trend/`, `GET /progress/srs/due/?limit=1`, `GET /content/vocabulary/random/?count=1` |
| `/topics`, `/topics/:id`, `/lesson/:id` | `GET /content/topics/`, `GET /content/topics/:id/`, `GET /progress/topics/:id/`, `GET /content/lessons/:id/`, `POST /content/lessons/:id/video/` |
| `/practice/quiz/random` | `GET /practice/quiz/random-lesson/` |
| `/practice/quiz/:lessonId` | `POST /practice/quiz/start/`, `POST /practice/quiz/:sid/answer/`, `POST /practice/quiz/:sid/complete/`, `POST /progress/lessons/:id/complete/`, `POST /media/tts/` |
| `/practice/dictation` | `GET /media/dictation/start/`, `POST /media/dictation/check/` |
| `/practice/pronunciation` | `GET /content/vocabulary/random/`, `POST /media/pronunciation/check/` (multipart), `POST /media/tts/` |
| `/practice/srs` | `GET /progress/srs/due/`, `POST /progress/srs/review/` |
| `/practice/conjugation` | `GET /progress/conjugation/verbs/`, `POST /progress/conjugation/check/` |
| `/progress` | `GET /gamification/stats/`, `/badges/`, `/leaderboard/`, `/history/` |
| `/progress/mistakes` | `GET /progress/mistakes/`, `POST /progress/mistakes/reviewed/` |
| `/assistant` | `POST /assistant/chat/`, `GET /assistant/conversations/`, `GET /assistant/conversations/:id/`, `POST /assistant/image-query/` (multipart), `POST /assistant/voice-chat/` (multipart), `GET/DELETE /memory/notes/` |
| `/agents`, `/agents/:slug` | `GET /agents/`, `GET /agents/:slug/`, `POST /agents/:slug/start/`, `GET /agents/:slug/runs/`, `POST /assistant/chat/` with `agent_slug` |
| `/documents` | `GET /documents/`, `POST /documents/upload/` (multipart), `DELETE /documents/:id/` |
| `/discover` | `GET /discover/feed/?page=`, `POST /discover/generate-more/`, `POST /discover/cards/:id/interact/` |
| `/news`, `/news/:id` | `GET /news/?topic=&page=`, `POST /news/generate/`, `GET /news/:id/`, `POST /news/:id/interact/` |
| `/dictionary` | `POST /dictionary/lookup/`, `POST /dictionary/conjugate/` |
| `/our-notes/**` | `GET /notes/`, `GET /notes/:id/`, `POST /notes/:id/ask/`, `POST /notes/:id/add-to-srs/`, `POST /notes/:id/generate-quiz/` |
| `/my-notes/**` | `GET/POST /my-notes/`, `GET/PATCH/DELETE /my-notes/:id/`, `GET /my-notes/public/:id/`, `POST /my-notes/:id/ai-action/` |
| `/mini-games/*` | `GET /content/vocabulary/random/?count=&single_word=&gendered=`, `POST /gamification/mini-game/score/`, `POST /media/tts/` |
| `/exam-prep/**` | `GET /exam-prep/hub/`, `GET /exam-prep/exercises/`, `POST /exam-prep/sessions/start/`, `POST /exam-prep/sessions/:id/respond/` (may return 202 for async grading), `GET /exam-prep/responses/:id/grading/`, `POST /exam-prep/sessions/:id/complete/` |
| `/grammar/**` | `GET /grammar/hub/`, `GET /grammar/topics/`, `GET /grammar/topics/:slug/`, `POST /grammar/sessions/start/`, `POST /grammar/sessions/:id/answer/`, `POST /grammar/sessions/:id/complete/` |
| `/settings` | `PATCH /users/me/`, `PUT /users/change-password/`, `GET/POST/PATCH/DELETE /memory/notes/` |
| Onboarding | `PATCH /users/me/` `{target_language, mode, proficiency_level}` |

## 5. Business rules & invariants

### 5.1 Loading, empty and error conventions

| State | Convention | Primitive |
|---|---|---|
| Page loading | Skeleton blocks shaped like the content | `SkeletonCard`, `SkeletonText`, `.skeleton` |
| Session bootstrap | Full-screen "Loading..." in `ProtectedRoute` | n/a |
| Empty data | Icon, title, optional subtitle and CTA | `EmptyState` |
| Recoverable action error | Toast (`error`, 5 s) | `useToast().showToast(msg, "error")` |
| Page-level load error | Inline banner or `EmptyState tone="warn"` with a back link | n/a |
| Success feedback | Toast (`success`, 2.8 s) or a completion screen | `TriumphHero` |
| Toast durations | success 2800, info 3000, warn 4000, error 5000 ms | `ToastContext` |

### 5.2 Other invariants

- Typed answers in games and dictation are compared case-insensitively and accent-insensitively (NFD, combining marks stripped).
- Unknown block or widget types must never crash the chat (FR-31, FR-32).
- `featureAvailability.isAvailable(feature, lang)` defaults to `true` for unlisted features.
- Markdown rendering must not enable raw HTML.

### 5.3 Browser support

| Item | Current state |
|---|---|
| JS target | Vite 5 default `build.target` ("modules"): ES2020 with native ESM. Roughly Chrome/Edge 87-88+, Firefox 78+, Safari 14+. |
| CSS prefixes | Autoprefixer with the default Browserslist query (no `browserslist` field in `package.json`) |
| Required APIs | `fetch`/XHR, `localStorage`/`sessionStorage`, `Intl.DateTimeFormat`, `navigator.clipboard` (share link), `MediaRecorder` + `getUserMedia` (voice, pronunciation, EO), `Audio` |
| Layout | Responsive. The `md` breakpoint (768 px) switches between the mobile drawer and the desktop sidebar. |

### 5.4 Performance and visual budgets

From `frontend/lighthouserc.json`, run by `.github/workflows/lighthouse.yml` on PRs to `main`/`dev`:

| Setting | Value |
|---|---|
| URLs | `/login`, `/register` (static `dist`) |
| Preset | `desktop`, 1 run |
| Assertion preset | `lighthouse:no-pwa` |
| Performance | **warn** if score < 0.70 |
| Accessibility | **error** if score < 0.85 |
| Best practices | **warn** if score < 0.80 |
| SEO | **warn** if score < 0.80 |

From `frontend/playwright.config.js`, run by `.github/workflows/visual-regression.yml`:

| Setting | Value |
|---|---|
| Snapshots | `/login`, `/register`, full page |
| Viewport, locale, timezone, scheme | 1280×800, `en-US`, `UTC`, light |
| Tolerance | `maxDiffPixelRatio: 0.02`; 1 worker, no retries |

Bundle size has no explicit budget. Measured on 2026-11-11: one JS chunk of 1,100 KB (294 KB gzipped) and 186 KB of CSS (24 KB gzipped).

### 5.5 Accessibility expectations

| ID | Expectation | Current state |
|---|---|---|
| A-1 | Lighthouse accessibility ≥ 0.85 on public pages (CI error) | Enforced for `/login` and `/register` only |
| A-2 | Every interactive element has a visible focus style | `.focus-ring` on most custom buttons and links |
| A-3 | Icon-only buttons have an accessible name (`aria-label`) | Partial: several rely on `title` only |
| A-4 | Form inputs have programmatically associated labels | Not met: labels lack `htmlFor` |
| A-5 | Overlays use dialog semantics, trap focus and close on Escape | Only the Settings mobile drawer complies |
| A-6 | `<html lang>` matches the UI language | Met (`LanguageContext`) |
| A-7 | Text meets WCAG AA contrast | Not met for small `surface-400` metadata text |
| A-8 | Motion respects `prefers-reduced-motion` | Not met |
| A-9 | Status messages are announced | Toasts use `role="alert"` for every type |

## 6. Background jobs

None in the client. Client-side polling:

- Async exam grading (`pollExamGrading`, FR-40).
- Interval timers inside games and drills.

## 7. Dependencies

| Dependency | Purpose |
|---|---|
| react, react-dom 18.3 | UI |
| react-router-dom 6 | Routing |
| axios 1.x | HTTP |
| i18next, react-i18next, i18next-browser-languagedetector | UI i18n |
| react-markdown 10, remark-gfm 4 | Markdown rendering |
| tailwindcss 3.4, @tailwindcss/typography, postcss, autoprefixer | Styling |
| @sentry/react | Error and performance reporting (optional) |
| vite 5, @vitejs/plugin-react | Build and dev server |
| eslint 9 (+ react, react-hooks, react-refresh plugins), @playwright/test | Lint, visual tests |
| Google Fonts (Inter, Instrument Serif, JetBrains Mono) | Typography (runtime CDN) |
| Backend | Django REST API under `/api/`, media under `/media/` |

## 8. Deviations / open questions

- **No code splitting.** All 44 pages are imported eagerly into one chunk; there is no `React.lazy` or `manualChunks`.
- **No data layer.** There is no caching or request deduplication, and few effects cancel stale requests on unmount or param change (Assistant `loadConversation`, Topics, Dictionary).
- **EO exam broken.** `ExamExercise` sends oral-expression audio to `/api/media/voice-chat/`, which does not exist (the voice endpoint is `/api/assistant/voice-chat/`). It also bypasses the shared API client for that one call.
- **Dashboard placeholders.** The skill compass, "today's plan", the exam countdown (47 days) and the TCF sub-scores are hard-coded, not user data. `preferences.exam_days_left` and `exam_date` are never written.
- **Notes autosave race.** In `MyNotesEdit`, a save queued while another is in flight re-sends the older payload, so the latest edits may not be persisted.
- **Speed Round.** A game that ends by timeout submits a stale score of 0.
- **Listening Challenge.** Score submission is rejected (400) because `listening_challenge` is missing from the backend `VALID_GAMES`.
- **Dead preferences.** 9 Settings preferences have no consumer: `conjugation_questions`, `dictation_rounds`, `show_pronunciation`, `autoplay_audio`, `show_example_sentences`, `flashcard_order`, `quiz_difficulty`, `coaching_tips`, `daily_reminder`.
- **Settings save.** "Save profile" does not refresh the user, so the header shows stale data until reload. Any `user` refresh resets unsaved form fields on other tabs.
- **Recording on Safari.** `useVoiceRecorder` hard-codes `audio/webm;codecs=opus`, which Safari/iOS does not support. There is no unmount cleanup for an active recording.
- **Sessions not resumable.** Exam and grammar drill pages cannot be reloaded in a new tab or shared, because they depend on `sessionStorage` hand-off.
- **Return URL lost.** `ProtectedRoute` does not preserve the requested URL, so users always land on `/` after login.
- **Full reloads.** "Play again" in games and the memory popover's "Manage" link (`<a href>`) trigger full page reloads.
- **Sentry off in production.** `VITE_SENTRY_DSN` is not passed to the production nginx build, so frontend Sentry is compiled out.
- **i18n.** 30 of 44 pages have no i18n (see [Internationalization](../wiki/Internationalization.md)).
- **No `api/users.js`.** User endpoints are called from five modules directly.
- **Open question:** should `ui_language` stay independent of `target_language`? The code currently does both (FR-23 plus a separate picker).
- **Open question:** target bundle and performance budgets for authenticated pages. Lighthouse only measures public pages.
