# Spec: Assistant

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [AI Assistant](../wiki/AI-Assistant.md), [Agentic Blocks](../wiki/Agentic-Blocks.md)

## 1. Purpose & scope

**In scope:** `backend/apps/assistant/`:
- text chat, voice chat and image query endpoints
- conversation history endpoints
- system-prompt composition per turn
- the structured **block protocol** (`blocks.py`, `agentic_prompt.py`)

**Out of scope:**
- LLM routing and the prompt registry ([llm-layer.md](llm-layer.md))
- agent catalogue ([agents.md](agents.md))
- memory ([memory.md](memory.md))
- retrieval ([documents-rag.md](documents-rag.md))
- STT and TTS internals ([media-audio.md](media-audio.md))
- Telegram bot handlers (`apps/bot`), which reuse the models and `extract_blocks`

## 2. Requirements

**Chat**
- **FR-1** An authenticated user can send a text message and receive an assistant reply in a new or existing conversation they own.
- **FR-2** A `conversation_id` that does not exist or belongs to another user yields 404.
- **FR-3** A new conversation is titled with the first 50 chars of the message (plus `...` if truncated).
- **FR-4** The user message is persisted before the LLM call. The assistant message is persisted after a successful call with `provider`, `tokens_used` and `blocks`.
- **FR-5** The LLM receives the full ordered message history of the conversation (all prior turns plus the new message) as `{role, content}`.
- **FR-6** The system prompt is composed in this order:
  1. `get_system_prompt(target_language, mode)`.
  2. If `agent_slug` matches an active agent, use that agent's prompt instead (`system_prompt_en` for `target_language == "en"` when non-empty, else `system_prompt`; the mode prompt if both are empty).
  3. If `user.mode == "agentic"`, append the agentic footer for `target_language`.
  4. If `mode == "conversation"` and no agent is active and RAG returns context, replace the prompt with `rag_conversation` formatted with the context.
  5. If `LINGARU_MEMORY_ENABLED` and the learner context is non-empty, prepend it followed by a blank line.
- **FR-7** RAG and memory-assembly failures never fail the turn. They are logged and skipped.
- **FR-8** If both LLM providers fail, the endpoint returns 503 with a generic message.
- **FR-9** The reply is passed through `extract_blocks`. The stored `content` is the prose with block fences removed, and `blocks` is the validated list.
- **FR-10** When memory is enabled, post-turn extraction runs after the assistant message is saved. A saved note is returned as `memory_saved`. Extraction failure never fails the turn.
- **FR-11** When a conversation reaches exactly 5 user messages, the user gets 15 XP (`activity_type="ai_conversation"`, `source_id="conversation_<id>"`) and `check_streak` runs.

**Voice**
- **FR-12** Voice chat transcribes the uploaded audio, then runs a turn with the mode prompt plus the agentic footer (no agent, RAG or memory), parses blocks, and synthesises the prose to audio. A TTS failure yields `ai_response_audio_url: null`, not an error. An STT or LLM failure yields 503.
- **FR-13** Voice chat applies the same 5-message XP rule as FR-11.

**Image**
- **FR-14** Image query sends the image and the optional question to the vision model with the `image_query` prompt. It stores an `ImageQuery` and two messages (`[Image uploaded] <question>` or `[Image uploaded for analysis]`, then the reply). A vision failure yields 503.

**History**
- **FR-15** Users can list their conversations (paginated, with `message_count`) and fetch one conversation with all its messages.

## 3. Data model

### `Conversation` (`assistant_conversations`)
| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | |
| `user` | FK `users.User`, CASCADE | related_name `conversations` |
| `title` | CharField(300) | |
| `context` | CharField(200), null/blank | `agent:<slug>` for agent runs; otherwise null |
| `created_at` | DateTimeField auto_now_add | |

Meta ordering `-created_at`.

### `Message` (`assistant_messages`)
| Field | Type | Notes |
|---|---|---|
| `conversation` | FK `Conversation`, CASCADE | related_name `messages` |
| `role` | CharField(10) | `user` \| `assistant` |
| `content` | TextField | prose without block fences |
| `provider` | CharField(10), null/blank | `gemini` \| `groq` |
| `tokens_used` | PositiveIntegerField, default 0 | |
| `blocks` | JSONField, default `[]` | validated blocks (section 5.2) |
| `created_at` | DateTimeField auto_now_add | |

Meta ordering `created_at`.

### `ImageQuery` (`assistant_image_queries`)
| Field | Type | Notes |
|---|---|---|
| `user` | FK `users.User`, CASCADE | related_name `image_queries` |
| `conversation` | FK `Conversation`, SET_NULL, null | |
| `image_file` | ImageField `image_queries/` | |
| `question` | TextField, default `""` | |
| `extracted_text` | TextField, default `""` | not written by current code |
| `ai_response` | TextField, default `""` | |
| `created_at` | DateTimeField auto_now_add | |

