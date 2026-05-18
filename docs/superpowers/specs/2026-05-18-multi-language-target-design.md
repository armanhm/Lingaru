# Multi-Language Target -- v2.0.0 Design

**Status:** approved at brainstorming, ready for implementation planning
**Date:** 2026-05-18
**Owner:** arman
**Target release:** v2.0.0

## Problem

Lingaru is hardcoded around French as the only target language. All content tables, LLM prompts, dictionary lookups, news pipeline, and frontend copy assume the user is learning French. We want the same app to support learning English -- with the architecture in place for additional languages (Spanish, etc.) later without further refactoring.

This is a breaking architectural change: every content-listing API endpoint will start filtering by the authenticated user's `target_language`. We are deliberately accepting that breakage and tagging the result as `v2.0.0`.

## Goal

Ship a v2.0.0 release that:

1. Adds `target_language` as a first-class user property, picked at onboarding and editable in Settings -> Profile.
2. Threads the language through every content table (`Topic`, `Lesson`, `Vocabulary`, `GrammarRule`, `ReadingText`, `Question`, `VideoLesson`, `GrammarCategory`, `GrammarTopic`, `GrammarDrillItem`, `DiscoverCard`, `ExamExercise`, `MemoryNote`) so each row belongs to exactly one language.
3. Adds an English content seed (5 topics, 25 lessons, ~300 vocabulary) so EN users have something real on day one.
4. Localizes LLM prompts per-language (chat, dictionary, news generation, agents).
5. Shows "coming soon" badges for features that don't yet have EN content/support (Exam Prep, Grammar Booster, Conjugation drills, Gender Snap).
6. Displays the current target language as a flag emoji next to the logo at the top-left, on every authenticated page.

Out of scope (each will be its own future spec):

- Phase L3 -- EN grammar content for Grammar Booster.
- Phase L4 -- English exam prep (IELTS/TOEFL/Cambridge -- not the same framework as TCF/TEF).
- Phase L5 -- a richer EN news pipeline (v2.0.0 only seeds ~10 articles).
- Phase L6 -- mini-game adaptations for EN (phrasal-verb game, irregular-verb game, etc.).
- Additional languages beyond EN. The architecture supports them; the content does not exist yet.

## Non-goals

- Letting a user be "active in both FR and EN at once." A user has exactly one `target_language` at a time; switching is a deliberate Settings change.
- Per-conversation language override. The chat speaks in whatever the user's current target_language is.
- Re-using FR memory notes as EN context (or vice versa). Notes are per-language; the EN assistant doesn't see notes the user wrote while learning FR.
- Top-nav language switcher. Picker lives only in onboarding and Settings (with a read-only flag in the header to surface state).

## Architecture

Approach A from the brainstorm: **language discriminator field everywhere, query-level filtering**. Add a `language` `CharField` to every content table. Add `target_language` to User. Every content query gains a `filter(language=request.user.target_language)`. LLM prompts dispatch on the same key. No new abstractions.

```
                Onboarding
                    │
            ┌───────▼────────┐
            │  Pick target   │
            │   language     │
            │   (FR / EN)    │
            └───────┬────────┘
                    │
                    ▼
              ┌──────────┐
              │ User row │  target_language = "fr" | "en"
              └────┬─────┘
                   │ read by every content-listing endpoint
                   ▼
       ┌────────────────────────────────────┐
       │ GET /api/content/topics/            │  -> filter(language=user.target_language)
       │ GET /api/content/vocabulary/random/ │  -> filter(language=user.target_language)
       │ GET /api/news/                      │  -> filter(language=user.target_language)
       │ POST /api/assistant/chat/           │  -> SYSTEM_PROMPTS[user.target_language][mode]
       │ POST /api/dictionary/lookup/        │  -> language-aware LLM prompt
       │ GET  /api/agents/{slug}/            │  -> system_prompt vs system_prompt_en
       └────────────────────────────────────┘

                Frontend reads user.target_language
                          │
                          ▼
            Conditional UI:
            - Flag emoji next to logo
            - Hide / "coming soon" badges on EN-unsupported features
            - Language-aware widget empty-state copy
            - Settings language picker with confirm modal
```

