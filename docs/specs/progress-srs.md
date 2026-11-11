# Spec: Progress, SRS and Conjugation

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Progress, SRS and Conjugation](../wiki/Progress-SRS-and-Conjugation.md)

## 1. Purpose & scope

**In scope:** SM-2 spaced-repetition cards over `content.Vocabulary`, the mistake journal, conjugation drills backed by `content.Question(type="conjugation")`, lesson completion records, per-topic progress, and the `seed_flashcards` / `seed_conjugations` commands.

**Out of scope:** Grammar Booster mastery scheduling (`apps/grammar/scoring.py`), quiz sessions (see [practice](practice.md)), XP/streak internals (see [gamification](gamification.md)), the dictionary conjugator (`apps/dictionary`).

## 2. Requirements

| ID | Requirement |
|----|-------------|
| FR-1 | Each user has at most one SRS card per vocabulary item. |
| FR-2 | The due-cards endpoint returns the user's cards with `next_review_at <= now` whose vocabulary is in the user's `target_language`, ordered by `next_review_at` ascending, at most `limit` (default 20, max 50). |
| FR-3 | Cards in other languages are retained and reappear when the user switches back. |
| FR-4 | Reviewing a card with quality 0-5 applies SM-2 (section 5), stores the new state, sets `next_review_at = now + interval_days`, awards XP and updates the streak. Only the owner can review a card (`404` otherwise). |
| FR-5 | Wrong quiz and conjugation answers are recorded as `MistakeEntry` rows with a `mistake_type`. |
| FR-6 | The mistake list returns only the user's entries, newest first, paginated, optionally filtered by `type` and `reviewed`. |
| FR-7 | A user can mark 1-100 of their own mistakes as reviewed in one request; ids belonging to others are ignored. |
| FR-8 | The conjugation verb list returns the distinct verbs and tenses present in conjugation questions. |
| FR-9 | A conjugation check compares the learner's answer with the stored conjugation for the requested verb, tense and subject; correct answers earn XP, wrong ones are recorded as `conjugation` mistakes. |
| FR-10 | Completing a lesson creates one `LessonCompletion` per (user, lesson); later completions only raise the stored best score. The first completion awards XP and updates the streak. |
| FR-11 | The lesson-complete response names the next lesson in the same topic by `order`, if any. |
| FR-12 | Topic progress returns the total number of lessons in a topic and which of them the user has completed. |

## 3. Data model

### `SRSCard` (`progress_srs_cards`), ordering `["next_review_at"]`

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `user` | FK `users.User`, `CASCADE`, related `srs_cards` | | |
| `vocabulary` | FK `content.Vocabulary`, `CASCADE`, related `srs_cards` | | Language comes from the vocabulary row. |
| `ease_factor` | `FloatField` | 2.5 | Floor 1.3. |
| `interval_days` | `PositiveIntegerField` | 0 | |
| `next_review_at` | `DateTimeField` | `timezone.now` | New cards are due immediately. |
| `repetitions` | `PositiveIntegerField` | 0 | Consecutive successful reviews. |
| `last_quality` | `PositiveIntegerField` | 0 | |

Constraint `unique_srs_card_per_user_vocab` on `(user, vocabulary)`.

### `MistakeEntry` (`progress_mistakes`), ordering `["-created_at"]`

| Field | Type | Notes |
|-------|------|-------|
| `user` | FK `users.User`, `CASCADE`, related `mistakes` | |
| `question` | FK `content.Question`, `SET_NULL`, nullable, related `mistakes` | |
| `user_answer` | `TextField` | |
| `correct_answer` | `TextField` | Copied at record time. |
| `mistake_type` | `CharField(15)` | `gender`, `conjugation`, `preposition`, `spelling`, `other`; default `other` |
| `created_at` | `DateTimeField(auto_now_add)` | |
| `reviewed` | `BooleanField` | default False |

### `LessonCompletion` (`progress_lesson_completions`), ordering `["-completed_at"]`

