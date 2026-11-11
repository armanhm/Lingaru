# Spec: Gamification

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Gamification](../wiki/Gamification.md)

## 1. Purpose & scope

**In scope:** XP ledger and totals, levels, daily streaks, badges, leaderboard, XP history, the weekly trend (coach) report, mini-game score submission, and the `award_xp` / `check_streak` service API used by other apps.

**Out of scope:** what each feature awards (owned by the calling app, listed in section 5 for reference), frontend mini-game logic.

## 2. Requirements

| ID | Requirement |
|----|-------------|
| FR-1 | Every XP award is recorded as an `XPTransaction` with an activity type, amount and optional source reference. |
| FR-2 | `UserStats.total_xp` equals the sum of the user's transactions, and `level` is the highest `LEVEL_THRESHOLDS` index whose minimum XP is reached. |
| FR-3 | After each award, every not-yet-earned badge is evaluated and newly met badges are granted once per user. |
| FR-4 | The streak increases by 1 on the first activity of a day that directly follows the last active day, resets to 1 after a gap, and is unchanged for repeated activity on the same day. `longest_streak` never decreases. |
| FR-5 | The stats endpoint returns the user's stats with `level_name` and `rank` (1 + number of users with strictly more XP), creating an empty stats row on first access. |
| FR-6 | The badges endpoint returns the user's earned badges (newest first) and all remaining badges. |
| FR-7 | The leaderboard lists users with a stats row by `total_xp` descending, 50 per page. |
| FR-8 | XP history lists the user's transactions newest first, 20 per page, with a human-readable description. |
| FR-9 | The trend report summarises the last 7 days and returns rule-based insights (section 5). |
| FR-10 | Mini-game score submission accepts one of five known games and awards `2 x score` XP for a positive score. |

## 3. Data model

### `UserStats` (`gamification_user_stats`)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `user` | `OneToOneField(users.User)`, `CASCADE`, related `stats` | | Created lazily by `get_or_create_stats`. |
| `total_xp` | `PositiveIntegerField` | 0 | |
| `level` | `PositiveIntegerField` | 0 | Index into `LEVEL_THRESHOLDS` (0-5). |
| `current_streak` | `PositiveIntegerField` | 0 | |
| `longest_streak` | `PositiveIntegerField` | 0 | |
| `streak_freeze_available` | `BooleanField` | False | Exposed by the API; not used by any logic. |
| `last_active_date` | `DateField`, nullable | | |

### `XPTransaction` (`gamification_xp_transactions`), ordering `["-created_at"]`

| Field | Type | Notes |
|-------|------|-------|
| `user` | FK `users.User`, `CASCADE`, related `xp_transactions` | |
| `activity_type` | `CharField(50)` | Free text (section 5). |
| `xp_amount` | `PositiveIntegerField` | |
| `source_id` | `CharField(100)`, nullable | Free-text reference; no uniqueness. |
| `created_at` | `DateTimeField(auto_now_add)` | |

### `Badge` (`gamification_badges`)

`name` `CharField(100)` unique, `description` `TextField`, `icon` `CharField(50)` (icon key such as `trophy`), `criteria_type` `CharField(50)`, `criteria_value` `PositiveIntegerField`.

### `UserBadge` (`gamification_user_badges`)

`user` FK (`CASCADE`, related `earned_badges`), `badge` FK (`CASCADE`, related `holders`), `earned_at` auto. Constraint `unique_user_badge` on `(user, badge)`.

No custom indexes. No `language` fields: XP, streaks and badges are global across target languages.

## 4. API contract

Base path `/api/gamification/`. All endpoints require an authenticated user.

### GET `/api/gamification/stats/`

```json
{"total_xp": 120, "level": 1, "level_name": "Explorateur", "current_streak": 3,
 "longest_streak": 5, "streak_freeze_available": false,
 "last_active_date": "2026-11-10", "rank": 4}
```

### GET `/api/gamification/badges/`

```json
{"earned": [{"id": 3, "name": "First Quiz", "description": "...", "icon": "trophy", "earned_at": "..."}],
 "available": [{"id": 4, "name": "...", "description": "...", "icon": "...",
                "criteria_type": "streak_days", "criteria_value": 7}]}
```

`earned[].id` is the `UserBadge` id; `available[].id` is the `Badge` id.

### GET `/api/gamification/leaderboard/?page=N`