### Two independent language dimensions (intentional)

- `User.ui_language` (already exists) -- chrome language: nav, buttons, settings copy. EN or FR.
- `User.target_language` (new) -- learning target: what content, lessons, grammar, news, and assistant style the user sees.

These compose freely. A Spanish-speaking user can have `ui_language="en"` (browses the app in English) and `target_language="fr"` (is learning French), or vice versa.

## Data model

### New shared constant

`backend/apps/users/constants.py` (new file):

```python
LANGUAGE_CHOICES = [
    ("fr", "French"),
    ("en", "English"),
]
LANGUAGE_CODES = {code for code, _ in LANGUAGE_CHOICES}
```

Why a dedicated module: every app needs the same choices list. Putting it in `apps.users.models` creates import cycles (every app importing User would transitively load it).

### `User`

```python
class User(AbstractUser):
    # ... existing fields ...
    target_language = models.CharField(
        max_length=8,
        choices=LANGUAGE_CHOICES,
        default="fr",
        help_text="The language the user is learning. Distinct from native_language "
                  "(what they speak natively) and ui_language (the app chrome).",
    )
```

Migration: `AddField` with `default="fr"`. Django auto-backfills existing rows. No `RunPython` needed.

### `apps.content` -- seven models touched

All seven gain the same field:

```python
from apps.users.constants import LANGUAGE_CHOICES

class Topic(models.Model):
    # ... existing ...
    language = models.CharField(
        max_length=8,
        choices=LANGUAGE_CHOICES,
        default="fr",
        db_index=True,
    )
    class Meta:
        indexes = [models.Index(fields=["language", "order"])]
```

Same pattern: `Lesson`, `Vocabulary`, `GrammarRule`, `ReadingText`, `Question`, `VideoLesson`. Each gets `db_index=True` because language is a high-cardinality filter (2 values, but every query uses it).

One migration covering all seven. Auto-backfill via `default="fr"`.

### `apps.grammar`

`GrammarCategory`, `GrammarTopic`, `GrammarDrillItem` get the same `language` field. `GrammarMastery` and `GrammarSession` are user-progress tables that ride along via FK; no language field needed.

### `apps.discover.DiscoverCard`

Add `language` field. Backfill all rows to `"fr"`. Affects both Discover-feed cards (word/grammar/trivia) and News cards.

### `apps.exam_prep.ExamExercise`

Add `language` field, default `"fr"`. Existing TCF/TEF rows backfill to FR. EN exam prep is deferred to Phase L4; at v2.0.0 the endpoints return empty for EN users.

### `apps.memory.MemoryNote`

```python
class MemoryNote(models.Model):
    # ... existing ...
    language = models.CharField(
        max_length=8,
        choices=LANGUAGE_CHOICES,
        default="fr",
        db_index=True,
    )
    class Meta:
        indexes = [
            models.Index(fields=["user", "is_active", "-updated_at"]),  # existing
            models.Index(fields=["user", "language", "is_active"]),     # new
        ]
```

Backfill: existing notes get `"fr"`.

### `apps.agents.Agent`

Add a sibling field for English system prompts. Deliberately NOT a JSON column -- FR is the primary, EN is the addition; symmetric storage would imply symmetric ownership.

```python
class Agent(models.Model):
    # ... existing ...
    system_prompt = models.TextField(
        help_text="System prompt for FR learners (the default target language).",
    )
    system_prompt_en = models.TextField(
        blank=True,
        default="",
        help_text="System prompt for EN learners. Falls back to system_prompt if empty.",
    )
```

If a future migration introduces a third language, we promote this to a JSON column at that point.

### Tables intentionally NOT touched

