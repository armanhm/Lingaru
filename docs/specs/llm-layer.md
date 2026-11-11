# Spec: LLM Layer

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [LLM Providers and Prompts](../wiki/LLM-Providers-and-Prompts.md)

## 1. Purpose & scope

**In scope:** `backend/services/llm/`:
- the provider interface (`base.py`)
- the Gemini and Groq providers
- primary/fallback routing (`router.py`)
- router construction from settings (`factory.py`)
- the per-language system prompt registry (`prompts.py`)

**Out of scope:**
- Feature-specific prompts stored elsewhere: agents ([agents.md](agents.md)), agentic footer and blocks ([assistant.md](assistant.md)), memory extractor ([memory.md](memory.md)), dictionary.
- Embeddings ([documents-rag.md](documents-rag.md)).
- TTS and STT ([media-audio.md](media-audio.md)).
- The dictionary cache (`apps/dictionary/cache.py`).

## 2. Requirements

- **FR-1** Every text provider exposes `generate(messages: list[{"role": "user"|"assistant", "content": str}], system_prompt: str) -> LLMResponse`.
- **FR-2** `LLMResponse` carries `content: str`, `provider: str` (`"gemini"` or `"groq"`), `tokens_used: int` (0 when the provider reports no usage).
- **FR-3** `GeminiProvider.generate` maps role `user` to Gemini `user` and every other role to `model`, and passes `system_prompt` as `system_instruction`.
- **FR-4** `GroqProvider.generate` sends `[{"role": "system", "content": system_prompt}, *messages]` to `chat.completions.create`.
- **FR-5** `GeminiProvider.generate_with_image(messages, image_data, image_mime_type, system_prompt)` sends one user turn: an inline image blob followed by the text of the last message (if any).
- **FR-6** Providers that do not support vision raise `NotImplementedError` from `generate_with_image`.
- **FR-7** `ProviderRouter.generate` returns the primary's response. If the primary raises any exception and a fallback is configured, it logs a WARNING and returns the fallback's response. If there is no fallback, or the fallback also raises, the exception propagates.
- **FR-8** `ProviderRouter.generate_with_image` calls only the primary and propagates exceptions.
- **FR-9** `create_llm_router()`:
  - Gemini primary + Groq fallback when both keys are set.
  - The single available provider as primary with no fallback when only one key is set.
  - Raises `RuntimeError` when neither key is set.
- **FR-10** `get_system_prompt(language, mode)` returns `SYSTEM_PROMPTS[language][mode]`. An unknown `language` resolves to `fr`, and an unknown `mode` resolves to that language's `conversation`.
- **FR-11** Every language in `SYSTEM_PROMPTS` defines the same set of modes (parity enforced by `services/llm/tests/test_prompts.py`).
- **FR-12** The `rag_conversation` prompt contains exactly one `{context}` placeholder and no other `str.format` fields.

## 3. Data model

There are no models. Persisted LLM metadata lives on `assistant.Message.provider` and `assistant.Message.tokens_used` ([assistant.md](assistant.md)).

Prompt registry (`SYSTEM_PROMPTS`, languages `fr` and `en`):

| Mode | Output contract |
|---|---|
| `conversation`, `grammar_correction`, `grammar_explanation`, `image_query` | prose |
| `rag_conversation` | prose; template with `{context}` |
| `roleplay_hotel`, `roleplay_airport`, `roleplay_bank`, `roleplay_school`, `roleplay_job_interview`, `roleplay_restaurant`, `roleplay_doctor`, `roleplay_market`, `roleplay_train`, `roleplay_pharmacy` | prose, in character |
| `exam_ee_grading` | JSON `{score, max_score:20, grammar_score, vocabulary_score, coherence_score, task_score, spelling_score, feedback_fr, feedback_en, errors:[{original, corrected, explanation}], corrected_text}` |
| `exam_eo_grading` | JSON `{score, max_score:20, fluency_score, vocabulary_score, grammar_score, task_score, coherence_score, feedback_fr, feedback_en, pronunciation_notes, grammar_notes}` |
| `news_generator` | JSON `{title, summary, topic, level, article_fr, article_en, vocabulary[6]{french, english, pos, example_fr}, expressions[3]{fr, en, note}, grammar_points[2]{title, explanation, example_fr}}` |
| `trivia_generator` | JSON `{title, summary, fact_fr, fact_en}` |

For `en`, the JSON prompts keep the FR key names (`*_fr`) for schema compatibility.

## 4. API contract

There are no HTTP endpoints. The Python API is:

| Symbol | Signature |
|---|---|
| `services.llm.factory.create_llm_router` | `() -> ProviderRouter` |
| `ProviderRouter.generate` | `(messages, system_prompt) -> LLMResponse` |
| `ProviderRouter.generate_with_image` | `(messages, image_data: bytes, image_mime_type: str, system_prompt) -> LLMResponse` |
| `services.llm.prompts.get_system_prompt` | `(language: str, mode: str) -> str` |

Callers include:
- `apps/assistant/views.py`
- `apps/agents` (via assistant)
- `apps/discover/{services,news_fetcher}.py`
- `apps/exam_prep/tasks.py`
- `apps/content/tasks.py`
- `apps/notes/views.py`
- `apps/my_notes/views.py`
- `apps/dictionary/views.py` and its seed command
- `apps/bot/handlers/{chat,agents}.py`
- `services/memory/extractor.py` (builds its own `ProviderRouter`)

## 5. Business rules & invariants

- Gemini is the primary for chat and vision. Groq is the text fallback only.
- The memory extractor intentionally inverts the order (Groq primary) for latency.
- Callers turn router exceptions into user-facing HTTP 503s. The router itself never returns an error object.
- No call sets temperature, max output tokens or a response format. Provider defaults apply.
- FR prompts instruct the model never to use the em-dash (house style).

## 6. Background jobs

None in this layer. Celery tasks in other apps (`exam_prep`, `content`, `discover`) call the router.

## 7. Dependencies

| Dependency | Version pin (`requirements.txt`) | Used for |
|---|---|---|
| `google-genai` | `>=1.0.0,<2.0` | Gemini chat and vision |
| `groq` | `>=0.11.0,<1.0` | Groq chat |
| Settings | | `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.0-flash`), `GROQ_API_KEY`, `GROQ_MODEL` (default `llama-3.3-70b-versatile`) |

## 8. Deviations / open questions

- No explicit request timeout and no retry or backoff for transient (429/5xx) errors. The fallback fires on every exception class, including client errors.
- A `None` or empty `content` (for example Gemini safety-blocked output) is returned as a success and does not trigger the fallback.
- The router and SDK clients are constructed on every call, so HTTP connections are not reused.
- `generate_with_image` ignores all but the last message (no history).
- `trivia_generator` has no remaining caller.
- LLM JSON parsing is reimplemented in about seven modules. There is no shared helper, and the providers' native JSON modes are not used.
- The cache-first helper described in `docs/superpowers/specs/2026-06-27-llm-cache-layer-design.md` as `services/llm/cache.py` lives in `apps/dictionary/cache.py`.
- `pytest.ini` `testpaths = apps` excludes `services/**` tests from default and CI runs.
- Model defaults should be reviewed against provider deprecation schedules.
