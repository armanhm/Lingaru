# Spec: Content

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Content and Lessons](../wiki/Content-and-Lessons.md)

## 1. Purpose & scope

**In scope:** the curriculum tables (`Topic`, `Lesson`, `Vocabulary`, `GrammarRule`, `ReadingText`, `Question`), YouTube video lessons (`VideoLesson`, `VideoVocabulary`, `VideoExpression`), their read APIs, the video-processing Celery task, content admin, and the content seed commands.

**Out of scope:** quiz sessions (see [practice](practice.md)), SRS and conjugation drills (see [progress-srs](progress-srs.md)), Grammar Booster content (`apps/grammar`), Discover cards (`apps/discover`), dictionary (`apps/dictionary`).

## 2. Requirements

| ID | Requirement |
|----|-------------|
| FR-1 | Every content row carries a `language` (`fr`/`en`). Topic list, topic detail, lesson detail and random vocabulary return only rows whose `language` equals `request.user.target_language`. |
| FR-2 | Detail endpoints return `404` for an id that exists only in another language. List endpoints return `200` with only matching rows. |
| FR-3 | Topics are returned ordered by `order`, each with the number of lessons it contains, computed without one query per topic. |
| FR-4 | Topic detail includes its lessons (ordered by `order`) in a compact form. |
| FR-5 | Lesson detail returns the lesson with its topic stub, vocabulary, grammar rules, reading texts, questions and video (or `null`) using a bounded number of queries. |
| FR-6 | Random vocabulary returns up to 20 random words; optional filters keep single words of 3+ characters or gendered (`m`/`f`) nouns only. |
| FR-7 | Staff and superusers can attach or replace a YouTube video on a lesson. The video is processed asynchronously and its `status` moves `pending -> processing -> ready | failed`. |
| FR-8 | Video processing stores the French transcript (required) and the English transcript (optional), extracts 5-10 vocabulary items, 3-5 expressions and 5-8 questions via the LLM, and replaces any previously extracted items. |
| FR-9 | Video-generated questions are marked with a `"[VIDEO] "` prompt prefix and are replaced, not duplicated, on reprocessing. |
| FR-10 | Non-staff users get `403` when attaching a video. |

## 3. Data model

All models use `BigAutoField` ids. `language` is `CharField(8)`, choices `LANGUAGE_CHOICES`, default `"fr"`, `db_index=True`.

### `Topic` (`content_topics`), ordering `["order"]`

| Field | Type | Notes |
|-------|------|-------|
| `name_fr` | `CharField(200)` | Display name in French (also the idempotency key for several seeds). |
| `name_en` | `CharField(200)` | |
| `description` | `TextField` | default `""` |
| `icon` | `CharField(100)` | Emoji. Migration `0004` deleted legacy topics whose icon was an icon-pack name. |
| `order` | `PositiveIntegerField` | Sort key. |
| `difficulty_level` | `PositiveIntegerField` | |
| `language` | see above | |

### `Lesson` (`content_lessons`), ordering `["order"]`

| Field | Type | Notes |
|-------|------|-------|
| `topic` | FK `Topic`, `CASCADE`, related `lessons` | |
| `type` | `CharField(10)` | `vocab`, `grammar`, `text` |
| `title` | `CharField(300)` | |
| `content` | `JSONField` | default `{}`. Free-form; known keys include `description`, `phrases`, `cultural_note`. |
| `order` | `PositiveIntegerField` | |
| `difficulty` | `PositiveIntegerField` | |
| `language` | see above | |

### `Vocabulary` (`content_vocabulary`)

| Field | Type | Notes |
|-------|------|-------|
| `lesson` | FK `Lesson`, `CASCADE`, related `vocabulary` | |
| `french` | `CharField(300)` | Target-language term (historical name). |
| `english` | `CharField(300)` | Gloss. |
| `pronunciation` | `CharField(200)` | default `""` |
| `example_sentence` | `TextField` | default `""` |
| `gender` | `CharField(1)` | `m`, `f`, `n`, `a` (not applicable); default `a` |
| `part_of_speech` | `CharField(50)` | default `""` |
| `audio_url` | `URLField(500)` | nullable |
| `language` | see above | |

### `GrammarRule` (`content_grammar_rules`)

`lesson` FK (related `grammar_rules`, `CASCADE`), `title` `CharField(300)`, `explanation` `TextField`, `formula` `CharField(500)`, `examples` `JSONField(list)`, `exceptions` `JSONField(list)`, `language`.

### `ReadingText` (`content_reading_texts`)

`lesson` FK (related `reading_texts`, `CASCADE`), `title` `CharField(300)`, `content_fr` `TextField`, `content_en` `TextField`, `vocabulary_highlights` `JSONField(list)`, `comprehension_questions` `JSONField(list)`, `language`.

### `Question` (`content_questions`)