Ordering `-created_at`.

There is no `language` discriminator on these models. Language comes from `request.user.target_language` at request time.

## 4. API contract

Base path `/api/assistant/`. Auth: JWT (`IsAuthenticated`), so an unauthenticated request gets 401. Validation errors return 400 in the DRF field-error format.

### `POST chat/`
Request (JSON):
| Field | Type | Required | Notes |
|---|---|---|---|
| `message` | string, min length 1 | yes | |
| `mode` | enum | no (default `conversation`) | `conversation`, `grammar_correction`, `grammar_explanation`, `roleplay_hotel`, `roleplay_airport`, `roleplay_bank`, `roleplay_school`, `roleplay_job_interview`, `roleplay_restaurant`, `roleplay_doctor`, `roleplay_market`, `roleplay_train`, `roleplay_pharmacy` |
| `conversation_id` | int \| null | no | |
| `agent_slug` | string \| null \| "" | no | an unknown or inactive slug is ignored |

200:
```json
{
  "reply": "string (prose)",
  "blocks": [ /* section 5.2 */ ],
  "conversation_id": 1,
  "provider": "gemini|groq",
  "tokens_used": 123,
  "rag_used": false,
  "memory_saved": {"id": 1, "content": "...", "category": "goal"}
}
```
`memory_saved` is present only when a note was saved. Errors: 404 `{"detail": "Conversation not found."}`, 503 `{"detail": "AI service is temporarily unavailable. Please try again."}`.

### `POST voice-chat/` (multipart)
| Field | Type | Required |
|---|---|---|
| `audio` | file | yes |
| `conversation_id` | int \| null | no |
| `mode` | enum `conversation` | no |

200: `{transcription, ai_response_text, blocks, ai_response_audio_url (absolute URL or null), conversation_id, provider, tokens_used}`.
Errors:
- 404 when the conversation is not found.
- 503 `{"detail": "Speech recognition is temporarily unavailable."}` on STT failure.
- 503 `{"detail": "AI service is temporarily unavailable."}` on LLM failure.

### `POST image-query/` (multipart)
| Field | Type | Required |
|---|---|---|
| `image` | image file (Pillow-validated) | yes |
| `question` | string, may be blank | no |
| `conversation_id` | int \| null | no |

200: `{image_query_id, ai_response, conversation_id, provider, tokens_used}`.
Errors: 404 when the conversation is not found; 503 `{"detail": "AI vision service is temporarily unavailable. Please try again."}`.

### `GET conversations/`
Paginated (`PageNumberPagination`, 20): `{count, next, previous, results: [{id, title, context, created_at, message_count}]}`. Only the caller's conversations are returned.

### `GET conversations/<id>/`
200: `{id, title, context, created_at, messages: [{id, role, content, blocks, provider, tokens_used, created_at}]}`, with messages ordered by `created_at` and not paginated. 404 if not owned.

## 5. Business rules & invariants

### 5.1 Prompt composition
See FR-6. Invariants:
- An active agent disables RAG for the turn.
- The memory block is always the outermost prefix.
- The agentic footer is idempotent: `append_agentic_footer` checks for a per-language marker before appending.
- Agentic footer markers: FR `## En mode agent : invoque les fonctionnalités`; EN `you may emit a fenced`.

### 5.2 Block protocol

**Wire format emitted by the LLM.** A fenced segment at the end of the reply:
````
```blocks
[ {"type": "...", ...}, ... ]
```
````
`{"blocks": [...]}` and a single block object are also accepted.

**Parsing** (`extract_blocks(raw_text) -> (prose, blocks)`), first match wins:
1. All ` ```blocks ` (optionally ` ```blocks json `) fences.
   - Each payload is parsed strictly, falling back to per-object salvage of balanced `{...}` spans.
   - All fences are removed from the prose.
   - If no fence yields any candidate, the raw text is returned with `[]`.
