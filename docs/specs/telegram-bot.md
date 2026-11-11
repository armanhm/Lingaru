# Spec: Telegram Bot

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Telegram Bot](../wiki/Telegram-Bot.md)

## 1. Purpose & scope

**In scope:**
- The Telegram bot process (`backend/apps/bot/`).
- Its commands and conversation flows.
- How it identifies Lingaru users.
- Which shared models and services it uses.

**Out of scope:**
- The models it reuses (content, practice, progress, gamification, assistant, agents, discover). Each is specified by its own app.
- LLM, TTS and STT provider internals (`backend/services/`).

## 2. Requirements

| ID | Requirement |
|---|---|
| FR-1 | `python manage.py run_bot` starts a PTB 21 `Application` in long-polling mode with `drop_pending_updates=True`. |
| FR-2 | Startup fails with `RuntimeError` when `settings.TELEGRAM_BOT_TOKEN` is empty. |
| FR-3 | Every handler exception is logged with its stack trace by a global error handler (`bot._log_handler_error`). |
| FR-4 | A Telegram user is mapped to a Lingaru `User` through `User.telegram_id == effective_user.id`. |
| FR-5 | `/start` returns the mapped user. If there is none, it creates one with username `tg_<id>` (random 6-hex suffix on collision), email `<username>@telegram.local`, `first_name` from Telegram and an unusable password. The reply says whether the account was created or already existed. |
| FR-6 | `/chat`, `/quiz` and `/stats` resolve the user with the same get-or-create logic as FR-5. |
| FR-7 | `/daily` resolves the user without creating one. If none is found, it replies "You haven't linked your account yet. Use /start first." |
| FR-8 | `/daily` lists up to 10 SRS cards due now for the user's `target_language` (`progress.services.get_due_cards`), as "french, english" lines, or reports that none are due. |
| FR-9 | `/word` sends one random `Vocabulary` (french, english, optional pronunciation, POS, gender (except `a`), and example), then tries to send a TTS clip of the French word. A TTS failure is logged and does not fail the command. |
| FR-10 | `/news` sends the newest `DiscoverCard` of type `news`. If none exists, it sends a random `news` or `trivia` card. If there is no card at all, it sends an explanatory message. News cards show the title, source name, `article_fr`, `article_en`, up to 5 vocabulary items (from the `vocabulary` or legacy `key_vocabulary` key) and a link to `source_url`. |
| FR-11 | `/stats` reports level name, total XP, current and longest streak, badge count, completed quiz count, total correct over total questions, and accuracy % (0 when there are no questions). |
| FR-12 | `/quiz [topic]` picks a random `Lesson` with at least one `Question`, optionally filtered by `topic.name_en` or `topic.name_fr` containing the argument (case-insensitive). It creates a `QuizSession` with `total_questions` set to the lesson's question count, asks every question in random order, records each answer as a `QuizAnswer`, and on the last answer completes the session with `score` = number of correct answers. |
| FR-13 | Quiz answers are correct when `strip().lower()` matches the stored `correct_answer`. MCQ prompts list the correct answer and `wrong_answers` in shuffled order. |
| FR-14 | `/cancel` during a quiz completes the session with its current score and clears the state. |
| FR-15 | `/chat` creates an `assistant.Conversation` (`title="Telegram chat"`, `context="telegram"`). Inside the conversation: text messages call the LLM with the full message history and the `conversation` system prompt for the user's `target_language`; photos call the vision model with the `image_query` prompt and save an `ImageQuery`; voice messages are transcribed, answered and returned as both a TTS voice note and text. User and assistant turns are saved as `Message` rows. `/endchat` ends the conversation. |
| FR-16 | LLM replies sent to Telegram have any fenced structured `blocks` payload removed (`assistant.blocks.extract_blocks`). |
| FR-17 | If the LLM fails in `/chat`, the bot replies with a "temporarily unavailable" message and the conversation stays open. |
| FR-18 | `/dictation` sends a TTS clip of a random vocabulary `example_sentence` and grades the typed reply by word-level accuracy. It is correct when accuracy is 0.9 or higher. `/cancel` aborts. |
| FR-19 | `/agents` lists active agents ordered by `order`, `name`, with inline buttons (`callback_data = "agent:<slug>"`, 2 per row). Tapping a button asks for input. The next text message is run through the LLM with `agent.system_prompt`, and the reply is sent in chunks of 3800 characters or less. An LLM failure is replied as "Agent failed: <ExceptionClass>". `/cancel` aborts. |
| FR-20 | `/help` and `/upload` return static text. |

## 3. Data model

The bot owns no tables. The fields it depends on:

