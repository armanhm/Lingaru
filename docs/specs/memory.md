# Spec: Memory

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Memory](../wiki/Memory.md) · Design: `docs/superpowers/specs/2026-05-17-assistant-memory-layer-design.md`

## 1. Purpose & scope

**In scope:**
- `backend/apps/memory/`: `MemoryNote`, `MemoryExtractionLog`, the notes REST API, admin.
- `backend/services/memory/`: learner-context assembly, post-turn note extraction, the extractor prompt, the feature flag.

**Out of scope:**
- How `ChatView` uses these functions ([assistant.md](assistant.md) FR-6, FR-10).
- The Settings > Memory UI.
- Episodic recall and vector memory (deferred in the design).

## 2. Requirements

**Context assembly**
- **FR-1** `assemble_user_context(user)` returns `""` for a missing or unauthenticated user, or when no section has content.
- **FR-2** Otherwise it returns `"## LEARNER CONTEXT\n\n" + "\n\n".join(sections) + "\n"`. Sections appear in this order, each omitted when empty:
  1. `**Profile:**`: present values of `target_level` (as `<x> target`), `proficiency_level`, `mode=<x>`, `native=<x>`, `<n> min/day goal`, joined with ` . `.
  2. `**Goals:**`: bullet list of active `goal` notes in the user's `target_language`, oldest first.
  3. `**Recent mistakes (last 7 days):**`: top 3 `MistakeEntry.mistake_type` values by count, as `<type> (<n>x)`.
  4. `**Weakest grammar topics:**`: 3 lowest `GrammarMastery.mastery_score` rows with `attempts > 0`, as `<topic title> (<int>%)`.
  5. `**This week:**`: non-zero counts of lessons completed, mock exams completed, and SRS cards (see deviations) in the last 7 days.
  6. `**Preferences:**`, `**Weaknesses (user-reported):**`, `**Background:**`: active notes of those categories in `target_language`, oldest first.
- **FR-3** An exception in one section skips that section (WARNING log). An exception outside the section loop returns `""` (ERROR log). The function never raises.

**Extraction**
- **FR-4** `maybe_extract_note(*, user, user_message, assistant_response, message=None)` never raises and writes exactly one `MemoryExtractionLog` row per call.
- **FR-5** If the user already has 3 or more `extracted=True` logs in the last 24 h, it returns `None` without an LLM call. The log has `raw_output="cap reached: ..."`.
- **FR-6** Otherwise it calls an LLM (Groq primary when configured, Gemini fallback) with `EXTRACTOR_SYSTEM_PROMPT` and one user message containing the user text and the first 400 characters of the assistant response.
- **FR-7** Output is parsed as JSON (fenced, whole string, or first `{` to last `}`). An LLM or parse error is logged with `extracted=False` and the error text, and the function returns `None`.
- **FR-8** If `remember` is falsy or `content` is empty after strip, it logs `extracted=False` and returns `None`.
- **FR-9** Otherwise it creates `MemoryNote(content[:500], category if valid else "other", source="assistant_detected", language=user.target_language)`, logs `extracted=True` with the note link, and returns the note.

**Flag**
- **FR-10** `is_memory_enabled()` returns `bool(settings.LINGARU_MEMORY_ENABLED)`. When it is false, `ChatView` calls neither function. The REST API is unaffected.

**REST**
- **FR-11** Users can list, create, partially update and soft-delete their own notes. Another user's note returns 404.
- **FR-12** `source` is read-only through the API. Created notes always have `source="user"`.
- **FR-13** `content` is required, trimmed, non-blank, and at most 500 characters.
- **FR-14** DELETE sets `is_active=False` and returns 204, including when the note is already inactive.

## 3. Data model

### `MemoryNote` (`memory_notes`)
| Field | Type | Constraints / default |
|---|---|---|
| `user` | FK `users.User`, CASCADE | related_name `memory_notes` |
| `content` | TextField | ≤ 500 enforced by serializer and extractor |
| `category` | CharField(16) | `goal` \| `preference` \| `background` \| `weakness` \| `other`; default `other` |
| `source` | CharField(24) | `user` \| `assistant_detected`; default `user` |
| `is_active` | BooleanField | True |
| `language` | CharField(8) | `LANGUAGE_CHOICES` (`fr`, `en`); default `fr`; db_index |
| `created_at`, `updated_at` | DateTimeField | auto |

