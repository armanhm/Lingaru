# Spec: Notes (Our Notes) and My Notes

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Notes and My Notes](../wiki/Notes-and-My-Notes.md)

## 1. Purpose & scope

**In scope:**
- `backend/apps/notes/` ("Our Notes"): the curated, shared English vocabulary study notes, their import command, and their AI and SRS actions.
- `backend/apps/my_notes/` ("My Notes"): per-user private markdown notes with optional public sharing and AI actions.

**Out of scope:**
- `apps.memory` (assistant memory notes, `/api/memory/notes/`). It is a different feature with different tables.
- `content` and `progress` internals beyond the rows these apps create.

## 2. Requirements

### Our Notes (`apps.notes`)

| ID | Requirement |
|---|---|
| FR-N1 | The list returns active notes whose `language` equals the user's `target_language`, ordered by `-note_number`, each with its `word_count`. It is not paginated. |
| FR-N2 | Detail returns one active note in the user's language, with its words ordered by `order`, then `id`. It returns 404 otherwise. |
| FR-N3 | `ask` requires a non-empty `question`. It calls the LLM with a system prompt listing the note's words (with definitions and examples) and instructs it to answer using only those words. It returns `{answer}`, or 503 when the LLM fails. |
| FR-N4 | `add-to-srs` ensures the shared "Our Notes" `Topic` (`name_en="Our Notes"`, `language="en"`, `order=9999`) and its `Lesson` ("Our Notes vocabulary", `type=vocab`) exist. For each word it gets or creates `Vocabulary(english=word, french=word, language="en", lesson)` and the user's `SRSCard`, all in one transaction. It returns counts. |
| FR-N5 | `generate-quiz` requires at least one word (400 otherwise). It asks the LLM for a JSON array of 5-10 MCQs, parses it (fence-tolerant, with a fallback to the first `[...]`), creates an EN `Lesson` "Quiz: Note <n>" under the "Our Notes" topic with `content={note_id, note_number}` and one `Question(type="mcq")` per item in a transaction, and returns 201. |
| FR-N6 | `import_notes` upserts notes keyed on `(language="en", note_number)` with `is_active=True`, replaces each note's words in file order, all in a single transaction. |

### My Notes (`apps.my_notes`)

| ID | Requirement |
|---|---|
| FR-M1 | All CRUD operations are restricted to the requesting user's notes. Other users' notes return 404. |
| FR-M2 | The list supports the filters `q` (case-insensitive `icontains` on title, body or tags), `kind`, `tag` (lowercased `icontains` on tags), `favorite` (`1` or `true`) and `language` (ignored when empty or `all`). It is ordered `-updated_at` and not paginated. |
| FR-M3 | On create, `language` defaults to the user's `target_language` when it is omitted. `user` is always the requester. |
| FR-M4 | `title` is required, non-blank, trimmed and at most 200 characters. `tags` must be a list of strings. Tags are trimmed, lowercased and de-duplicated; empty strings are dropped; there can be at most 20, each at most 40 characters (400 otherwise). |
| FR-M5 | `GET public/<pk>/` returns any note with `is_public=True` to any authenticated user. |
| FR-M6 | `ai-action` accepts only the 7 allowed actions (400 otherwise) on the user's own note (404 otherwise). It requires a non-blank body for every action except `suggest_tags`. It returns `{result}` (trimmed LLM text), or `{tags}` for `suggest_tags`, or 503 when the LLM fails. It does not modify the note. |

## 3. Data model

### `Note` (`notes_note`)

| Field | Type | Constraints |
|---|---|---|
| `note_number` | PositiveInt | unique with `language` (`notes_unique_lang_number`) |
| `date` | Date | |
| `title` | Char(200) | blank allowed |
| `language` | Char(2) | choices fr or en; default `en`; indexed |
| `is_active` | Bool | default true |
| `created_at`, `updated_at` | DateTime | |

Meta: ordering `-note_number`; index `(language, -note_number)`.

### `NoteWord` (`notes_word`)

| Field | Type | Constraints |
|---|---|---|
| `note` | FK Note | cascade, related `words` |
| `word` | Char(200) | |
| `definition`, `example` | Text | blank allowed |
| `order` | PositiveInt | |

Meta: ordering `order, id`; index `(note, order)`.

### `MyNote` (`my_notes_mynote`)

| Field | Type | Constraints |
|---|---|---|
| `user` | FK User | cascade, related `my_notes` |
| `title` | Char(200) | |
| `kind` | Char(20) | `grammar, dialog, vocabulary, listening, writing, reading, freeform`; default `freeform` |
| `body_markdown` | Text | blank allowed |
| `tags` | JSON list | default `[]` |
| `language` | Char(2) | fr or en; default `fr` |
| `is_favorite` | Bool | |
| `is_public` | Bool | indexed |
| `created_at`, `updated_at` | DateTime | |

Meta: ordering `-updated_at`; indexes `(user, -updated_at)`, `(user, kind)`, `(is_public, -updated_at)`.

### Data file

