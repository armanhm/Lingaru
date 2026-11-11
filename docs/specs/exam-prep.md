# Spec: Exam Prep

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Exam Prep](../wiki/Exam-Prep.md)

## 1. Purpose & scope

**In scope:**
- `backend/apps/exam_prep/`:
  - TCF/TEF practice for the CO, CE, EE and EO sections
  - sessions, answers and asynchronous LLM grading for EE and EO
  - progress and XP
  - the seed commands

**Out of scope:**
- XP and streak internals (gamification).
- TTS internals.
- LLM provider internals.
- The frontend exam UI (countdown and timers are client-side).

## 2. Requirements

| ID | Requirement |
|---|---|
| FR-1 | The hub returns, for each section CO, CE, EE and EO (in that order): its label, the number of active exercises in the user's `target_language`, and the user's `sessions_completed`, `best_score_pct` and `estimated_cefr`. Values default to 0 or "" when there is no progress yet. |
| FR-2 | The exercise list returns active exercises in the user's language, optionally filtered by `section` and `level`. Ordering is `order`, then `cefr_level`. |
| FR-3 | Starting a session requires a valid `section` and `cefr_level`; `mode` defaults to `practice`. With no matching active exercises in the user's language, the response is 404. |
| FR-4 | Starting a CO session attaches `content.audio_url` (absolute URL) to each exercise from TTS of `passage_fr`. A TTS failure is ignored. The URL is not persisted. |
| FR-5 | The session `max_score` is the total number of questions for CO and CE, and 20 × the number of exercises for EE and EO. `time_limit_seconds` is the sum of the exercise limits in `mock` mode and 0 in `practice` mode. |
| FR-6 | Responding to a completed session returns 400. Responding to another user's session returns 404. The exercise must exist in the user's language, otherwise 404. |
| FR-7 | CO and CE answers are graded synchronously. Correct means the trimmed, case-insensitive answer equals `correct_answer`; it scores 1, otherwise 0, with max 1. An out-of-range `question_index` returns 400. |
| FR-8 | EE and EO answers are stored as `pending` with `max_score=20` and a pre-generated `grading_task_id`. `grade_response` is queued after the transaction commits, and the response is 202 with a `poll_url`. |
| FR-9 | `grade_response` is idempotent once a response is `done`. On success it stores `score`, `max_score`, the grading JSON in `ai_feedback`, `grading_status=done` and `grading_completed_at`. After the final retry fails it stores `failed` with an error JSON. |
| FR-10 | The grading poll endpoint returns the response's status. It includes the parsed grading when the status is `done`, and only works for the owner. |
| FR-11 | Completing a session sums response scores and max scores, sets `completed_at`, awards XP, calls `check_streak` and updates `ExamProgress`. A second completion returns 400. |
| FR-12 | History returns the user's 20 most recent completed sessions, optionally filtered by `section`. |

## 3. Data model

### `ExamExercise` (`exam_prep_exercises`)

| Field | Type | Notes |
|---|---|---|
| `section` | Char(2) | CO, CE, EE, EO |
| `cefr_level` | Char(2) | A1..C2 |
| `title` | Char(300) | |
| `instructions_fr`, `instructions_en` | Text | |
| `content` | JSON | CE `{text_fr, text_en?, questions[{prompt, options[], correct_answer, explanation?}]}`; CO `{passage_fr, questions[...]}`; EE `{prompt_fr, prompt_en, word_limit, rubric}`; EO `{prompt_fr, prompt_en, duration_seconds, rubric}` |
| `time_limit_seconds` | PositiveInt | default 0 |
| `order` | PositiveInt | |
| `is_active` | Bool | default true |
| `created_at` | DateTime | |
| `language` | Char(8) | fr or en, default fr, indexed |

Ordering: `order`, `cefr_level`.

### `ExamSession` (`exam_prep_sessions`)

- Fields: `user` FK (cascade), `section`, `cefr_level`, `mode` (`practice` or `mock`), `started_at`, `completed_at` (null), `score` Float (null), `max_score` Float (null), `time_limit_seconds`.
- Ordering: `-started_at`.
- No `language`.

### `ExamResponse` (`exam_prep_responses`)

- Fields: `session` FK, `exercise` FK, `question_index`, `user_answer` Text, `is_correct` Bool (null), `ai_feedback` Text (JSON string), `score` Float (default 0), `max_score` Float (default 1), `answered_at`.
- Grading fields: `grading_status` Char(16), indexed, one of `not_required` (default), `pending`, `done`, `failed`; `grading_task_id` Char(64); `grading_completed_at`.
- No uniqueness on `(session, exercise, question_index)`.

### `ExamProgress` (`exam_prep_progress`)

- Fields: `user` FK, `section`, `best_score_pct` Float, `exercises_completed` (unused), `sessions_completed`, `estimated_cefr_level`, `updated_at`.
- Unique `(user, section)`.
- No `language`.

## 4. API contract