Ordering `-updated_at`. Indexes `(user, is_active, -updated_at)`, `(user, language, is_active)`.

### `MemoryExtractionLog` (`memory_extraction_log`)
| Field | Type | Notes |
|---|---|---|
| `user` | FK `users.User`, CASCADE | related_name `memory_extraction_logs` |
| `message` | FK `assistant.Message`, SET_NULL, null | originating assistant message |
| `note` | FK `MemoryNote`, SET_NULL, null | set when `extracted=True` |
| `extracted` | BooleanField | |
| `raw_output` | TextField, default `""` | model output or error (truncated to 1000-2000 chars) |
| `created_at` | DateTimeField auto_now_add | |

Ordering `-created_at`. Index `(user, -created_at)`.

## 4. API contract

Base `/api/memory/`. Auth: JWT `IsAuthenticated`.

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `notes/` | query `include_inactive` ∈ `1/true/yes` (case-insensitive) to include inactive notes | 200 `[Note]`, not paginated, ordered `-updated_at` |
| POST | `notes/` | `{content, category?, is_active?}` | 201 `Note`; 400 on validation |
| PATCH | `notes/<id>/` | any of `{content, category, is_active}` | 200 `Note`; 400; 404 |
| DELETE | `notes/<id>/` | | 204; 404 |

`Note` = `{id, content, category, source, is_active, created_at, updated_at}`. `language` is not exposed.

Language scoping: none in the REST API today (see deviations). Context assembly filters notes by `user.target_language`.

Chat side effect: `POST /api/assistant/chat/` returns `memory_saved: {id, content, category}` when FR-9 fires.

## 5. Business rules & invariants

- **Memory never breaks a chat turn** (pinned by `apps/assistant/tests/test_chat_with_memory.py`).
- The assistant can only create notes, never edit or delete them.
- The extraction cap is 3 successful notes per user per rolling 24 h (`DAILY_EXTRACTION_CAP`).
- Only explicit "remember / save / note / don't forget" intents qualify. Volunteered facts do not (prompt rule).
- The context contains no PII beyond learning profile fields (no email, username or Telegram id).
- Notes are per language. FR notes are not shown to the EN assistant, and vice versa.

## 6. Background jobs

None. Extraction runs synchronously in the chat request. Migration `0003` backfills `language="fr"` on existing notes.

## 7. Dependencies

| Dependency | Use |
|---|---|
| `services.llm` (`GeminiProvider`, `GroqProvider`, `ProviderRouter`) | extractor LLM call |
| `apps.progress` (`MistakeEntry`, `LessonCompletion`, `SRSCard`) | context sections |
| `apps.grammar.GrammarMastery` | weakest topics |
| `apps.exam_prep.ExamSession` | mock exam count |
| `apps.assistant.Message` | log FK |
| Settings | `LINGARU_MEMORY_ENABLED` (default False), `GROQ_API_KEY`, `GEMINI_API_KEY`, `GROQ_MODEL`, `GEMINI_MODEL` |

## 8. Deviations / open questions

- `POST notes/` does not set `language`, so user-authored notes are always `fr`. `GET notes/` is not filtered by language. EN learners' manual notes are never injected. Expected: `language=request.user.target_language` on create, and a list filtered to that language.
- The design's 60 s per-user context cache and Sentry spans (`memory.assemble`, `memory.extract`) are not implemented. Each chat turn runs about 9 queries for context.
- The design says the extractor reuses the blocks JSON-salvage helper. It has its own parser instead.
- The design's chat response example uses `message`. The implementation uses `reply` (see [assistant.md](assistant.md)).
- Extraction makes an LLM call on every turn below the cap, with no intent pre-filter. That doubles LLM calls per turn.
- `MemoryExtractionLog` grows by one row per chat turn with no retention policy.
- The "SRS reviews" count filters `last_quality > 0, next_review_at >= now - 7d`. That counts reviewed cards with an upcoming or recent due date, not reviews performed in the last 7 days.
- `_fetch_recent_activity` keeps a `hasattr(ExamSession, "mode")` guard that is no longer needed.
- There is no cap on the number or total length of notes injected.
- Only `ChatView` uses memory. Voice chat, image queries and the Telegram bot do not.
