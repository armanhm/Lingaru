# Spec: Practice (Lesson Quizzes)

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Practice and Quizzes](../wiki/Practice-and-Quizzes.md)

## 1. Purpose & scope

**In scope:** quiz sessions over a lesson's `Question`s: start, per-question answer grading, completion with scoring and XP, history, and random lesson selection. The answer-matching function `answers_match`.

**Out of scope:** question authoring (see [content](content.md)), mistake journal storage (see [progress-srs](progress-srs.md)), XP, streak and badge logic (see [gamification](gamification.md)), client-side mini-games, Grammar Booster drills and exam practice.

## 2. Requirements

| ID | Requirement |
|----|-------------|
| FR-1 | An authenticated user can start a quiz for any existing lesson that has at least one question; the session records how many questions the lesson had. |
| FR-2 | Starting a quiz returns all of the lesson's questions. MCQ questions with distractors include shuffled `options`; other types return an empty `options` list. |
| FR-3 | A user can answer each question of their own open session once. A second answer to the same question in the same session is rejected with `400`. |
| FR-4 | Answers are graded with `answers_match` (case, leading French article, accents and one-character typos tolerated, see section 5). |
| FR-5 | The answer response reveals correctness, the correct answer, the explanation and the submitted answer. |
| FR-6 | A wrong answer creates a `MistakeEntry` for the user via `progress.services.record_mistake`. |
| FR-7 | Completing a session sets `score` (number of correct answers) and `completed_at`, awards XP and updates the streak. A completed session cannot be answered or completed again (`400`). |
| FR-8 | Sessions belonging to another user are reported as not found (`404`). |
| FR-9 | Quiz history lists the user's sessions, newest first, paginated. |
| FR-10 | Random lesson returns a lesson with at least one question and no conjugation questions, or `404` if none. |

## 3. Data model

### `QuizSession` (`practice_quiz_sessions`), ordering `["-started_at"]`

| Field | Type | Notes |
|-------|------|-------|
| `user` | FK `users.User`, `CASCADE`, related `quiz_sessions` | |
| `lesson` | FK `content.Lesson`, `CASCADE`, related `quiz_sessions` | |
| `started_at` | `DateTimeField(auto_now_add)` | |
| `completed_at` | `DateTimeField`, nullable | Null while the session is open. |
| `score` | `PositiveIntegerField`, nullable | Set on completion. |
| `total_questions` | `PositiveIntegerField` | Question count at start. |

### `QuizAnswer` (`practice_quiz_answers`)

| Field | Type | Notes |
|-------|------|-------|
| `session` | FK `QuizSession`, `CASCADE`, related `answers` | |
| `question` | FK `content.Question`, `CASCADE`, related `quiz_answers` | |
| `user_answer` | `TextField` | |
| `is_correct` | `BooleanField` | |
| `answered_at` | `DateTimeField(auto_now_add)` | |

Constraint: `UniqueConstraint(session, question)` named `unique_answer_per_question`. No other indexes beyond FKs.

No `language` field: sessions inherit the language of their lesson.

## 4. API contract

Base path `/api/practice/`. All endpoints require an authenticated user.

### POST `/api/practice/quiz/start/`

| | |
|---|---|
| Request | `{lesson_id: int}` |
| 201 | `{session_id: int, questions: [question]}`; question objects per `QuizQuestionSerializer` in `apps/practice/serializers.py`: `id`, `type`, `prompt`, `difficulty`, `options` (shuffled list for MCQ, else `[]`) and the fields the client quiz UI needs. |
| 400 | `{"lesson_id": ["Lesson not found."]}` or `{"detail": "This lesson has no questions available."}` |

Language scoping: none today (see D-2).

### POST `/api/practice/quiz/{session_id}/answer/`

