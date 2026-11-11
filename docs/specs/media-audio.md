# Spec: Media & Audio (TTS, STT, Pronunciation, Dictation)

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Audio TTS STT](../wiki/Audio-TTS-STT.md)

## 1. Purpose & scope

**In scope:**
- `backend/services/tts/`: `get_or_create_audio`, Gemini and gTTS providers, markdown stripping.
- `backend/services/stt/`: Groq Whisper provider, pronunciation scoring.
- `backend/apps/media/`: `AudioClip`, `PronunciationAttempt`, and the TTS, pronunciation-check and dictation endpoints.

**Out of scope:** voice chat orchestration ([assistant.md](assistant.md)), Telegram bot audio handlers, and exam-prep speaking grading. These consume the services above.

## 2. Requirements

**TTS**
- **FR-1** `get_or_create_audio(text, language="fr")` strips markdown from `text` and returns the existing `AudioClip` for `(clean_text, language)` if there is one.
- **FR-2** On a miss it synthesises audio:
  - With `GEMINI_API_KEY`: Gemini TTS (`gemini-2.5-flash-preview-tts`, voice `Aoede`), PCM wrapped as WAV at the sample rate given in the response MIME type (default 24 kHz, mono, 16-bit).
  - Any Gemini exception falls back to gTTS (MP3, `lang=language`).
  - Without a Gemini key: gTTS directly.
- **FR-3** Providers write to `MEDIA_ROOT/audio/<md5>.<wav|mp3>`. The hash covers `gemini-tts:<lang>:<voice>:<text>` for Gemini and `<lang>:<text>` for gTTS. An existing file is reused without calling the provider.
- **FR-4** A new `AudioClip(text_content=clean_text, audio_file="audio/<file>", language, provider="gemini_tts"|"gtts")` is created and returned.
- **FR-5** `strip_markdown` removes fenced code blocks, inline-code backticks, ATX headers, bold and italic markers, link syntax (keeping the text), list markers, blockquote markers and horizontal rules, collapses 3+ newlines to 2, and trims.

**STT**
- **FR-6** `GroqWhisperProvider.transcribe(audio_file, language="fr")` sends the bytes to Groq `whisper-large-v3` as `("audio.webm", bytes, "audio/webm")` with `response_format="text"` and the language hint, and returns the stripped transcription.

**Scoring**
- **FR-7** `normalize_text`: lowercase, trim, NFC, remove characters other than word characters, whitespace and apostrophes, collapse whitespace.
- **FR-8** `calculate_accuracy(expected, transcription)`:
  - Greedy in-order matching. For each expected word, find the next equal word after the previous match.
  - Returns `round(matches / len(expected_words), 2)`.
  - An empty expected text scores 1.0 if the transcription is also empty, else 0.0.
- **FR-9** `generate_feedback(accuracy, expected, transcription)`:

  | Accuracy | Feedback |
  |---|---|
  | ≥ 0.95 | "Excellent! Your pronunciation is nearly perfect." |
  | ≥ 0.8 | "Good job! ..." |
  | ≥ 0.5 | "Keep practicing! ..." |
  | otherwise | "Let's try again. ..." |

  Every tier below 0.95 includes `Expected: "<expected>", You said: "<transcription>"`.

**Endpoints**
- **FR-10** TTS endpoint: returns the clip for the requested text and language, generating it if needed.
- **FR-11** Pronunciation check:
  1. Transcribe the upload (`language="fr"`) and score it against `expected_text`.
  2. Persist a `PronunciationAttempt` with the audio file.
  3. Award 5 XP (`pronunciation`, `source_id="pronunciation_<attempt id>"`) and update the streak.
  4. An STT failure returns 503.
- **FR-12** Dictation start: pick a random `Vocabulary` with a non-empty `example_sentence`, ensure a TTS clip for it (`fr`), and return the clip. If none exists, return 404.
- **FR-13** Dictation check:
  1. Score `user_text` against the clip's `text_content`. `correct = accuracy >= 0.9`.
  2. Award 15 XP (`dictation`, `source_id="dictation_clip_<clip id>"`) and update the streak.
  3. An unknown clip returns 404.

## 3. Data model

### `AudioClip` (`media_audio_clips`)
| Field | Type | Notes |
|---|---|---|
| `text_content` | TextField | markdown-stripped text |
| `audio_file` | FileField `audio/` | relative path set by the provider |
| `language` | CharField(10) | default `fr` |
| `provider` | CharField(20) | choices list `gtts` only; code also writes `gemini_tts` |
| `created_at` | DateTimeField auto_now_add | |