| Field | Type | Notes |
|-------|------|-------|
| `lesson` | FK `Lesson`, `CASCADE`, related `questions` | |
| `type` | `CharField(15)` | `mcq`, `fill_blank`, `translate`, `match`, `listen`, `cloze`, `conjugation` |
| `prompt` | `TextField` | Conjugation prompts follow `Conjugate {verb} ({tense}, {subject})`. Video prompts start with `[VIDEO] `. |
| `correct_answer` | `TextField` | |
| `wrong_answers` | `JSONField(list)` | MCQ distractors. |
| `explanation` | `TextField` | default `""` |
| `difficulty` | `PositiveIntegerField` | |
| `language` | see above | |

### `VideoLesson` (`content_video_lessons`)

| Field | Type | Notes |
|-------|------|-------|
| `lesson` | `OneToOneField(Lesson)`, `CASCADE`, related `video` | |
| `youtube_url` | `URLField(500)` | |
| `youtube_id` | `CharField(20)` | Set by the task. |
| `title` | `CharField(500)` | |
| `thumbnail_url` | `URLField(500)` | `https://img.youtube.com/vi/<id>/mqdefault.jpg` |
| `duration_seconds` | `PositiveIntegerField` | default 0 (not populated by the task today) |
| `transcript_fr`, `transcript_en` | `TextField` | |
| `status` | `CharField(12)` | `pending`, `processing`, `ready`, `failed`; default `pending` |
| `error_message` | `TextField` | |
| `language` | see above | |
| `created_at`, `updated_at` | `DateTimeField` | auto |

### `VideoVocabulary` (`content_video_vocabulary`) and `VideoExpression` (`content_video_expressions`)

`video_lesson` FK (`CASCADE`, related `vocabulary` / `expressions`). Vocabulary: `french`, `english`, `pronunciation`, `example_sentence`, `timestamp_seconds`. Expression: `expression_fr`, `expression_en`, `context_sentence`, `timestamp_seconds`. No `language` field. `timestamp_seconds` is always 0 today.

### Indexes and constraints

Only the per-field `language` indexes and FK indexes. No unique constraints on content (duplicates are prevented by seed logic only).

## 4. API contract

Base path `/api/content/`. All endpoints require an authenticated user.

### GET `/api/content/topics/`

Not paginated. Language-scoped.

```json
[{"id": 1, "name_fr": "...", "name_en": "...", "description": "...", "icon": "👋",
  "order": 1, "difficulty_level": 1, "lesson_count": 3}]
```

### GET `/api/content/topics/{id}/`

Language-scoped (404 cross-language).

```json
{"id": 1, "name_fr": "...", "name_en": "...", "description": "...", "icon": "...",
 "order": 1, "difficulty_level": 1,
 "lessons": [{"id": 10, "type": "vocab", "title": "...", "order": 10, "difficulty": 1}]}
```

### GET `/api/content/lessons/{id}/`

Language-scoped (404 cross-language). Response (`LessonDetailSerializer`):

| Key | Shape |
|-----|-------|
| `id`, `type`, `title`, `content`, `order`, `difficulty` | Lesson fields |
| `topic` | `{id, name_fr, name_en}` |
| `vocabulary` | `[{id, french, english, pronunciation, example_sentence, gender, part_of_speech, audio_url}]` |
| `grammar_rules` | `[{id, title, explanation, formula, examples, exceptions}]` |
| `reading_texts` | `[{id, title, content_fr, content_en, vocabulary_highlights, comprehension_questions}]` |
| `questions` | Question objects (`QuestionSerializer` in `apps/content/serializers.py`) |
| `video` | Video object (below) or `null` |

### GET `/api/content/lessons/{id}/video/`

| Status | Body |
|--------|------|
| 200 | `{id, youtube_url, youtube_id, title, thumbnail_url, duration_seconds, transcript_fr, transcript_en, status, error_message, vocabulary: [{id, french, english, pronunciation, example_sentence, timestamp_seconds}], expressions: [{id, expression_fr, expression_en, context_sentence, timestamp_seconds}]}` |
| 404 | `{"detail": "Lesson not found."}` or `{"detail": "No video attached to this lesson."}` |

Not language-scoped today (see D-1).

### POST `/api/content/lessons/{id}/video/`

| | |
|---|---|
| Permission | Authenticated and `is_staff` or `is_superuser` |
| Request | `{youtube_url}` |
| 201 / 200 | Video object (created / replaced). All derived fields reset, `status: "pending"`. Task queued. |
| 400 | `{"detail": "youtube_url is required."}` |
| 403 | `{"detail": "Only staff can attach videos to lessons."}` |
| 404 | `{"detail": "Lesson not found."}` |

### GET `/api/content/vocabulary/random/`

| Param | Default | Effect |
|-------|---------|--------|
| `count` | 1 | Number of words, capped at 20. |
| `single_word` | false | `true`: exclude entries containing a space and entries shorter than 3 chars. |
| `gendered` | false | `true`: only `gender` in `m`, `f`. |

