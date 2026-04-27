# Phase 14 — Exam Prep (TCF / TEF)

**Date:** 2026-04-26
**Status:** Shipped
**App:** `apps.exam_prep`

## Why

Lingaru's audience includes intermediate learners preparing for **TCF** (Test de connaissance du français) or **TEF Canada**. Those exams have well-defined sections (Compréhension orale, Compréhension écrite, Lexique & grammaire, Expression écrite, Expression orale) and learners benefit from realistic timed practice, a week-by-week plan, and a record of past mocks.

## Scope

- Diagnostic + targeted practice across 5 sections (CO / CE / Lex-Gram / Écrite / Orale)
- Section-by-section drills (untimed) and full mocks (timed)
- Mocks history with score sparkline and review screen
- Tagged weak topics surfaced from the mistake journal
- Recommended materials (RFI, Le Monde, etc.)

## Models

- `ExamSection` — id, code (`CO | CE | LG | EE | EO`), title_fr, exam_target (`TCF | TEF`)
- `ExamExercise` — section FK, level, type (`mcq | listen | read | write | speak`), prompt, options (JSON), correct_answer, audio_url (optional)
- `ExamSession` — user, exam (`tcf | tef`), mode (`section_drill | mock`), section FK (nullable for full mocks), started_at, completed_at, total_score
- `ExamResponse` — session FK, exercise FK, user_answer, is_correct, score (for AI-graded writing/speaking)

## Endpoints (`/api/exam-prep/`)

| Method | Path | Purpose |
|---|---|---|
| GET | `hub/` | Countdown, readiness gauge, week plan, weak topics |
| GET | `exercises/` | Filter by `exam`, `section`, `level` |
| POST | `sessions/start/` | `{ exam, section?, mode }` |
| POST | `sessions/{id}/respond/` | Submit a single answer |
| POST | `sessions/{id}/complete/` | Score + persist |
| GET | `sessions/history/` | Past sessions with score sparkline |

## Frontend

- `ExamPrepHub` — countdown hero (J−47 by default; reads `user.preferences.exam_days_left`), readiness gauge, 5-section breakdown with mini sparklines, 6-week plan, mocks history, weak topics, materials, strategies (cards stacked vertically; Strategies expands into a 6-col grid at large widths)
- `ExamSection` — list of exercises for one section
- `ExamExercise` — timed mock UI: chrono, audio player with play counter, A/B/C/D choices, flag-for-review, paginated navigator. Post-mock review screen: score hero, section deltas, insights, question-by-question heatmap with filters, weak topics surfaced from this mock