| | |
|---|---|
| Request | `{question_id: int, answer: str (non-empty)}` |
| 200 | `{is_correct: bool, correct_answer: str, explanation: str, user_answer: str}` |
| 400 | `{"detail": "This quiz is already completed."}`, `{"detail": "This question was already answered."}`, or field validation errors |
| 404 | `{"detail": "Quiz session not found."}` (missing or other user's) or `{"detail": "Question not found."}` |

### POST `/api/practice/quiz/{session_id}/complete/`

| | |
|---|---|
| Request | empty |
| 200 | `{id, lesson_title, score, total_questions, started_at, completed_at}` |
| 400 | `{"detail": "This quiz is already completed."}` |
| 404 | `{"detail": "Quiz session not found."}` |

### GET `/api/practice/quiz/history/`

DRF `PageNumberPagination` (20 per page, `?page=`):

```json
{"count": 3, "next": null, "previous": null,
 "results": [{"id": 7, "lesson_id": 12, "lesson_title": "...", "score": 4,
              "total_questions": 5, "started_at": "...", "completed_at": "..."}]}
```

Open sessions appear with `score` and `completed_at` null. Not language-scoped.

### GET `/api/practice/quiz/random-lesson/`

| Status | Body |
|--------|------|
| 200 | `{lesson_id: int, title: str}` |
| 404 | `{"detail": "No quizzes available."}` |

Language scoping: none today (see D-2).

## 5. Business rules & invariants

### Answer matching (`answers_match(user_answer, correct_answer)` in `apps/practice/views.py`)

Both strings are normalised (trim, lowercase, remove at most one leading `l'`, `le `, `la `, `les `, `un `, `une `). The answer is correct if any of these holds:

1. Normalised strings are equal.
2. Accent-stripped (Unicode NFD, combining marks removed) strings are equal.
3. The normalised correct answer has 4+ characters and the Levenshtein distance is at most 1.
4. Same as 3 on the accent-stripped strings.

### Scoring and XP

| Event | Rule |
|-------|------|
| Score | `count(QuizAnswer where is_correct)` for the session, computed at completion. |
| `quiz_correct` XP | `5 x score`, only when `score > 0`. `source_id = "quiz_session_<id>"`. |
| `quiz_perfect` XP | `25` when `score == total_questions` and `total_questions > 0`. Same `source_id`. |
| Streak | `check_streak(user)` on every completion. |
| Badges | Evaluated inside `award_xp`; `quizzes_completed` and `perfect_quizzes` badges count completed sessions. |

### Invariants expected

| Invariant | Status today |
|-----------|--------------|
| One answer per question per session | Enforced by DB constraint and an explicit check. |
| Answered questions belong to the session's lesson | Not enforced (D-1). |
| `score <= total_questions` | Not guaranteed (follows from D-1). |
| XP for a session is awarded once | Relies on the `completed_at` check without a lock (D-3). |

## 6. Background jobs

None.

## 7. Dependencies

| Dependency | Use |
|------------|-----|
| `apps.content` | `Lesson`, `Question` |
| `apps.progress.services.record_mistake` | Mistake journal on wrong answers |
| `apps.gamification.services.award_xp`, `check_streak` | XP and streak on completion |
| `apps.gamification` badges | Read `QuizSession` counts |
| Frontend | `frontend/src/api/practice.js`, `frontend/src/pages/RandomQuiz.jsx` |

## 8. Deviations / open questions

| # | Item |
|---|------|
| D-1 | The answer endpoint does not verify that `question_id` belongs to the session's lesson, so a session can collect answers (and score, and XP) from other lessons. |
| D-2 | `quiz/start/` and `quiz/random-lesson/` are not filtered by `target_language`; a learner can be served a quiz in the other language. |
| D-3 | Completion is not atomic: two concurrent completions of one session can both award XP. |
| D-4 | Two concurrent answers to the same question can surface the unique-constraint violation as a server error instead of `400`. |
| D-5 | Accent and one-typo tolerance also applies to `conjugation` and gender-sensitive questions, where the accent or ending is the skill being tested. Intent unclear. |
| D-6 | `answers_match` lives in `views.py`; conjugation checks in the progress app use a different exact comparison. |
| D-7 | Quiz completion does not create a `LessonCompletion`; the client calls the progress endpoint separately with its own score. |
| D-8 | Completion responses do not report XP earned or new badges. |
| D-9 | README endpoint table omits `quiz/random-lesson/`. |
| D-10 | `QuizStartView` issues three queries for the question set (`exists`, `count`, list). |