DRF pagination envelope, 50 per page: `{count, next, previous, results: [{username, total_xp, level, current_streak}]}`. Not language-scoped.

### GET `/api/gamification/history/?page=N`

DRF pagination envelope, 20 per page: `results: [{id, activity_type, description, xp_amount, source_id, created_at}]`.

### GET `/api/gamification/trend/`

```json
{"week": {"total_xp": 0, "lessons_completed": 0, "avg_score_pct": null, "mistakes": 0,
          "daily_xp": [{"date": "2026-11-05", "xp": 0}, "... 7 entries, oldest first"]},
 "srs": {"total": 0, "due": 0, "mastered": 0},
 "streak": 0, "level": 0,
 "top_activities": [{"activity_type": "...", "total": 0, "count": 0}],
 "top_mistake_types": [{"mistake_type": "...", "n": 0}],
 "sample_mistakes": [{"user_answer": "...", "correct_answer": "...", "mistake_type": "..."}],
 "insights": [{"type": "warn|ok|great|tip", "text": "..."}]}
```

`top_activities` has at most 4 entries, `top_mistake_types` and `sample_mistakes` at most 3.

### POST `/api/gamification/mini-game/score/`

| | |
|---|---|
| Request | `{game: "word_scramble"|"match_pairs"|"gender_snap"|"speed_round"|"missing_letter", score: int, total: int}` |
| 200 (score <= 0) | `{xp_earned: 0}` |
| 200 (score > 0) | `{xp_earned: score * 2, total_xp: int}` |
| 400 | `{"detail": "Invalid game."}` |

### Service API (`apps/gamification/services.py`)

| Function | Contract |
|----------|----------|
| `award_xp(user, activity_type, xp_amount, source_id=None) -> (UserStats, XPTransaction, list[UserBadge])` | Atomic. Inserts a transaction, adds to `total_xp`, recomputes `level`, runs `check_badges`. |
| `check_streak(user, today=None) -> UserStats` | Applies the streak rule (FR-4) for `today` (default `date.today()`). |
| `check_badges(user) -> list[UserBadge]` | Grants newly met badges. |
| `get_level(total_xp) -> (name, index)` | Pure lookup in `LEVEL_THRESHOLDS`. |
| `get_or_create_stats(user) -> UserStats` | Lazy creation. |

## 5. Business rules & invariants

### Levels

| Index | Min XP | Name |
|-------|--------|------|
| 0 | 0 | Debutant |
| 1 | 100 | Explorateur |
| 2 | 500 | Apprenti |
| 3 | 1500 | Intermediaire |
| 4 | 5000 | Avance |
| 5 | 10000 | Expert |

### Badge criteria (`_evaluate_badge`)

| `criteria_type` | Met when |
|-----------------|----------|
| `total_xp` | `total_xp >= value` |
| `level` | `total_xp >= value` (value is an XP threshold) |
| `streak_days` | `current_streak >= value` |
| `quizzes_completed` | count of the user's `QuizSession` with `completed_at` set `>= value` |
| `perfect_quizzes` | count of completed sessions with `score = total_questions` `>= value` |
| `ai_conversations` | count of the user's assistant `Conversation`s with 5+ messages `>= value` |
| anything else | never |

Default badges (`DEFAULT_BADGES`, seeded by `seed_badges`): First Quiz (1 quiz), Quiz Master (50), Perfect Score (1), Week Warrior (7-day streak), Month Master (30), XP Collector (1000 XP), XP Legend (10000), Conversationalist (10 conversations), Apprenti (level, 500 XP), Expert (level, 10000 XP).

### XP sources (amounts are set by callers)

| Activity type | Amount | Caller | Source id | De-dup today |
|---------------|--------|--------|-----------|--------------|
| `quiz_correct` | 5 x correct | practice | `quiz_session_<id>` | Session `completed_at` check |
| `quiz_perfect` | 25 | practice | `quiz_session_<id>` | same |
| `lesson_complete` | 50 | progress | `lesson_<id>` | Only on first `LessonCompletion` |
| `srs_review` | 10 | progress | `srs_card_<id>_<reps>` | None |
| `conjugation_drill` | 10 | progress | `conjugation_<question_id>` | None |
| `mini_game_<game>` | 2 x score | gamification | none | None |
| `ai_conversation` | 15 | assistant | `conversation_<id>` | Fires when the user message count is exactly 5 |
| `pronunciation` | 5 | media | `pronunciation_<attempt_id>` | One per attempt |
| `dictation` | 15 | media | `dictation_clip_<clip_id>` | None |
| `discover_interact` | 3 | discover | `<card_id>` | `UserDiscoverHistory.interacted` |
| `grammar_<mode>` | 3 x correct + 10 if perfect | grammar | none | Session completion |
| `exam_<section>_<mode>` | 15 practice / 30 mock, +50 if 100% | exam_prep | none | Session completion |