- `SRSCard` -- FK to `Vocabulary`. Language is implicit via the join.
- `MistakeEntry` -- FK to `Question`. Same.
- `LessonCompletion` -- FK to `Lesson`. Same.
- `GrammarMastery`, `GrammarSession` -- FK to `GrammarTopic`. Same.
- `Conversation`, `Message` -- chat history is language-shared. A user can have FR chats from yesterday and EN chats from today; both appear in the conversation list. The system prompt used at the time is what made the assistant respond in FR or EN.

## Service layer

### LLM prompts

`backend/services/llm/prompts.py` becomes a 2-level dict:

```python
SYSTEM_PROMPTS = {
    "fr": {
        "conversation": "Tu es Claire, une tutrice de français...",
        "grammar_correction": "...",
        "grammar_explanation": "...",
        "rag_conversation": "...",
        "image_query": "...",
    },
    "en": {
        "conversation": "You are Claire, an English tutor...",
        "grammar_correction": "...",
        "grammar_explanation": "...",
        "rag_conversation": "...",
        "image_query": "...",
    },
}


def get_system_prompt(language: str, mode: str) -> str:
    """Resolve a (language, mode) pair to a system prompt.

    Falls back to FR for unknown languages (defensive; choices field
    should prevent this in practice). Falls back to 'conversation' for
    unknown modes, mirroring the current behavior.
    """
    lang_prompts = SYSTEM_PROMPTS.get(language) or SYSTEM_PROMPTS["fr"]
    return lang_prompts.get(mode) or lang_prompts["conversation"]
```

Every existing `SYSTEM_PROMPTS[mode]` call site becomes `get_system_prompt(request.user.target_language, mode)`. Affects `ChatView`, `ImageQueryView`, `VoiceChatView`, `apps.dictionary` views. ~10 call sites; each is a one-line change.

The agentic-mode footer (`apps.assistant.agentic_prompt.append_agentic_footer`) takes the same per-language treatment. Same shape: small dict, dispatch on language.

### Agent resolution

In `apps.assistant.views.ChatView`, agent prompt selection changes from:

```python
if agent and agent.system_prompt:
    system_prompt = agent.system_prompt
```

to:

```python
if agent:
    agent_prompt = (
        agent.system_prompt_en
        if request.user.target_language == "en" and agent.system_prompt_en
        else agent.system_prompt
    )
    if agent_prompt:
        system_prompt = agent_prompt
```

If `system_prompt_en` is empty (agent not yet localized), fall back to `system_prompt` (FR). Agent at least functions; user gets a tutor who speaks French.

### Memory layer

- `assemble_user_context(user)` adds `language=user.target_language` to its `MemoryNote.objects.filter(...)` call. Two-line change.
- `maybe_extract_note(...)` writes new notes with `language=user.target_language`.

### Content endpoints

| Endpoint | Filter added |
|---|---|
| `GET /api/content/topics/` | `Topic.objects.filter(language=user.target_language)` |
| `GET /api/content/topics/{id}/` | filter; 404 on cross-language |
| `GET /api/content/lessons/{id}/` | filter; 404 on cross-language |
| `GET /api/content/vocabulary/random/` | filter (combines with existing single_word / gendered filters) |
| `GET /api/discover/feed/` | filter |
| `GET /api/news/` | filter |
| `POST /api/news/generate/` | uses language to pick generation prompt; writes new card with `language=user.target_language` |
| `GET /api/grammar/hub/` | filter on `GrammarCategory` + `GrammarTopic` |
| `GET /api/grammar/topics/{slug}/` | 404 on cross-language slug match |
| `POST /api/grammar/sessions/start/` | only allow drills from topics matching user's target_language |
| `GET /api/exam-prep/*` | filter; EN target returns empty for v2.0.0 |
| `POST /api/dictionary/lookup/` | LLM prompt dispatches on user's target_language |
| `POST /api/dictionary/conjugate/` | returns 400 with `{"detail": "...", "code": "feature_unavailable_for_language"}` if target_language="en" |