| Model | Fields used | Notes |
|---|---|---|
| `users.User` | `telegram_id` BigInteger unique null; `first_name`; `username`; `target_language` | `telegram_id` is the only link between Telegram and Lingaru |
| `content.Vocabulary` | `french`, `english`, `pronunciation`, `part_of_speech`, `gender`, `example_sentence` | has a `language` field; the bot does not filter on it today |
| `content.Lesson` / `Question` / `Topic` | lesson `title`, `topic.name_en/name_fr`, question `type`, `prompt`, `correct_answer`, `wrong_answers`, `explanation` | |
| `practice.QuizSession` / `QuizAnswer` | `user`, `lesson`, `total_questions`, `score`, `completed_at`; answer `session`, `question`, `user_answer`, `is_correct` | |
| `progress.SRSCard` | via `get_due_cards(user, limit=10)` | language-scoped |
| `gamification` | `get_or_create_stats`, `get_level`, `UserBadge` | |
| `discover.DiscoverCard` | `type`, `title`, `content_json`, `source_url`, `generated_at` | |
| `assistant.Conversation` / `Message` / `ImageQuery` | | `Message.provider`, `tokens_used` are stored for assistant turns |
| `agents.Agent` | `slug`, `name`, `emoji`, `tagline`, `description`, `system_prompt`, `is_active`, `order` | |

Conversation state is kept in PTB `context.user_data`, in memory and not persisted:

| Flow | Keys |
|---|---|
| quiz | `quiz_session_id`, `quiz_questions`, `quiz_current_index`, `quiz_score`, `quiz_lesson_title` |
| chat | `conversation_id`, `user_id` |
| dictation | `dictation_clip_id`, `dictation_expected` |
| agents | `pending_agent_slug` |

## 4. API contract (Telegram commands)

| Trigger | Handler | Type | Replies |
|---|---|---|---|
| `/start` | `start_command` | Command | text |
| `/help` | `help_command` | Command | text |
| `/word` | `word_command` | Command | Markdown text + audio |
| `/news` | `news_command` | Command | Markdown text (link preview on) |
| `/daily` | `daily_command` | Command | Markdown text |
| `/stats` | `stats_command` | Command | text |
| `/upload` | `upload_command` | Command | text |
| `/agents` | `agents_command` | Command | Markdown + inline keyboard |
| callback `^agent:` → text | `agent_picked` → `agent_run` | Conversation (state `ASK_INPUT=1`) | text chunks |
| `/quiz [topic]` → text | `quiz_start` → `quiz_answer` | Conversation (state `ANSWERING=0`), fallback `/cancel` | text |
| `/chat` → text, photo, voice | `chat_start` → `chat_message`, `chat_photo`, `chat_voice` | Conversation (state `CHATTING=0`), fallback `/endchat` | text, voice |
| `/dictation` → text | `dictation_command` → `dictation_answer` | Conversation (state `WAITING_FOR_ANSWER=0`), fallback `/cancel` | text + audio, Markdown |

## 5. Business rules & invariants

- **ORM access:** every Django ORM call must run in a sync function wrapped with `sync_to_async`. Lazy relation access must not happen inside a coroutine.
- **Quiz grading:** case-insensitive exact string match (FR-13). The session `score` is recomputed from `QuizAnswer.is_correct` on completion.
- **Dictation:** pass threshold is accuracy ≥ 0.9. The feedback text comes from `services.stt.scoring.generate_feedback`.
- **Telegram limits:** messages are at most 4096 characters. The agents flow chunks at 3800.
- **XP:** the bot awards no XP directly. Quiz sessions completed in the bot count toward `/stats` aggregates.

## 6. Background jobs

| Command / job | Description |
|---|---|
| `python manage.py run_bot` | Long-running polling process (Docker service `bot`). It has no Celery tasks. |

## 7. Dependencies

- `python-telegram-bot` 21.
- `asgiref.sync.sync_to_async`.
- `services.llm.factory.create_llm_router`: Gemini primary, Groq fallback; vision is Gemini only.
- `services.llm.prompts.get_system_prompt`.
- `services.stt.groq_whisper.GroqWhisperProvider`.
- `services.stt.scoring`.
- `services.tts.service.get_or_create_audio`: Gemini TTS with gTTS fallback, cached in `media.AudioClip`.
- Apps: `users`, `content`, `practice`, `progress`, `gamification`, `discover`, `assistant`, `agents`.

## 8. Deviations / open questions

| # | Deviation |
|---|---|
| D-1 | `quiz_start` reads `lesson.topic.name_en` inside the coroutine without `select_related`, which can raise `SynchronousOnlyOperation`. |
| D-2 | In `chat.py`, `router.generate`, `router.generate_with_image` and `GroqWhisperProvider.transcribe` run on the event loop instead of through `sync_to_async`. |
| D-3 | `/word`, `/dictation`, `/quiz` and `/news` ignore `User.target_language`. TTS and STT are hard-coded to `"fr"`. This is inconsistent with the multi-language rule. |
| D-4 | Markdown v1 replies do not escape dynamic text. Daily, word and dictation use `**...**`, which is not v1 bold. |
| D-5 | `/chat` does not chunk replies longer than 4096 characters, and sends the full history on every turn. |
| D-6 | `/news` (`get_random_discover_card`) returns the newest card deterministically and does not check `expires_at`. |
| D-7 | There is no in-bot flow to attach a Telegram account to an existing web account. `/start` creates a separate account. The web Settings copy implies linking. Intent needs a decision. |
| D-8 | `quiz_score` in `user_data` is written but never read. The `username` argument of `get_or_create_telegram_user` is unused. |
| D-9 | The voice STT provider uploads OGG audio labelled as `audio.webm`. It is unclear whether Groq always detects the real format. |
