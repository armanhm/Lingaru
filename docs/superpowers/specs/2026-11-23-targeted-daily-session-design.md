# Targeted Daily Session: design

Date: 2026-11-23 · Status: approach agreed with the owner; doc pending approval · Build order: second, after the design foundation (see "Sequencing")

## 1. Intent and why

Lingaru has several users, each learning on their own for their own goal: some prepare for the TCF or TEF, others improve general French. Today every learner sees the same 18-item menu and a Dashboard whose "recommended session" and scores are invented. A learner with 20 free minutes has to decide what to practise, and the app gives them no real guidance.

The targeted daily session is the app's answer to "I have N minutes, what should I do?": open the app, press one button, and spend the time on the skill that is weakest for **you**, with a short warm-up, focused practice, one check item and a wrap-up that says what changed and what is next.

The owner's words: an exam learner with 20 minutes "should get a short targeted session on their weakest exam section"; a general learner gets "the same focused session, aimed at their weakest skill".

## 2. Goals, non-goals, anti-goals

**Goals**

- One-tap daily session sized to the learner's minutes per day (default 20).
- Focus chosen from real, recent performance: weakest exam section for exam learners, weakest of six skills for general learners.
- Every session includes one "check" item that measures the focus skill, so the next session's choice improves.
- Zero LLM calls to assemble a session; live AI is used only to grade writing and speaking answers.
- Real data on the Dashboard: the "Today" card replaces the invented recommendation hero; exam countdown comes from the learner's actual exam date.

**Non-goals (this project)**

- Classroom, teacher or group features; comparing learners.
- Generating new content on the fly during a session.
- Redesigning the rest of the app (that is the separate redesign project).
- Long-term curriculum planning beyond "today" and "tomorrow's focus".
- Telegram bot sessions (possible later; not in scope).

**Anti-goals** (would make this a failure even if it works)

- The same exercise served again after a day or two because the bank is thin.
- A session that silently burns the shared free-tier AI quota.
- A "weakest" skill that never changes because it is computed from best-ever scores.
- Removing free practice: every existing practice mode stays reachable.

## 3. Constraints

- **Shared free-tier AI quota** (Gemini primary, Groq fallback) across several users.
- **Thin exam content today:** 29 exam exercises in total, about one per section per CEFR level.
- **Signals are uneven:** pronunciation attempts, lesson quizzes, SRS reviews, grammar drills and exam responses store scores; dictation and mini-games store only XP transactions; news reading stores only "read".
- **Language scoping:** everything is filtered by `user.target_language` (`fr`, `en`); the exam bank is French first.
- **Existing patterns to follow:** hand-reviewed content banks in `data/` loaded by `seed_*` commands (trivia, grammar booster); services under `apps/<app>/services.py`; idempotent XP via `award_xp(..., source_id=...)`; async AI grading for writing/speaking already exists in `apps/exam_prep`.
- **Builds on the design foundation:** the session screens use the new design system's tokens and components, which ship first.

## 4. Approaches considered

Where a session's material comes from:

1. **Generate with AI per session.** Endless variety; costs quota every session for every user; unreviewed quality.
2. **Large curated bank.** Batch-generate offline, review, commit to `data/`; predictable quality, zero per-session AI; someone must review batches.
3. **Compose from existing practice.** Map each skill to practice that already works (dictation, Listening Challenge, news, quizzes, conjugation, pronunciation, voice chat, flashcards, grammar drills) plus one check item.