Two response conventions, kept consistent across all endpoints:

- **List endpoints** (`/topics/`, `/news/`, `/grammar/hub/`, `/exam-prep/...`, etc.) return **`200 OK` with an empty list / empty payload** when the user's target_language has no matching rows. Easier for the frontend (no special-case error handling) and matches how an FR user with zero lessons would see the same endpoint today.
- **Detail / slug endpoints** (`/topics/{id}/`, `/lessons/{id}/`, `/grammar/topics/{slug}/`) return **`404 Not Found`** for cross-language access. Same idiom as Phase A's wrong-owner pattern. No information leak about whether the row exists in another language.

### Content generation tasks

`apps.discover.tasks.generate_*` (the periodic Celery jobs that create daily Discover cards):

```python
@shared_task
def generate_daily_cards():
    active_languages = (
        User.objects.values_list("target_language", flat=True)
        .distinct()
    )
    for language in active_languages:
        _generate_word_card(language)
        _generate_grammar_card(language)
        _generate_trivia_card(language)
```

Each per-language generation uses the per-language LLM prompt and writes the new `DiscoverCard` row with the matching `language` value.

### News pipeline

Same pattern. The news generator prompt becomes language-aware. EN news articles are generated with EN topics (same slugs: politics, tech, society, etc. -- the taxonomy is shared) and EN vocabulary, expressions, and grammar pulled out for guided study.

For v2.0.0 launch the seed runs `seed_news_en` once per topic (~10 articles).

## Frontend

### `target_language` in `User` serializer + context

`apps.users.serializers.UserSerializer` gains `target_language` in its `fields` tuple. The frontend `AuthContext` (which already holds `user.ui_language`, `user.mode`) picks it up automatically.

### Onboarding -- new first step

Currently 2 steps (mode + level). Add language selection BEFORE the existing two.

Layout:

```
┌───────────────────────────────────────────┐
│  Welcome to Lingaru                       │
│  Welcome step 1 / 3                       │
│                                           │
│  What language do you want to learn?      │
│                                           │
│  ┌─────────────┐    ┌─────────────┐       │
│  │     🇫🇷       │    │     🇬🇧      │       │
│  │   French    │    │   English   │       │
│  └─────────────┘    └─────────────┘       │
│                                           │
│              [ Continue → ]               │
└───────────────────────────────────────────┘
```

Two large language cards, click-to-select pattern same as the existing mode/level pickers. Saves to `user.target_language` on submit.

Existing users skip this step. The onboarding-needed check stays unchanged (it gates on `mode` being unset, which existing users have already set).