| Field | Type | Notes |
|-------|------|-------|
| `user` | FK `users.User`, `CASCADE`, related `lesson_completions` | |
| `lesson` | FK `content.Lesson`, `CASCADE`, related `completions` | |
| `completed_at` | `DateTimeField(auto_now_add)` | First completion time. |
| `score` | `PositiveIntegerField` | default 0; best score |
| `total_questions` | `PositiveIntegerField` | default 0; total for the best score |

Constraint `unique_lesson_completion_per_user` on `(user, lesson)`.

No indexes beyond FKs and the unique constraints. None of these models has its own `language` field.

### Conjugation data (stored in `content.Question`)

`type = "conjugation"`, `prompt = "Conjugate {verb} ({tense}, {subject})"`, `correct_answer = <form>`, `explanation = "{subject} {answer} ({verb}, {tense})"`, `difficulty = 2`, under topic "Conjugaison" (`order=100`) and lesson "Verb Conjugation Drills". Verbs are unaccented (`etre`, `connaitre`, `ecrire`). Tenses: `present`, `passe_compose`, `imparfait`, `futur_simple`, `conditionnel`. Subjects: `je` or `j'`, `tu`, `il/elle`, `nous`, `vous`, `ils/elles`.

## 4. API contract

Base path `/api/progress/`. All endpoints require an authenticated user.

### GET `/api/progress/srs/due/?limit=20`

```json
{"cards": [{"id": 1, "french": "...", "english": "...", "pronunciation": "...",
            "example_sentence": "...", "ease_factor": 2.5, "interval_days": 0,
            "next_review_at": "...", "repetitions": 0, "last_quality": 0}],
 "count": 1}
```

Not DRF-paginated. Language-scoped via `vocabulary__language`.

### POST `/api/progress/srs/review/`

| | |
|---|---|
| Request | `{card_id: int, quality: int 0..5}` |
| 200 | Updated card (same shape as above) |
| 400 | Validation errors (e.g. quality out of range) |
| 404 | `{"detail": "Card not found."}` |

### GET `/api/progress/mistakes/?type=<mistake_type>&reviewed=true|false`

DRF-paginated (`{count, next, previous, results}`, 20 per page). Items: `{id, question_prompt (null if question deleted), user_answer, correct_answer, mistake_type, created_at, reviewed}`. Not language-scoped.

### POST `/api/progress/mistakes/reviewed/`

| | |
|---|---|
| Request | `{mistake_ids: [int]}` (1-100 items) |
| 200 | `{updated: int}` |
| 400 | Validation errors |

### POST `/api/progress/conjugation/check/`

| | |
|---|---|
| Request | `{verb, tense, subject, answer}` (all required, non-blank) |
| 200 | `{is_correct: bool, correct_answer: str, explanation: str}` |
| 400 | `{"detail": "verb, tense, subject, and answer are all required."}` |
| 404 | `{"detail": "No conjugation data found for this combination."}` |

### GET `/api/progress/conjugation/verbs/`

`{verbs: [str], tenses: [str]}`, both sorted. Not language-scoped.

### POST `/api/progress/lessons/{lesson_id}/complete/`

| | |
|---|---|
| Request | `{score: int, total_questions: int}` (both optional, default 0) |
| 200 | `{completed: true, first_time: bool, xp_earned: 50 or 0, next_lesson: {id, title, type} or null}` |
| 404 | `{"detail": "Lesson not found."}` |

Not language-scoped.

### GET `/api/progress/topics/{topic_id}/`

| | |
|---|---|
| 200 | `{topic_id, total_lessons, completed_lessons, completed_lesson_ids: [int]}` |
| 404 | `{"detail": "Topic not found."}` |

Not language-scoped.

## 5. Business rules & invariants

### SM-2 (`sm2_update` in `apps/progress/services.py`)

| Parameter | Value |
|-----------|-------|
| Quality range | 0-5; outside raises `ValueError` (API validates first). |
| EF update | `EF' = max(1.3, EF + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))`, applied on every review. |
| Lapse threshold | `q < 3` -> `repetitions = 0`, `interval = 1`. |
| Intervals on success | 1st: 1 day; 2nd: 6 days; nth: `round(prev_interval * EF')`. |
| Next review | `now + interval_days` (UTC). |
| Mastered (trend report) | `interval_days >= 21`. |

