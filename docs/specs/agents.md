# Spec: Agents

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Agents](../wiki/Agents.md)

## 1. Purpose & scope

**In scope:** `backend/apps/agents/`:
- the agent catalogue (`Agent`)
- per-user run index (`AgentRun`)
- gallery, detail, start and runs endpoints
- the structured-blocks instruction appended to agent prompts (`prompts.py`)
- the seed commands

**Out of scope:**
- How a turn is executed with an agent: `ChatView` ([assistant.md](assistant.md) FR-6).
- The block schema itself ([assistant.md](assistant.md) section 5.2).
- Frontend composer @-mention shortcuts on `/assistant`. These are client-side directives and do not involve this app.

## 2. Requirements

- **FR-1** Authenticated users can list active agents, ordered by `order`, then `name`.
- **FR-2** Authenticated users can fetch one active agent by slug. A missing or inactive agent returns 404.
- **FR-3** System prompts are never exposed through the API.
- **FR-4** For a user with `target_language == "en"`, the list and detail payloads substitute `name`, `tagline`, `description`, `best_for`, `capabilities`, `suggested_questions` with their `_en` counterparts when those are non-empty. Otherwise the FR values are returned.
- **FR-5** `POST start/` creates a new `Conversation` owned by the caller (title `"<agent.name>, nouvelle session"`, `context="agent:<slug>"`) and an `AgentRun` linking user, agent and conversation. It returns 201.
- **FR-6** `GET runs/` returns the caller's 20 most recent runs for that agent, each with the message count of its conversation, computed with a single aggregate query.
- **FR-7** At chat time, an agent's prompt replaces the mode prompt: `system_prompt_en` for EN learners when non-empty, else `system_prompt` (see [assistant.md](assistant.md)).
- **FR-8** `ensure_block_instruction(prompt)` appends `BLOCK_FENCE_INSTRUCTION` once. It is idempotent via the marker `<!-- structured-payloads:v1 -->`.
- **FR-9** `seed_agents` upserts the 9 FR agents by slug and applies FR-8 to `system_prompt`. `--clear` deletes all agents first.
- **FR-10** `seed_agents_en` fills empty `_en` fields and `system_prompt_en` for known slugs. `--force` overwrites. Unknown slugs are reported and skipped.

## 3. Data model

### `Agent` (`agents_agent`)
| Field | Type | Constraints / default |
|---|---|---|
| `slug` | SlugField(64) | unique |
| `name` | CharField(80) | |
| `name_en` | CharField(80) | blank, `""` |
| `emoji` | CharField(8) | `"✨"` |
| `tint` | CharField(120) | `"from-primary-500 to-purple-600"` (Tailwind gradient) |
| `tagline`, `tagline_en` | CharField(160) | blank |
| `description`, `description_en` | TextField | blank |
| `best_for`, `best_for_en` | JSONField list | `[]` |
| `capabilities`, `capabilities_en` | JSONField list | `[]` |
| `suggested_questions`, `suggested_questions_en` | JSONField list | `[]` |
| `system_prompt` | TextField | required (FR / primary) |
| `system_prompt_en` | TextField | blank, `""` |
| `mode` | CharField(24) | `conversation` \| `grammar_correction` \| `grammar_explanation`; default `conversation` |
| `output_shape` | CharField(12) | `free_text` \| `structured`; default `free_text` |
| `order` | PositiveIntegerField | 0 |
| `is_active` | BooleanField | True |
| `created_at`, `updated_at` | DateTimeField | auto |

Ordering `order, name`. There is no `language` discriminator: language is handled with paired `_en` fields.

### `AgentRun` (`agents_run`)
| Field | Type | Notes |
|---|---|---|
| `user` | FK `users.User`, CASCADE | related_name `agent_runs` |
| `agent` | FK `Agent`, CASCADE | related_name `runs` |
| `conversation` | FK `assistant.Conversation`, CASCADE | related_name `agent_runs` |
| `started_at` | DateTimeField auto_now_add | |