2. Else, the first ` ```json ` / ` ```jsonc ` / bare ` ``` ` fence whose payload starts with `[` or `{` **and** validates to at least one block. That fence is removed.
3. Else, a bare JSON array at the very end of the text that validates. Everything before it is the prose.
4. Else `(raw_text, [])`.

**Validation:** unknown `type` values are dropped, invalid blocks are dropped, and at most **8** blocks are kept. Strings are stripped. Output shapes:

| `type` | Output fields | Constraints |
|---|---|---|
| `audio` | `text`, `lang` | text required, ≤ 400; `lang` defaults to `fr` |
| `vocab_card` | `french`, `english`, `pos?`, `example_fr?` | pos ≤ 24, example_fr ≤ 240 |
| `expression` | `fr`, `en`, `note?` | note ≤ 240 |
| `conjugation_table` | `verb`, `tense`, `rows[{pronoun, form}]` | verb/tense ≤ 48; pronoun ≤ 24; form ≤ 64; 1-12 valid rows |
| `quiz` | `questions[]` | 1-10 valid questions |
| `action` | `route`, `label`, `emoji?` | `route` ∈ `ALLOWED_ACTION_ROUTES`; label ≤ 48; emoji ≤ 8 |
| `feature_widget` | `widget`, `config`, `title?` | `widget` ∈ `ALLOWED_FEATURE_WIDGETS`; `config` is an object (non-objects become `{}`); title ≤ 80 |

**Quiz questions.** Every question has `kind` and `prompt` (≤ 400), plus an optional `explanation` (≤ 400). `answer` is an accepted alias of `correct`, and an explicit `correct` wins.

| `kind` | Fields | `correct` |
|---|---|---|
| `mcq` | `options`: 2-6 strings | int index, or the option string (resolved to an index) |
| `multi` | `options`: 2-6 strings | non-empty list of indices or option strings; stored as sorted unique indices |
| `true_false` | | boolean |
| `matching` | `pairs`: 2-8 `{left ≤ 80, right ≤ 80}`, at least 2 valid | n/a |
| `short` | `accept`: non-empty list of strings (first 8 kept) | n/a |

**`ALLOWED_ACTION_ROUTES`**: `/dashboard`, `/topics`, `/discover`, `/news`, `/practice/dictation`, `/practice/pronunciation`, `/practice/conjugation`, `/practice/srs`, `/mini-games`, `/grammar`, `/exam-prep`, `/assistant`, `/agents`, `/dictionary`, `/progress`, `/settings`, `/documents`.

**`ALLOWED_FEATURE_WIDGETS`**: `news`, `minigame`, `dictation`, `flashcard`, `conjugation`, `word_scramble`, `gender_snap`, `missing_letter`, `speed_round`, `match_pairs`, `listening_challenge`, `grammar_topic`.

Widget config keys honoured by the frontend: `news.topic`, `grammar_topic.slug`.

**Consumers:** `frontend/src/components/blocks/MessageBlocks.jsx`. Its renderer registry must mirror `BLOCK_VALIDATORS`, and unknown types must render nothing.

**Legacy format:** ` ```quiz ` fences (`{title, section?, questions:[{question, options, correct, explanation}]}`) are not parsed by the backend. They remain in `content` and are rendered by `frontend/src/components/QuizBlock.jsx`.

### 5.3 Other rules
- XP: 15 XP once per conversation, when the user-message count is exactly 5 (text and voice).
- Titles:
  - Text: first 50 chars + `...`.
  - Voice: `Voice: <first 40 chars>` (+`...` if longer).
  - Image: `Image: <question[:40]>` or `Image query`.

## 6. Background jobs

None. All work is synchronous inside the request. TTS in voice chat and memory extraction also run inline.

## 7. Dependencies

| Dependency | Use |
|---|---|
| `services.llm` | `create_llm_router`, `get_system_prompt` |
| `services.rag.context.retrieve_context_for_query` | RAG context |
| `services.memory` | `is_memory_enabled`, `assemble_user_context`, `maybe_extract_note` |
| `services.stt.groq_whisper.GroqWhisperProvider` | voice transcription |
| `services.tts.service.get_or_create_audio` | voice reply audio |
| `apps.agents.models.Agent` | agent prompt lookup |
| `apps.gamification.services` | `award_xp`, `check_streak` |
| `apps.assistant.agentic_prompt`, `apps.assistant.blocks` | footer, block parsing |

## 8. Deviations / open questions

- RAG replaces the composed prompt (FR-6 step 4), which discards the agentic footer added in step 3. The intended order is probably "persona + RAG section + footer".
- Voice chat uses `language="fr"` for both STT and TTS regardless of `target_language`. It does not apply agents, RAG or memory.
- Image query does not use history, agents, memory or the footer, and does not run `extract_blocks`.
- The LLM history is unbounded (no window or summary), so per-turn token cost grows with conversation length.
- Blocks are stripped from `content`, so later turns do not see what was rendered.
- The user message (and a new conversation) is saved before the LLM call, so a 503 leaves an unanswered turn.
- `ConversationListView` annotates with `Count`, which disables `Meta.ordering` (Django ignores model ordering in GROUP BY queries). List order is unspecified (`UnorderedObjectListWarning` in tests).
- `ImageQuery.extracted_text` is never populated.
- Agentic footer content differs greatly between FR (full route and widget tables, rules) and EN (a short summary). No parity test.
- The block-parsing fallbacks (strategies 2-3) are heuristic. Open question: are they still needed once prompts reliably emit the ` ```blocks ` fence?
- Text, voice, image and bot entry points each compose prompts independently, and the XP logic is duplicated. Open question: consolidate into one turn service?
- Memory extraction adds a synchronous second LLM call per turn when enabled.