Labels for the history view come from `ACTIVITY_LABELS` in `apps/gamification/serializers.py`; unknown types are rendered by title-casing the type.

### Trend report rules

Window: `now - 7 days` to now (UTC). `avg_score_pct = round(avg(score) / avg(total_questions) * 100)` over lesson completions in the window, `null` if none. SRS `due` = `next_review_at <= now`; `mastered` = `interval_days >= 21`.

| Condition | Insight `type` |
|-----------|----------------|
| Weekly XP == 0 | warn |
| Weekly XP >= 200 | great |
| otherwise | ok |
| Streak >= 7 / >= 3 / == 0 | great / ok / warn (nothing for 1-2) |
| Mistakes > 0 | tip (names top type) |
| Mistakes == 0 | great |
| SRS due > 5 | warn |
| else mastered > 0 | great |
| Top activity `conjugation_drill` and 0 lessons | tip |
| else lessons >= 3 | great |

### Expected invariants

| Invariant | Status today |
|-----------|--------------|
| At most one XP award per (user, activity, source) | Not enforced (D-1). |
| `total_xp` equals the ledger sum under concurrency | Not guaranteed (D-3). |
| Displayed streak reflects missed days | Not guaranteed (D-4). |

## 6. Background jobs

No Celery tasks or beat entries. Management command `seed_badges`: `get_or_create` by `name` for each `DEFAULT_BADGES` entry (existing badges are not updated).

## 7. Dependencies

| Dependency | Use |
|------------|-----|
| `apps.practice.models.QuizSession` | Quiz badges |
| `apps.assistant.models.Conversation` | Conversation badge |
| `apps.progress.models` | Trend report (lesson completions, mistakes, SRS cards) |
| Callers of `award_xp` / `check_streak` | practice, progress, assistant, grammar, exam_prep, media, discover, gamification |

## 8. Deviations / open questions

| # | Item |
|---|------|
| D-1 | XP awards are not idempotent: `source_id` is neither unique nor checked, so de-duplication depends on each caller (see table above). |
| D-2 | Mini-game XP is derived from the client-reported `score`, which is not bounded by `total` or capped; non-numeric values produce a server error. |
| D-3 | `award_xp` updates `total_xp` by read-modify-write without a row lock, and `check_streak` saves the whole stats row, so concurrent activity can lose XP. |
| D-4 | Streaks are only recomputed on activity; stats, leaderboard and trend show the old streak after missed days. No beat job exists. |
| D-5 | `check_streak` uses `date.today()` (server local date) rather than `timezone.localdate()` or the learner's time zone. |
| D-6 | Callers run `award_xp` before `check_streak`, so streak badges are granted one activity late. |
| D-7 | `check_badges` issues several count queries on every award; perfect-quiz counting uses `QuerySet.extra()`. |
| D-8 | Trend SRS counts are not filtered by `target_language`, so `srs.due` can differ from `/api/progress/srs/due/`. The view issues about 13 queries and buckets daily XP in Python. |
| D-9 | XP amounts are hard-coded at call sites; `XP_VALUES`, `DAILY_STREAK_CAP` and `streak_freeze_available` are unused. |
| D-10 | `ACTIVITY_LABELS` lists unused types (`streak_bonus`, `daily_bonus`, `voice_chat`, `document_upload`, `video_lesson`) and lacks emitted ones (`mini_game_*`, `discover_interact`, `grammar_*`, `exam_*`). |
| D-11 | The `level` badge criteria duplicate `total_xp`. |
| D-12 | Activity endpoints across apps report XP inconsistently and never return newly earned badges. |
| D-13 | `LeaderboardPagination.max_page_size` has no effect because `page_size_query_param` is not set. |
| D-14 | No indexes on `UserStats.total_xp` (rank, leaderboard) or `XPTransaction(user, created_at)` (history, trend). |
| D-15 | README endpoint table omits `trend/` and `mini-game/score/`. |