`data/structured_notes.json` has the shape `{"notes": [{"note_number": int, "date": "YYYY-MM-DD", "title": str|null, "words": [{"word": str, "definition": str|null, "example": str|null}]}]}`. It holds 80 notes and 1275 words.

## 4. API contract

All endpoints require `IsAuthenticated`.

### `/api/notes/`

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/notes/` | n/a | 200 `[{id, note_number, date, title, word_count}]` |
| GET | `/api/notes/<pk>/` | n/a | 200 `{id, note_number, date, title, words: [{id, word, definition, example, order}]}`; 404 |
| POST | `/api/notes/<pk>/ask/` | `{question: str}` | 200 `{answer}`; 400 `{"detail": "question is required."}`; 404; 503 `{"detail": "AI service is temporarily unavailable. Please try again."}` |
| POST | `/api/notes/<pk>/add-to-srs/` | n/a | 200 `{created: int, existing: int}`; 404 |
| POST | `/api/notes/<pk>/generate-quiz/` | n/a | 201 `{lesson_id, question_count}`; 400 `{"detail": "Note has no words to quiz on."}`; 404; 500 `{"detail": "Quiz generation produced invalid output. Please retry."}`; 503 |

### `/api/my-notes/`

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/my-notes/?q=&kind=&tag=&favorite=&language=` | n/a | 200 `[{id, title, kind, tags, language, is_favorite, is_public, updated_at, body_preview}]` (`body_preview` is the first 140 characters) |
| POST | `/api/my-notes/` | `{title, kind?, body_markdown?, tags?, language?, is_favorite?, is_public?}` | 201 MyNoteDetail; 400 validation |
| GET | `/api/my-notes/<pk>/` | n/a | 200 MyNoteDetail; 404 |
| PUT / PATCH | `/api/my-notes/<pk>/` | partial or full MyNoteDetail | 200; 400; 404 |
| DELETE | `/api/my-notes/<pk>/` | n/a | 204; 404 |
| GET | `/api/my-notes/public/<pk>/` | n/a | 200 MyNoteDetail when `is_public`; 404 |
| POST | `/api/my-notes/<pk>/ai-action/` | `{action: summarize \| enhance_format \| fix_grammar \| more_examples \| ice_breakers \| practice_questions \| suggest_tags}` | 200 `{result: str}` or `{tags: str[]}`; 400 `{"detail": "Unknown action: <x>"}` or `{"detail": "Note body is empty."}`; 404; 503 `{"detail": "AI service unavailable. Try again."}` |

MyNoteDetail fields: `id, title, kind, body_markdown, tags, language, is_favorite, is_public, created_at, updated_at`. The read-only fields are `id`, `created_at` and `updated_at`.

## 5. Business rules & invariants

| Rule | Value |
|---|---|
| Our Notes identity | `(language, note_number)` is unique; the import is idempotent and replaces words |
| Shared SRS container | Topic "Our Notes" (EN, order 9999) → Lesson "Our Notes vocabulary" (EN, vocab, order 9999) |
| Quiz lessons | One new Lesson per `generate-quiz` call, `order=0`, `difficulty=1`, EN |
| Tag limits | ≤ 20 tags, ≤ 40 characters each, lowercased and unique |
| Suggested tags | Split on commas and newlines, `#` stripped, ≤ 40 characters, first 5 unique |
| AI response language | My Notes: "Respond ONLY in French or English", based on `note.language`. Our Notes: English tutor prompts. |

## 6. Background jobs

There are no Celery tasks.

| Command | Flags | Notes |
|---|---|---|
| `import_notes` | `--path`, `--force` (no-op) | Loads `data/structured_notes.json` (path resolved relative to the repo root) |

## 7. Dependencies

- `services.llm.factory.create_llm_router`.
- `content.Topic`, `Lesson`, `Question` and `Vocabulary` (notes add-to-srs and generate-quiz).
- `progress.SRSCard`.
- `users.User.target_language`.

## 8. Deviations / open questions

| # | Deviation |
|---|---|
| D-1 | `NoteListSerializer.word_count` uses `source="words.count"`, so the list runs N+1 queries. An annotated `Count("words")` would fix it. |
| D-2 | `generate-quiz` writes new shared content (Lesson and Questions) on every call, with no dedupe per note. |
| D-3 | `_parse_quiz_json` does not catch `JSONDecodeError` from the fallback parse, and does not validate that items are dicts. Those cases return 500 instead of the documented error body. |
| D-4 | add-to-srs sets `Vocabulary.french = word` for English words, a workaround for the FR-centric `Vocabulary` model. |
| D-5 | `Note.language` and `MyNote.language` use `max_length=2`; other content tables use 8. |
| D-6 | Both lists are unpaginated even though the project default is `PageNumberPagination` with 20 per page. |
| D-7 | `import_notes` hard-codes `language="en"`, and its `--force` flag does nothing. |
| D-8 | Neither app is documented in the root README. The three "notes" features are easy to confuse; see the wiki disambiguation table. |