### Mistake classification

`classify_mistake(question)`: question type `conjugation` -> `conjugation`; anything else or no question -> `other`. The conjugation endpoint passes `mistake_type="conjugation"` explicitly.

### XP

| Action | Activity type | XP | `source_id` |
|--------|---------------|----|-------------|
| SRS review | `srs_review` | 10 per review | `srs_card_<id>_<repetitions after review>` |
| Correct conjugation check | `conjugation_drill` | 10 | `conjugation_<question_id>` |
| First lesson completion | `lesson_complete` | 50 | `lesson_<lesson_id>` |

Each of these also calls `check_streak`. Expected invariant: one award per distinct source; today only lesson completion honours it (by awarding only when the row is created).

### Conjugation answer comparison

`answer.strip().lower() == correct_answer.strip().lower()`. No accent or typo tolerance.

## 6. Background jobs

No Celery tasks. Management commands:

| Command | Effect | Idempotency |
|---------|--------|-------------|
| `seed_conjugations` | Creates topic "Conjugaison", lesson "Verb Conjugation Drills", and one question per verb x tense x subject (36 verbs) | `get_or_create` on topic `name_fr`, lesson title, and `(lesson, type, prompt)` |
| `seed_flashcards [--username U]` | Creates an `SRSCard` for every `Vocabulary` row for every user (or user `U`), due now | `get_or_create` per pair |

## 7. Dependencies

| Dependency | Use |
|------------|-----|
| `apps.content` | `Vocabulary`, `Question`, `Lesson`, `Topic` |
| `apps.gamification.services` | `award_xp`, `check_streak` |
| Callers of `record_mistake` | `apps.practice` |
| Other creators of `SRSCard` | `apps.notes` (send-to-flashcards) |
| Readers | `apps.gamification` trend report, `services/memory/context.py` |

## 8. Deviations / open questions

| # | Item |
|---|------|
| D-1 | XP awards are not idempotent: every SRS review POST awards 10 XP (cards need not be due), and every repeated correct conjugation check awards 10 XP again. |
| D-2 | Conjugation lookup matches `verb`, `tense` and `subject` as case-insensitive substrings of the prompt and takes the first match by id. Colliding inputs pick the wrong question: `voir` matches `avoir`, `pouvoir`, `devoir`, `savoir`, `recevoir`; `prendre` matches `comprendre`, `apprendre`; subject `tu` matches every `futur_simple` prompt. |
| D-3 | Conjugation endpoints, mistakes, lesson completion and topic progress are not filtered by `target_language`. |
| D-4 | Lesson completion accepts client-reported `score` and `total_questions` without type or range validation; non-integers or negatives produce a server error. The server-graded `QuizSession` score is not used. |
| D-5 | Lessons and quizzes never create SRS cards; new users have none unless `seed_flashcards` is run or the notes flow is used. Intended product behaviour is unclear. |
| D-6 | `seed_flashcards` covers all languages and runs one `get_or_create` per pair. |
| D-7 | EF is reduced on lapses; classic SM-2 leaves EF unchanged on a lapse. Intent unclear. |
| D-8 | The Grammar Booster has a separate SM-2-like scheduler (`apps/grammar/scoring.py`, float intervals) instead of reusing the canonical one in `apps/progress/services.py`. |
| D-9 | `ConjugationListView` parses every conjugation prompt on each request. |
| D-10 | Non-numeric or negative `limit` on `srs/due/` produces a server error. |
| D-11 | Missing composite indexes: `SRSCard(user, next_review_at)`, `MistakeEntry(user, created_at)`, `MistakeEntry(user, reviewed)`. |
| D-12 | `get_or_create_card` and `LessonCompletionSerializer` are unused. |
| D-13 | README endpoint table omits `lessons/{id}/complete/` and `topics/{id}/`. |