Constraint `UniqueConstraint(text_content, language, name="unique_text_language")`. The table acts as the TTS cache.

### `PronunciationAttempt` (`media_pronunciation_attempts`)
| Field | Type | Notes |
|---|---|---|
| `user` | FK `users.User`, CASCADE | related_name `pronunciation_attempts` |
| `vocabulary` | FK `content.Vocabulary`, SET_NULL, null | |
| `expected_text` | TextField | |
| `audio_file` | FileField `pronunciation/` | |
| `transcription` | TextField, default `""` | |
| `accuracy_score` | FloatField, default 0.0 | 0.0 to 1.0 |
| `feedback` | TextField, default `""` | |
| `created_at` | DateTimeField auto_now_add | |

Ordering `-created_at`.

## 4. API contract

Base `/api/media/`. Auth: JWT `IsAuthenticated`.

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `tts/` | JSON `{text: string ≤1000, non-blank after strip; language?: string ≤10, default "fr"}` | 200 `AudioClip`; 400 |
| POST | `pronunciation/check/` | multipart `{audio: file, expected_text: string ≤1000, vocabulary_id?: int\|null}` | 200 `{id, expected_text, transcription, accuracy_score, feedback, created_at}`; 400; 503 |
| GET | `dictation/start/` | | 200 `{sentence_id: <vocabulary id>, audio_clip: AudioClip}`; 404 `{"detail": "No sentences available for dictation."}` |
| POST | `dictation/check/` | JSON `{audio_clip_id: int, user_text: string ≤2000}` | 200 `{correct: bool, expected, user_text, accuracy: float, feedback}`; 400; 404 `{"detail": "Audio clip not found."}` |

`AudioClip` = `{id, text_content, language, provider, audio_url (absolute when a request is in context), created_at}`.

Language scoping: none. TTS honours the `language` field. Pronunciation check and dictation use French.

## 5. Business rules & invariants

| Activity | XP | `activity_type` | `source_id` |
|---|---|---|---|
| Pronunciation check | 5 per call | `pronunciation` | `pronunciation_<attempt id>` |
| Dictation check | 15 per call | `dictation` | `dictation_clip_<clip id>` |

- Each award is followed by `check_streak(user)`.
- Dictation is correct at accuracy ≥ 0.9.
- An `AudioClip` is synthesised at most once per `(clean text, language)`. The disk file is also reused across DB resets.
- Gemini TTS ignores `language`: it reads the text as given. Only gTTS uses `language`.

## 6. Background jobs

There are no Celery tasks in this app. All synthesis and transcription run synchronously in the request. Other apps (bot, exam prep, voice chat) call the same services inline.

## 7. Dependencies

| Dependency | Use |
|---|---|
| `google-genai` | Gemini TTS |
| `gtts` | fallback TTS (Google Translate) |
| `groq` | Whisper STT |
| `apps.gamification.services` | `award_xp`, `check_streak` |
| `apps.content.Vocabulary` | dictation sentences, attempt FK |
| Settings | `GEMINI_API_KEY`, `GROQ_API_KEY`, `MEDIA_ROOT`, `MEDIA_URL` |

## 8. Deviations / open questions

- Pronunciation check and dictation always use French (`language="fr"`). Dictation does not filter `Vocabulary` by `target_language`. Voice chat uses `fr` for STT and TTS too ([assistant.md](assistant.md)).
- The frontend `generateTTS(text)` and `AudioPlayButton` never send `language`, so every TTS request is `fr`.
- XP awards for pronunciation and dictation are not idempotent. Every call awards again.
- `TTSView` has no exception handling. Provider errors, an unsupported `language` for gTTS, or a race on the unique constraint (filter-then-create without `get_or_create`) return 500.
- The unique constraint is on a free `TextField`. Long texts (for example whole voice-chat replies) can exceed practical index-row limits. Open question: key the cache on a hash column.
- `AudioClip.PROVIDER_CHOICES` omits `gemini_tts`.
- Whisper uploads are always labelled `audio/webm`, whatever the actual container (for example `audio/mp4` from Safari).
- Gemini TTS writes uncompressed WAV, and voice chat synthesises the full reply with no length cap.
- The Gemini TTS model is a preview model, and its voice is not part of the `AudioClip` key.
- `DictationStartView` uses `order_by("?")` (full random sort).
- `services/**` tests (scoring, providers) are not collected by default (`pytest.ini` `testpaths = apps`).