Base path `/api/exam-prep/`. Every endpoint requires `IsAuthenticated`. None are paginated.

| Method | Path | Request | Responses |
|---|---|---|---|
| GET | `hub/` | n/a | 200 `{sections: [{code, label, exercise_count, sessions_completed, best_score_pct, estimated_cefr}]}` |
| GET | `exercises/?section=&level=` | n/a | 200 `[{id, title, section, cefr_level, time_limit_seconds, question_count}]` |
| POST | `sessions/start/` | `{section: CO\|CE\|EE\|EO, cefr_level: A1..C2, mode?: practice\|mock}` | 201 `{session_id, section, cefr_level, mode, time_limit_seconds, exercises: [{id, title, section, cefr_level, instructions_fr, instructions_en, content, time_limit_seconds}]}`; 400 validation; 404 `{"detail": "No exercises available for this section and level."}` |
| POST | `sessions/<session_id>/respond/` | `{exercise_id: int, question_index: int, answer: str}` | CO/CE: 200 `{is_correct, score, max_score, ai_feedback, question_index, correct_answer, explanation}`. EE/EO: 202 `{response_id, grading_status: "pending", poll_url}`. 400 for a completed session, invalid question index or unsupported section. 404 when the session or exercise is not found. |
| GET | `responses/<response_id>/grading/` | n/a | 200 `{response_id, status, score, max_score, grading?}` (`grading` when `done`; `detail` when `failed`); 404 when not the owner or not found |
| POST | `sessions/<session_id>/complete/` | n/a | 200 `{id, section, cefr_level, mode, score, max_score, percentage, cefr_estimate, started_at, completed_at, xp_earned}`; 400 already completed; 404 |
| GET | `sessions/history/?section=` | n/a | 200 `[{id, section, cefr_level, mode, score, max_score, percentage, started_at, completed_at}]` (most recent 20) |

## 5. Business rules & invariants

| Rule | Value |
|---|---|
| XP on completion | `practice` 15, `mock` 30; +50 when percentage == 100; `activity_type = "exam_<section>_<mode>"` |
| Percentage | `round(score / max_score × 100, 1)` in serializers; the completion view uses unrounded `score / Σmax × 100` for XP and progress |
| CEFR estimate | ≥95 C2, ≥85 C1, ≥75 B2, ≥65 B1, ≥50 A2, ≥30 A1, else "" |
| Progress | `best_score_pct` only increases; `estimated_cefr_level` follows the best score |
| Grading retries | `autoretry_for=(Exception,)`, `max_retries=2`, `retry_backoff=True`, `retry_backoff_max=60` |
| Grading scale | 0-20 per EE/EO response (from the prompt) |
| Task id | pre-generated UUID4, stored before queueing |

## 6. Background jobs

| Name | Type | Notes |
|---|---|---|
| `exam_prep.grade_response(response_id)` | Celery task, bound | Queued from `respond` with `transaction.on_commit`. Not scheduled. |
| `seed_exam_exercises` | mgmt cmd | Initial CE/CO/EE/EO set; `get_or_create(section, cefr_level, title)` |
| `seed_exam_all_levels` | mgmt cmd | A1-C2 set across all sections, same keying |

## 7. Dependencies

- `gamification.services.award_xp` and `check_streak`.
- `services.tts.service.get_or_create_audio` (CO audio).
- `services.llm.factory.create_llm_router` and `services.llm.prompts` (`exam_ee_grading`, `exam_eo_grading` per language).
- Celery and Redis.

## 8. Deviations / open questions

| # | Deviation |
|---|---|
| D-1 | `tasks.grade_response` reads `SYSTEM_PROMPTS.get(prompt_key, "")`, but `SYSTEM_PROMPTS` is keyed by language first, so the system prompt is always empty. It should call `get_system_prompt(exercise.language, prompt_key)`. Tests do not assert the prompt. |
| D-2 | The grading `score`/`max_score` from the LLM are saved without type or range checks. A save error happens outside the retry handler and can leave a response `pending`. |
| D-3 | Session scoring is not idempotent: responses are not unique per `(session, exercise, question_index)`. The completion percentage uses the sum of answered `max_score` rather than `session.max_score`. Completion awards base XP even with zero responses. |
| D-4 | Completion is allowed while EE/EO responses are still `pending`, and the score is never recomputed after grading finishes. |
| D-5 | `respond` does not check that the exercise belongs to the session's section or level. |
| D-6 | `ExamSession` and `ExamProgress` have no `language`, so FR and EN progress are merged. |
| D-7 | `ExamProgress.exercises_completed` is never written. |
| D-8 | CO audio is generated synchronously at session start and is hard-coded to French TTS. |
| D-9 | Exercise content is Python literals in two seed commands with duplicated logic, and edits do not update existing rows (`get_or_create`). Content plan Phase 4 (`data/exam_prep_fr.json`) is not started. |
| D-10 | The README hub description (countdown, readiness gauge, week plan, weak topics; filter by exam) does not match the API. |