**Picked: 3 backed by 2** (owner's choice). Most of the time uses free, existing practice; the exam item bank grows steadily without per-session AI; live AI is reserved for grading writing and speaking.

Sequencing:

1. Session first on the current look (fastest, throwaway UI).
2. **Design foundation first, then the session** (picked by the owner): no throwaway UI; the session is the first feature built natively in the new design.
3. Full redesign first (slowest to new value).

## 5. Design (decided)

### 5.1 Learner goal profile

Reuse what exists on `User`: `mode` (`general`, `exam`, `agentic`), `proficiency_level` (where they are), `target_level`, `daily_goal_minutes`.

Add:

| Field | Type | Notes |
|---|---|---|
| `exam_type` | `TCF` / `TEF` / blank | Required when `mode == "exam"` |
| `exam_date` | date, nullable | Drives the real countdown |
| `exam_target` | small text, blank | Target CEFR level or score, free-form for now |

`agentic` users are treated as general learners for session purposes (all six skills).

Onboarding and Settings collect these fields; the Dashboard's countdown and target readouts use them (replacing the hard-coded 47 days and 412/438/386).

### 5.2 Skills and the skill event log

Six skills: **listening, reading, writing, speaking, vocabulary, grammar.** Exam sections map 1:1: CO = listening, CE = reading, EE = writing, EO = speaking.

A new append-only record, **SkillEvent** (one row per graded attempt): `user`, `skill`, `score` (0..1), `weight` (default 1; check items weigh more), `source` (e.g. `dictation`, `exam_item`, `srs_review`), `source_id`, `language`, `created_at`. Indexed on `(user, language, skill, created_at)`.

Every scored practice activity writes one event through a single service function (`record_skill_event`), including the ones that store nothing today (dictation, mini-games, news comprehension if added). Existing scored models keep their tables; they also emit events. A backfill command creates events from existing history (exam responses, quiz sessions, pronunciation attempts, SRS reviews, grammar mastery) so current users don't start cold.

### 5.3 Choosing today's focus

- Skill strength = recency-weighted average of event scores (exponential decay; a result from about two weeks ago counts half). Only the last ~30 days are considered.
- Candidate skills: for `exam` mode, the sections the learner's `exam_variant` counts (see 5.9: the four exam sections for TCF Canada and TEF; listening, reading, grammar and vocabulary for TCF Tout Public, plus writing and speaking if the learner opts in); all six otherwise.
- Focus = lowest strength. Ties, or skills with too little data, go to the least-practised skill.
- Avoid the same focus more than two days running unless it is far below the others, so other skills don't decay unnoticed.
- **Cold start:** a learner with too few events in a skill gets a short placement check (a few items per candidate skill) before their first session; its results are ordinary events.

### 5.4 Session composition

Four blocks, durations scaled from `daily_goal_minutes` (shown for 20):

| Block | ~Time (20 min) | Content |
|---|---|---|
| Warm-up | 3 min | Due flashcards, biased toward words missed in the focus skill |
| Focused practice | 10 min | Practice mapped to the focus skill, at the learner's level |
| Check item | 6 min | One exam-style item from the bank (exam learners) or a short skill quiz (general learners); weighs more in the event log |
| Wrap-up | 1 min | Score vs last time, tomorrow's likely focus, missed words added to flashcards |

Practice mapping (focused block):

| Skill | Practice sources |
|---|---|
| Listening | Dictation, Listening Challenge round |
| Reading | A short news article at level + comprehension questions, lesson quiz |
| Writing | Conjugation drill, short AI-graded writing prompt (async grading) |
| Speaking | Pronunciation phrases, short AI-graded spoken answer (async grading) |
| Vocabulary | Mini-game round (match pairs, gender snap, missing letter), SRS |
| Grammar | Grammar Booster drill on the weakest due topic |

A session is a server-side plan (ordered blocks with item references), created once per day per user, resumable if left mid-way, and recorded as complete with its results.

### 5.5 Exam item bank

- File: `data/exam_items_<lang>.json` (French first), versioned in git like the trivia bank.
- Item shape follows `ExamExercise` (`section`, `cefr_level`, `title`, `content`), plus a stable `slug` for upserts.
- A management command batch-generates candidate items per section and level with the LLM into a review file; the owner reviews and merges accepted items into the bank; a seed command upserts the bank into `ExamExercise`.
- Learners don't see the same check item twice until they've seen everything at their level for that section.
- Target bank size for launch: enough items per section at each learner's level that a daily learner doesn't repeat for at least two weeks (builder confirms the exact number from level distribution).

### 5.6 AI usage

- Assembling a session: no LLM calls.
- Grading writing and speaking answers: existing async grading path (Celery), one call per answer.
- Listening audio for items: TTS generated once per item and cached (existing TTS cache).

### 5.7 Surfaces

- **Dashboard "Today" card** (replaces the invented hero): today's focus skill and why ("listening: 54% over your last 5 tries"), minutes, one Start button; progress and resume if started; a done state with tomorrow's focus.
- **Session player** (new route, e.g. `/session/today`): one block at a time with a progress bar, built from the new design system. Existing inline practice widgets (the chat "blocks" components) can be reused inside blocks where they fit.
- **Free practice** stays reachable from navigation; how navigation is regrouped belongs to the redesign project.
- XP for completing a session is awarded once per session (idempotent key).

### 5.8 Success criteria

- A learner can start a sized session in one tap from the Dashboard every day for two weeks without repeating a check item.
- The chosen focus changes when performance changes (verified with seeded histories).
- Zero LLM calls during session assembly (asserted in tests).
- Dashboard shows no invented numbers.

### 5.9 Decisions after the builder review (controller's calls unless marked)

- **Sequencing:** backend work (profile fields, SkillEvent log and backfill, focus selection, session plans, exam bank pipeline) may start before the design foundation lands; session and Dashboard screens wait for the foundation's components.
- **General learners' check item:** drawn from existing material where the skill has it (vocabulary: a recall quiz from the learner's flashcards; grammar: Grammar Booster drill items at level; reading: lesson questions or a reading item from the exam bank); listening, writing and speaking use exam-bank items at the learner's level (the bank's French items serve both exam and general learners).
- **Which level:** `proficiency_level` selects content and items. Empty or `unsure` is resolved by the cold-start placement check, which sets `proficiency_level`. Automatic level changes from results are out of scope (issue #127).
- **Where Start lives:** a Today card on each mode's landing page: the Dashboard (general), the Exam Prep hub (exam), and a pinned card on the Assistant home (agentic). The redesign may regroup this later.
- **Dashboard scope:** remove every invented value. The skill compass and section readouts show real strengths (0-100) from the event log. No predicted TCF/TEF scores and no invented targets; the countdown uses `exam_date` only.
- **AI budget:** a per-user daily cap on AI-graded items (default 3, configurable). Speech-to-text and text-to-speech are outside the cap but covered by request throttling. When the cap is reached, the session swaps the AI-graded item for non-AI practice. When a provider fails, the answer is kept and graded later; the wrap-up shows "grading pending". Daily AI usage per user is recorded for the owner to inspect.
- **Phase 1 overlaps:** `record_skill_event` lives inside the shared activity service planned in #91 (one call site per activity). Mini-games are embedded in sessions only after #107 (shared game hook and screen) so their rules aren't written a third time.
- **"Today":** each user gets a timezone, detected from the browser on login (no onboarding step); "today" and the "two days running" rule use it.
- **Exams (owner accepted the proposal):** support TCF and TEF. An `exam_variant` setting next to `exam_type` decides which sections count as candidate skills, e.g. TCF Tout Public (listening, reading, grammar/vocabulary compulsory; writing and speaking only if the learner opts in), TCF Canada and TEF (all four sections). The exam bank holds items for the four sections only (CO, CE, EE, EO), so when an exam learner's focus is grammar or vocabulary the check item is the short skill quiz that general learners get.
- **Languages (owner accepted the proposal):** daily sessions launch for French learners only. English learners keep every existing feature; the Today card is hidden for them until English content exists.

## 6. Left to the builder

- Exact decay constant, thresholds for "too little data", and tie-break details (within the rules above).
- Placement-check length and item selection.
- How each block's minutes translate into item counts per activity.
- Model and endpoint names, URL of the session player, how inline widgets are reused.
- The backfill command's mapping from existing history to events.
- Exact bank size target per section/level and the generation command's prompt and review-file format.

## 7. Related

- Phase 0 review and roadmap: `docs/review/2026-11-phase0-review.md` (Phase 2 items #121 Dashboard real data, #123 learning loop into SRS).
- Current behaviour: `docs/wiki/Exam-Prep.md`, `docs/wiki/Progress-SRS-and-Conjugation.md`, `docs/wiki/Mini-Games.md`, `docs/specs/exam-prep.md`.