New i18n keys: `onboarding.languageTitle`, `onboarding.languageSubtitle`, language label strings (which use the language's NATIVE name: "Français" / "English", not the chrome-translated form).

### Settings -- Profile tab

A new field row in the existing Profile tab, near `target_level`:

```
Username         [ alice                                ]
Email            [ alice@example.com                    ]
Native language  [ English          ▾ ]
Target language  [ 🇫🇷 French      ▾ ]
Target level     [ B2               ▾ ]
Daily goal       [─────●────────] 15 min
                          [ Save profile ]
```

The selector reuses the same compact style as the existing `native_language` selector. Saving submits a PATCH to `/api/users/me/`.

**Confirmation modal on switch** (target_language is high-impact and surprising-to-undo):

```
Switch to English?

Your French progress is preserved and you can switch back any
time. Most features show "coming soon" for English at the moment.

                                   [ Cancel ] [ Switch ]
```

Switching FR -> EN and EN -> FR have distinct modal copies. Same code path.

On confirmation, the frontend submits the PATCH then triggers `window.location.reload()`. Soft reload preserves URL and avoids half-switched state.

### Flag indicator next to logo

Persistent flag emoji at the top-left, on every authenticated page. Reads `user.target_language` from `AuthContext`.

```
┌─────────────────────────────────────────────────────────────┐
│  [L] Lingaru  🇫🇷    Dashboard  Topics  Discover  ...        │
│      ↑      ↑                                                │
│      logo  flag of target_language                           │
└─────────────────────────────────────────────────────────────┘
```

Component shape:

```jsx
function LearningLanguageFlag({ language }) {
  const { t } = useTranslation();
  const FLAG_FOR = { fr: "🇫🇷", en: "🇬🇧" };
  const NAME_FOR = { fr: t("languages.fr"), en: t("languages.en") };
  if (!FLAG_FOR[language]) return null;
  return (
    <span
      role="img"
      aria-label={t("layout.learningLanguageAria", { language: NAME_FOR[language] })}
      title={t("layout.learningLanguageTooltip", { language: NAME_FOR[language] })}
      className="ml-1 text-lg leading-none select-none"
    >
      {FLAG_FOR[language]}
    </span>
  );
}
```

Behavior:

- **Read-only badge.** No `onClick`, no underline, no button affordance. Pure status indicator.
- **Tooltip on hover**: "Learning French. Change in Settings."
- **`aria-label`** for screen readers.
- Hidden when `user` is null (logged-out routes use a different shell).
- Vertically center-aligned with the logo wordmark, `ml-1` (4px) breathing room.
- On mobile, same position (right of wordmark in the header bar).

If a future migration introduces a third language but the `FLAG_FOR` map isn't updated, returns `null` -- app stays functional, just visually less polished.

### "Coming soon" badges + feature availability registry

`frontend/src/components/ui/ComingSoonBadge.jsx` (new):

```jsx
export function ComingSoonBadge({ children, available, ctaHref }) {
  const { t } = useTranslation();
  if (available) return children;
  return (
    <div className="relative opacity-60 pointer-events-none">
      {children}
      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
        {t("common.comingSoon")}
      </span>
    </div>
  );
}
```

`frontend/src/lib/featureAvailability.js` (new):

```js
const AVAILABILITY = {
  // (feature_key, target_language) -> bool
  exam_prep:       { fr: true, en: false },
  grammar_booster: { fr: true, en: false },
  gender_snap:     { fr: true, en: false },
  conjugation:     { fr: true, en: false },
};

export function isAvailable(feature, language) {
  return AVAILABILITY[feature]?.[language] ?? true;
}
```

Components consult the registry. FR users see no badge anywhere. EN users see badges on Exam Prep, Grammar Booster, Gender Snap, Conjugation.

### EN-affected surfaces at v2.0.0 launch

- `/exam-prep` -- top-level page shows a "coming soon" hero. Nav still renders the link.
- `/grammar` (Grammar Booster) -- same.
- `/mini-games` -- GenderSnap card badged "coming soon"; other mini-games work normally because Vocabulary now has EN entries.
- `/dictionary` -- Conjugation tab badged "coming soon"; Lookup works.
- `/topics` -- fully works (5 EN topics seeded).
- Inline agentic widgets (`gender_snap`, `conjugation`) -- render a small "coming soon for English" card instead of fetching. Early return in the widget component, gated on `user.target_language === "en"`.
- `Discover` / `News` -- fully works (seeded EN cards + per-language generation).

### New i18n keys

```json
{
  "onboarding": {
    "languageTitle": "What do you want to learn?",
    "languageSubtitle": "We'll tailor your lessons and assistant to this language. You can change it in Settings."
  },
  "settings": {
    "profile": {
      "targetLanguage": "Target language",
      "targetLanguageDescription": "The language you're learning. Different from the app's interface language.",
      "switchLanguageConfirmTitle": "Switch to {{language}}?",
      "switchLanguageConfirmBody": "Your {{currentLanguage}} progress is preserved. Most {{language}} features show 'coming soon' for now.",
      "switchLanguageConfirmYes": "Switch",
      "switchLanguageConfirmCancel": "Cancel"
    }
  },
  "languages": {
    "fr": "French",
    "en": "English"
  },
  "layout": {
    "learningLanguageAria": "Currently learning {{language}}",
    "learningLanguageTooltip": "Learning {{language}}. Change in Settings."
  },
  "common": {
    "comingSoon": "Coming soon",
    "comingSoonForEnglish": "Coming soon for English",
    "askAssistantInstead": "For now, ask the assistant about this."
  }
}
```

Mirrored in `fr.json` with French translations.

## Error handling

The refactor is meant to **never break any FR-side behavior**. Existing tests pass unchanged; new tests cover EN paths and cross-language scenarios.

| Boundary | Failure mode | Behavior |
|---|---|---|
| Cross-language deep link | `GET /api/content/topics/12/` where Topic 12 is FR but caller's target_language is EN | **404**. Same idiom as Phase A's wrong-owner pattern. No information leak. |
| LLM prompt missing for unknown language | `get_system_prompt("es", "conversation")` if ES somehow gets into a User row | **Falls back to FR prompts**, logs WARNING. The `target_language` field choices constrain this in practice. |
| Agent's `system_prompt_en` is empty | EN user invokes an agent we haven't localized | **Falls back to `system_prompt` (FR)**, no error. Agent functions; user gets a tutor who speaks French. Logged at DEBUG. |
| Conjugate called with EN target | `POST /api/dictionary/conjugate/` for EN user | **400 with structured response**: `{"detail": "...", "code": "feature_unavailable_for_language"}`. Frontend should prevent the call via `isAvailable()`, but defense-in-depth at the boundary. |
| GenderSnap / Conjugation widget rendered for EN | LLM emits `feature_widget: gender_snap` for an EN user | **Widget renders a "coming soon for English" card** via early return. No API call. |
| `MemoryNote.language` mismatch | Edge case after migration | `assemble_user_context` filters by `language=user.target_language`. EN users only see EN notes; old FR notes only show for FR users. |

The new structured error code `feature_unavailable_for_language` becomes a convention for any future feature gate (Phase L3 grammar, L4 exam prep). Lets the frontend show a unified "coming soon" treatment without parsing English text.

## Testing

### Backend new tests (organized by concern, not by app)

| File | What it covers |
|---|---|
| `apps/users/tests/test_target_language.py` | User defaults to `"fr"`; valid choices; PATCH `/api/users/me/` accepts language updates; rejects invalid codes. |
| `apps/content/tests/test_language_filtering.py` | Topics/Lessons/Vocabulary endpoints filter by language. EN user gets 5 EN topics, FR user gets the FR set. 404 on cross-language Topic detail. Random vocab respects language. |
| `apps/grammar/tests/test_language_filtering.py` | Grammar hub / topics list / topic detail / drill session start all respect language. EN target user gets empty hub at v2.0.0. 404 on cross-language slug. |
| `apps/discover/tests/test_language_filtering.py` | Discover feed and News list filtered by language. Generate-more task respects language for new card creation. |
| `apps/dictionary/tests/test_language_behavior.py` | Lookup prompts dispatch on language. Conjugate returns 400 + structured code for EN target. |
| `apps/exam_prep/tests/test_language_filtering.py` | EN target user gets empty exam-prep responses; sessions/start rejects EN. |
| `apps/assistant/tests/test_chat_language.py` | ChatView picks the right SYSTEM_PROMPTS branch based on target_language. Agent with `system_prompt_en` set picks EN; agent with empty `system_prompt_en` falls back to FR. The agentic footer dispatches per language. |
| `apps/memory/tests/test_language_scoping.py` | `MemoryNote.language` defaults to `"fr"` on create. `assemble_user_context` only pulls notes matching user's target_language. `maybe_extract_note` writes new notes with the caller's target_language. PATCH source-immutability test still passes (orthogonal). |
| `services/llm/tests/test_prompts.py` | `get_system_prompt("fr", "conversation")` returns FR prompt; `get_system_prompt("en", "...")` returns EN; unknown language -> FR fallback; unknown mode -> "conversation" fallback. |

### Data migration tests

Three migration tests using the `django.test` migration framework:

| Test | Asserts |
|---|---|
| `apps/content/migrations/test_0XXX_language_backfill.py` | Pre-existing Topic / Lesson / Vocabulary / etc. rows all get `language="fr"` after migration. Zero NULL or empty. |
| `apps/memory/migrations/test_0XXX_language_backfill.py` | Pre-existing MemoryNote rows all get `language="fr"`. |
| `apps/users/migrations/test_0XXX_target_language_default.py` | Pre-existing User rows all get `target_language="fr"`. |

Each test ~30 lines. Cheap insurance for an irreversible backfill that touches a 6-week content investment.

### Frontend tests

- `frontend/e2e/onboarding.spec.js` -- adds a third step (language picker) to the onboarding regression. Update existing Playwright baselines in the matching Docker image.
- `frontend/e2e/settings.spec.js` -- adds: log in as EN-target user -> navigate to Settings -> target_language dropdown shows English selected -> switch to French -> confirmation modal -> confirm -> page reload + flag flips.
- `frontend/src/components/__tests__/LearningLanguageFlag.test.jsx` -- small unit test for the flag component (renders correct emoji per language, returns null for unknown).

### Observability

- **Sentry tags** -- every request tags `language=user.target_language`. Lets us slice errors and performance by language. Two-line change to wherever we set Sentry user tags today.
- **Admin** -- register `target_language` on User admin as a list filter. Quick visibility on "how many EN-target users do we have."

## Rollout

### Migration order (matters)

1. `apps.users` -- `AddField target_language` (default "fr"). Auto-backfill.
2. `apps.content` -- `AddField language` on all 7 models. Auto-backfill.
3. `apps.grammar` -- `AddField language` on 3 models. Auto-backfill.
4. `apps.discover` -- `AddField language` on DiscoverCard. Auto-backfill.
5. `apps.exam_prep` -- `AddField language` on ExamExercise. Auto-backfill (stays FR).
6. `apps.memory` -- `AddField language` on MemoryNote + new composite index. Auto-backfill.
7. `apps.agents` -- `AddField system_prompt_en` (blank=True, default=""). No backfill needed; empty is the fail-safe.

Each migration is forward-only and reversible (Django generates the reverse op for pure `AddField`). Total schema-change time: ~1-2 minutes on prod data volumes. Standard deploy workflow handles it: `git pull && docker compose up -d --build && python manage.py migrate`.

### Content seeding order (Phase L2)

Run after migrations succeed. Four management commands:

1. `python manage.py seed_content_en` -- new. Creates 5 EN topics, 25 lessons, ~300 vocab. Idempotent.
2. `python manage.py seed_questions_en` -- new. Populates Question rows for each EN lesson (10-15 per lesson).
3. `python manage.py seed_agents_en` -- new. Backfills `system_prompt_en` on the 6 existing agents. Non-destructive (only fills empty fields).
4. `python manage.py seed_news_en` -- new. Generates ~10 EN news articles, one per topic. Requires `GEMINI_API_KEY` in the deploy env.

Failure of any seed step is non-fatal -- the migration is already committed, just means EN content is partial. Re-running is safe (all seeds are idempotent).

### API contract changes (breaking, intentional)

| Endpoint | v1.x | v2.0.0 |
|---|---|---|
| `GET /api/content/topics/` | All topics | Filtered by target_language |
| `GET /api/content/topics/{id}/` | Topic by ID | 404 if cross-language |
| `GET /api/news/` | All news | Filtered |
| `POST /api/users/register/` | No `target_language` field | Accepts it; required-with-default "fr" |
| `GET /api/users/me/` | `target_language` absent | Present |
| Everything else | unchanged | unchanged |

No external consumers exist today (only the React frontend, ships in same deploy). No deprecation period. Atomic upgrade.

### Feature flag

**None.** Unlike `LINGARU_MEMORY_ENABLED`, a single flag can't gate dozens of endpoint contract changes without becoming "code path A vs. code path B" -- two parallel codebases under one git ref. The right rollback strategy is the deploy workflow's existing **rollback-on-smoke-test-failure**: `/api/health/` 503 or smoke test fail triggers `git reset --hard $PREV_SHA && docker compose up -d --build`. Migrations are reversible. Standard Hetzner deploy behavior, already wired.

### Release sequence

1. **One PR** for the L1+L2 implementation. Branch: `feat/multi-language-v2`. All migrations, service-layer changes, frontend changes, EN content seed, tests. Big but unified. Open as draft early so reviewers (CodeRabbit, Sourcery, Gemini) can chew on it incrementally.
2. **Merge to main** once green + reviewers + manual smoke test. Auto-deploy fires.
3. **Tag `v2.0.0`** from main post-deploy: `gh release create v2.0.0 --notes-file <path> --latest`.
4. **Admin verification** -- you (and any other existing user) default to `target_language="fr"` per the migration. Flip yourself to EN via admin if you want to dogfood the EN side.

### Release notes (v2.0.0)

- **English support (preview)**. Lingaru now supports learning English alongside French. Users pick their target language at onboarding (existing users default to French; change in Settings -> Profile).
- **What works for English at v2.0.0**: 5 topics / 25 lessons / ~300 vocabulary, the Assistant (with English-targeted prompts), Memory layer (per-language scoping), Dictionary lookups, News, Mini-games (4 of 5; Gender Snap is French-only).
- **What's coming soon for English**: Grammar Booster (Phase L3), Exam Prep (Phase L4), Conjugation drills, Gender Snap alternative.
- **Breaking changes** (API contract): all content-listing endpoints now filter by the authenticated user's target_language. No backwards-compat shim.
- **Internal**: `language` field added to content tables; `target_language` field added to User; per-language LLM prompts; agents support a `system_prompt_en` fallback.

## Open questions

None at design time. All trade-offs were explicitly resolved during brainstorming:

- Discriminator field everywhere (Approach A) over a `Language` FK model or schema-per-language.
- Per-account language selection, no top-nav switcher.
- Migration defaults everyone to `"fr"`; admin override for explicit changes.
- Per-language progress (no cross-language XP/streak aggregation).
- Per-language memory notes.
- Phase L2 scope: 5 topics / 25 lessons / ~300 vocab (minimum viable, not lean, not generous).
- "Coming soon" badges for EN-unsupported features (option 3, not "hide entirely" or "page-level fallback").
- Per-language prompt dict in `services/llm/prompts.py` + per-agent EN `system_prompt_en` seed (option 1).
- Flag emoji next to logo: read-only badge, no click handler.
- One PR for v2.0.0 (architecture + content together).
- No feature flag for the rollout.

## Future work (explicitly deferred)

- **Phase L3** -- English grammar topics + drill items for Grammar Booster.
- **Phase L4** -- English exam prep (IELTS / TOEFL / Cambridge framework). Not a small addition; needs its own design.
- **Phase L5** -- richer EN news pipeline (more articles, more topics, better TTS).
- **Phase L6** -- mini-game adaptations for EN (phrasal-verb game, irregular-verb forms, article a/an/the practice, modal verbs).
- **Phase L7** -- additional languages (Spanish, Italian, Portuguese). Architecture supports them; content does not.
- **Cross-language progress aggregation** -- if/when users want a "lifetime XP across all languages" view, the Dashboard / Progress page could optionally show all-language totals. Not needed at v2.0.0.
- **Per-conversation language override** -- "use the EN assistant for this one chat even though my target_language is FR." Not needed at v2.0.0; complicates the mental model.
- **Promoting `system_prompt_en` to a JSON column** -- when a third language lands, this is the right time to refactor agents to a per-language JSON map.