| Status | Body |
|--------|------|
| 200, `count=1` | Single vocabulary object |
| 200, `count>1` | List of vocabulary objects (possibly empty) |
| 404, `count=1` | `{"detail": "No vocabulary available."}` |

Language-scoped.

## 5. Business rules & invariants

| Rule | Detail |
|------|--------|
| Language scoping | New list/detail views must filter by `request.user.target_language`. |
| Child language | Child rows (lessons, vocabulary, questions, ...) are expected to share their topic's `language`. Not enforced by the database. |
| Video transcript | French transcript is mandatory; missing French captions fail the video with a `ValueError` (no retry). Manual captions are preferred over auto-generated. |
| Transcript excerpt | Only the first 6000 characters are sent to the LLM. |
| LLM output | Must be JSON `{vocabulary, expressions, questions}`; Markdown fences are stripped. Unknown question types are coerced to `mcq`. Generated questions get `difficulty=2`. |
| Retries | Non-`ValueError` failures retry up to 2 times with a 60 s countdown. The video is marked `failed` with the error text after every failed attempt. |
| Deletion | Deleting a topic or lesson cascades to all child content and to user rows that reference it (SRS cards, quiz sessions, completions). `MistakeEntry.question` is set to null instead. |

## 6. Background jobs

### Celery task `content.process_video_lesson(video_lesson_id)`

Defined in `apps/content/tasks.py` (`bind=True`, `max_retries=2`). Triggered by `LessonVideoView.post` and by `VideoLessonAdmin.save_model` when the URL is new or changed. Not scheduled by beat.

### Management commands

| Command | Creates | Source | Idempotency |
|---------|---------|--------|-------------|
| `seed_topics_fr` | FR topics, each with a vocab lesson, a reading lesson and an "Expressions clés" lesson (phrases + cultural note in `content`) | `data/topics_fr_{a1,a2,b1,b2,c1c2}.json` | `update_or_create` on `(name_fr, language="fr")`; skip unless `--force` (recreate lessons) or `--reset` (wipe lessons of listed topics first); `--dry-run`; `--path` overrides the file for one level |
| `seed_content` | 2 FR starter topics | Python literals | Skips if any `Topic` exists |
| `seed_demo_data` | FR topics 3-8 and 12 `DiscoverCard`s | Python literals | Skips topics whose `name_fr` exists |
| `seed_extended_content` | FR topics 9-20 | Python literals | Skips topics whose `name_fr` exists |
| `seed_content_en` | 5 EN topics, 25 lessons, about 300 words | Python literals | Skips if any EN topic exists |
| `seed_questions_en` | One MCQ per EN vocabulary item, distractors from the same lesson | Derived | Skips lessons that already have questions |

## 7. Dependencies

| Dependency | Use |
|------------|-----|
| `apps.users` | `LANGUAGE_CHOICES`, `request.user.target_language` |
| `services.llm.factory.create_llm_router` | Gemini with Groq fallback for video extraction |
| `youtube-transcript-api` | Transcript listing and download |
| Celery + Redis | Video task |
| `data/` directory (`/data` in Docker) | JSON seeds |
| Consumers | `apps.practice`, `apps.progress`, `apps.notes`, `apps.bot`, frontend mini-games |

## 8. Deviations / open questions

| # | Item |
|---|------|
| D-1 | `LessonVideoView` (GET and POST) does not filter by `target_language`, contrary to FR-2 and the README v2 note. |
| D-2 | The video task does not copy `lesson.language` to `VideoLesson` or generated `Question` rows (they default to `fr`), and the transcript language and LLM prompt are fixed to French. |
| D-3 | The video task deletes and re-creates rows one by one outside a transaction; a failure part-way leaves partial content. |
| D-4 | Permanent transcript errors (captions disabled, video unavailable) are retried like transient errors, and the status flips between `failed` and `processing` during retries. |
| D-5 | The allowed question-type list in `tasks.py` duplicates `Question.TYPE_CHOICES`. |
| D-6 | `RandomVocabularyView` returns an object for `count=1` and a list otherwise; non-numeric or negative `count` yields a server error instead of `400`. |
| D-7 | About 6,000 lines of content are Python literals in four seed commands with duplicated helpers (`_topic_exists`, `_bulk_vocab`, `_bulk_questions`) that insert row by row; only `seed_topics_fr` uses JSON data. |
| D-8 | `seed_content` skips if any topic exists, so it is skipped after `seed_content_en` or `seed_conjugations` has run. |
| D-9 | `VideoVocabulary` and `VideoExpression` have no `language` field although every other content table is language-discriminated. |
| D-10 | README endpoint table omits `lessons/{id}/video/` and `vocabulary/random/`. |
| D-11 | Content admin has no `language` column or filter; `LessonAdmin.has_video` runs one query per row. |
| D-12 | No composite indexes for `Topic(language, order)`, `Lesson(topic, order)`, `Question(lesson, type)`. |
| D-13 | `duration_seconds` and `timestamp_seconds` are never populated. |