Ordering `-started_at`. Index `(user, agent, -started_at)`.

## 4. API contract

Base `/api/agents/`. Auth: JWT `IsAuthenticated` (401 otherwise).

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `` | | 200 `[{slug, name, emoji, tint, tagline, best_for, mode, output_shape, order}]` (not paginated) |
| GET | `<slug>/` | | 200 `{slug, name, emoji, tint, tagline, description, best_for, capabilities, suggested_questions, mode, output_shape}`; 404 |
| POST | `<slug>/start/` | empty body | 201 `{agent: <detail shape>, conversation_id, run_id}`; 404 |
| GET | `<slug>/runs/` | | 200 `[{id, conversation_id, title, started_at, message_count}]`, at most 20, newest first; 404 if the agent is inactive or missing |

Language scoping: display fields per FR-4. Runs are always filtered to `request.user`.

Chat with an agent: `POST /api/assistant/chat/` with `agent_slug=<slug>` and `conversation_id` from start (see [assistant.md](assistant.md)). The frontend (`pages/AgentRun.jsx`) sends `mode=agent.mode`.

## 5. Business rules & invariants

- The catalogue is admin-managed (`/admin/agents/agent/`, with `order` and `is_active` editable from the list view).
- An inactive agent is invisible to every endpoint and is ignored by chat (`agent_slug` resolves to nothing, so the mode prompt is used).
- If `system_prompt_en` is empty, EN learners get the FR prompt (an intentional fallback per the multi-language design).
- The blocks instruction marker (`structured-payloads:v1`) must be bumped together with a data migration when the instruction text changes (precedent: migration `0002_append_blocks_instruction`).
- Seeded catalogue (slug: mode / output_shape):
  - `grammar-coach`: grammar_explanation / structured
  - `writing-editor`: grammar_correction / structured
  - `verb-studio`: conversation / structured
  - `vocab-explorer`: conversation / free_text
  - `translation-lab`: conversation / free_text
  - `idiom-hunter`: conversation / free_text
  - `culture-guide`: conversation / free_text
  - `pronunciation-buddy`: conversation / free_text
  - `exam-coach`: conversation / structured

## 6. Background jobs

There are no Celery tasks. Management commands:

| Command | Effect |
|---|---|
| `python manage.py seed_agents [--clear]` | Upsert the 9 FR agents and append the blocks instruction |
| `python manage.py seed_agents_en [--force]` | Backfill the EN display fields and `system_prompt_en` |

Migrations:
- `0002` appends the blocks instruction to existing `system_prompt`s. It is reversible: the reverse truncates at the marker.
- `0003`/`0004` add the EN fields.

## 7. Dependencies

- `apps.assistant.models.Conversation`. Runs pin a conversation.
- `apps.assistant.views.ChatView` consumes `Agent` at chat time.
- `users.User.target_language` controls the EN overrides.

## 8. Deviations / open questions

- `system_prompt_en` never receives `BLOCK_FENCE_INSTRUCTION` (neither `seed_agents_en` nor migration `0002` applies it), so EN agents do not emit content blocks.
- `pages/AgentRun.jsx` does not render `Message.blocks`, so blocks emitted in agent runs are not shown on that page.
- Some FR agent prompts (grammar-coach, exam-coach) also describe the legacy ` ```quiz ` format, which conflicts with the `quiz` block instruction appended below it.
- `Conversation.context = "agent:<slug>"` is not used server-side. The agent is chosen per request from `agent_slug`, so a client could switch agents mid-conversation.
- `Agent.mode` and `output_shape` have no backend effect (the frontend passes `mode` to chat; `output_shape` is display only).
- The start-run conversation title is always French.
- `StartAgentRunSerializer` is unused.
- The `seed_agents` help text and docstring say "8" agents. The seed defines 9.
- There are no view-level tests for list, detail and start.
- The instruction text is baked into stored prompts instead of being composed at request time. Open question: should agent rows store only the persona?
