"""Structured render-block parser for assistant replies.

The assistant's plain-text reply can be enriched with a typed payload the
frontend renders as cards (audio, vocab, conjugation table, inline quiz,
expression). The LLM is asked, via the agent's system prompt, to append
a fenced ``` ```blocks <json> ``` ``` segment after the prose. We extract
the JSON, drop entries that don't pass per-type validation, and return
the surviving blocks plus the prose with the fence stripped.

This module is the *single source of truth* for the block schema; the
frontend's renderer registry (`MessageBlocks`) mirrors it. Adding a new
block type means: (1) extend `BLOCK_VALIDATORS` here, (2) add a
React renderer, (3) update one or more agent prompts to actually emit it.

Design notes
- Forward-compatible: an unknown `type` is dropped silently so older
  clients can ignore types they don't understand yet.
- Defensive: malformed JSON, missing fields, or wrong-shaped values
  cause that single block (or the whole batch) to be skipped, never
  crash the reply or leak a stack trace into the chat.
- Idempotent: if the model omits blocks (e.g. for a free-form chat
  agent), this returns ([], original_text) unchanged.
"""

from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

# Primary fence, what we ask the agent to emit. Tolerant of whitespace
# and an optional `json` qualifier after `blocks`.
_FENCE_RE = re.compile(
    r"```\s*blocks(?:\s+json)?\s*\n(?P<json>.*?)\n?```",
    re.DOTALL | re.IGNORECASE,
)

# Fallback fence, `json`/`JSON`/no language. Models sometimes default to
# ```json regardless of the system prompt. We only treat this as a blocks
# payload if the JSON inside *also* looks like our schema (a list of
# objects with a known `type`), so unrelated JSON code samples in chat
# replies don't accidentally get eaten.
_FALLBACK_FENCE_RE = re.compile(
    r"```\s*(?:json|jsonc)?\s*\n(?P<json>[\[\{].*?)\n?```",
    re.DOTALL | re.IGNORECASE,
)

# Last-ditch fallback for models that ignore both fence forms and just dump
# a JSON array at the end of the reply. Anchored to end-of-string (with
# optional trailing whitespace) so we only eat *trailing* arrays, not ones
# used illustratively mid-reply. We further validate the parsed payload
# against the block schema before stripping it from the prose.
_BARE_TRAILING_ARRAY_RE = re.compile(
    r"(?P<json>\[[^\[\]]*(?:\{.*?\}[^\[\]]*)+\])\s*\Z",
    re.DOTALL,
)


VALID_QUIZ_KINDS = {"mcq", "multi", "true_false", "matching", "short"}


def _is_str(x) -> bool:
    return isinstance(x, str) and x.strip() != ""


def _is_list_of_str(x) -> bool:
    return isinstance(x, list) and all(_is_str(s) for s in x)


def _validate_audio(b: dict) -> dict | None:
    text = b.get("text")
    lang = b.get("lang", "fr")
    if not _is_str(text):
        return None
    return {"type": "audio", "text": text.strip()[:400], "lang": lang or "fr"}


def _validate_vocab_card(b: dict) -> dict | None:
    fr, en = b.get("french"), b.get("english")
    if not (_is_str(fr) and _is_str(en)):
        return None
    out = {"type": "vocab_card", "french": fr.strip(), "english": en.strip()}
    if _is_str(b.get("pos")):
        out["pos"] = b["pos"].strip()[:24]
    if _is_str(b.get("example_fr")):
        out["example_fr"] = b["example_fr"].strip()[:240]
    return out


def _validate_expression(b: dict) -> dict | None:
    fr, en = b.get("fr"), b.get("en")
    if not (_is_str(fr) and _is_str(en)):
        return None
    out = {"type": "expression", "fr": fr.strip(), "en": en.strip()}
    if _is_str(b.get("note")):
        out["note"] = b["note"].strip()[:240]
    return out


def _validate_conjugation_table(b: dict) -> dict | None:
    verb = b.get("verb")
    tense = b.get("tense")
    rows = b.get("rows")
    if not (_is_str(verb) and _is_str(tense) and isinstance(rows, list) and rows):
        return None
    cleaned_rows = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        pronoun, form = r.get("pronoun"), r.get("form")
        if _is_str(pronoun) and _is_str(form):
            cleaned_rows.append({"pronoun": pronoun.strip()[:24], "form": form.strip()[:64]})
    if not cleaned_rows:
        return None
    return {
        "type": "conjugation_table",
        "verb": verb.strip()[:48],
        "tense": tense.strip()[:48],
        "rows": cleaned_rows[:12],
    }


def _validate_quiz_question(q: dict) -> dict | None:
    kind = q.get("kind")
    prompt = q.get("prompt")
    if kind not in VALID_QUIZ_KINDS or not _is_str(prompt):
        return None
    out = {"kind": kind, "prompt": prompt.strip()[:400]}
    if _is_str(q.get("explanation")):
        out["explanation"] = q["explanation"].strip()[:400]

    # Loose alias: LLMs often say `answer` where our schema says `correct`.
    # Accept either; explicit `correct` always wins so a future model that
    # picks up the canonical name doesn't get downgraded.
    raw_correct = q.get("correct") if "correct" in q else q.get("answer")

    if kind == "mcq":
        opts = q.get("options")
        if not (_is_list_of_str(opts) and 2 <= len(opts) <= 6):
            return None
        # `answer` may be either an int index or the option string itself
        # (e.g. "Mangions" instead of 0). Resolve strings to indices.
        if isinstance(raw_correct, str):
            stripped_opts = [s.strip() for s in opts]
            try:
                correct = stripped_opts.index(raw_correct.strip())
            except ValueError:
                return None
        elif isinstance(raw_correct, int) and not isinstance(raw_correct, bool):
            correct = raw_correct
        else:
            return None
        if not (0 <= correct < len(opts)):
            return None
        out["options"] = [s.strip() for s in opts]
        out["correct"] = correct

    elif kind == "multi":
        opts = q.get("options")
        if not (_is_list_of_str(opts) and 2 <= len(opts) <= 6):
            return None
        # `answer` may be a list of strings; resolve each to an index.
        if (
            isinstance(raw_correct, list)
            and raw_correct
            and all(isinstance(x, str) for x in raw_correct)
        ):
            stripped_opts = [s.strip() for s in opts]
            try:
                correct = [stripped_opts.index(s.strip()) for s in raw_correct]
            except ValueError:
                return None
        elif (
            isinstance(raw_correct, list)
            and all(
                isinstance(i, int) and not isinstance(i, bool) and 0 <= i < len(opts)
                for i in raw_correct
            )
            and raw_correct
        ):
            correct = raw_correct
        else:
            return None
        out["options"] = [s.strip() for s in opts]
        out["correct"] = sorted(set(correct))

    elif kind == "true_false":
        if not isinstance(raw_correct, bool):
            return None
        out["correct"] = raw_correct

    elif kind == "matching":
        pairs = q.get("pairs")
        if not (isinstance(pairs, list) and 2 <= len(pairs) <= 8):
            return None
        cleaned = []
        for p in pairs:
            if not isinstance(p, dict):
                continue
            left, right = p.get("left"), p.get("right")
            if _is_str(left) and _is_str(right):
                cleaned.append({"left": left.strip()[:80], "right": right.strip()[:80]})
        if len(cleaned) < 2:
            return None
        out["pairs"] = cleaned

    elif kind == "short":
        accept = q.get("accept")
        if not (_is_list_of_str(accept) and accept):
            return None
        out["accept"] = [s.strip() for s in accept[:8]]

    return out


# Whitelist of routes the agent is allowed to deep-link to. The model
# loves to hallucinate French translations of route names ("/grammaire"
# instead of "/grammar") so we lock it down to real ones; anything else
# is dropped silently. Keep this in sync with the React Router config.
ALLOWED_ACTION_ROUTES = {
    "/dashboard",
    "/topics",
    "/discover",
    "/news",
    "/practice/dictation",
    "/practice/pronunciation",
    "/practice/conjugation",
    "/practice/srs",
    "/mini-games",
    "/grammar",
    "/exam-prep",
    "/assistant",
    "/agents",
    "/dictionary",
    "/progress",
    "/settings",
    "/documents",
}


def _validate_action(b: dict) -> dict | None:
    """Inline call-to-action button. Renders as a chip the user can tap to
    navigate (in-app only, `route` must be in ``ALLOWED_ACTION_ROUTES``).

    The agent uses this when the right answer to a request is "go to that
    feature": "show me news" → `{type: "action", route: "/news",
    label: "Ouvrir les news"}`. Distinct from `feature_widget` (which
    embeds the feature inline rather than navigating to it).
    """
    route = b.get("route")
    label = b.get("label")
    if not (_is_str(route) and _is_str(label)):
        return None
    route_clean = route.strip()
    # Internal routes only AND must be a known real route. Stops the model
    # from sending users to /grammaire (404) when they meant /grammar.
    if not route_clean.startswith("/"):
        return None
    if route_clean not in ALLOWED_ACTION_ROUTES:
        return None
    out = {
        "type": "action",
        "route": route_clean[:160],
        "label": label.strip()[:48],
    }
    if _is_str(b.get("emoji")):
        out["emoji"] = b["emoji"].strip()[:8]
    return out


# Whitelist of widget types the chat can embed inline. Adding a new widget
# means: a renderer in <MessageBlocks>, the matching backend slug here, AND
# a tested embeddable component on the frontend. We're conservative, only
# widgets that make sense in a small chat surface and don't need their own
# layout (no full-page embeds).
ALLOWED_FEATURE_WIDGETS = {
    # Bespoke (news has its own shape, minigame is a generic preview)
    "news",
    "minigame",
    # Inline practice widgets (1 round, mutate-in-place inside the chat)
    "dictation",
    "flashcard",
    "conjugation",
    "word_scramble",
    "gender_snap",
    "missing_letter",
    "speed_round",
    "match_pairs",
    "listening_challenge",
    "grammar_topic",
}


def _validate_feature_widget(b: dict) -> dict | None:
    """Embed an entire feature as a card inside the chat.

    The agent emits `{type: "feature_widget", widget: "news", config: {...}}`
    when it wants the user to act on a feature WITHOUT leaving the chat ,
    e.g. "play me a dictation" should produce the dictation card right in
    the conversation. `config` is widget-specific and passed through to
    the renderer; we only validate the wrapper here.
    """
    widget = b.get("widget")
    if widget not in ALLOWED_FEATURE_WIDGETS:
        return None
    config = b.get("config", {})
    if not isinstance(config, dict):
        config = {}
    out = {"type": "feature_widget", "widget": widget, "config": config}
    if _is_str(b.get("title")):
        out["title"] = b["title"].strip()[:80]
    return out


def _validate_quiz(b: dict) -> dict | None:
    questions = b.get("questions")
    if not (isinstance(questions, list) and questions):
        return None
    cleaned = [
        q for q in (_validate_quiz_question(q) for q in questions if isinstance(q, dict)) if q
    ]
    if not cleaned:
        return None
    return {"type": "quiz", "questions": cleaned[:10]}


BLOCK_VALIDATORS = {
    "audio": _validate_audio,
    "vocab_card": _validate_vocab_card,
    "expression": _validate_expression,
    "conjugation_table": _validate_conjugation_table,
    "quiz": _validate_quiz,
    # Phase 3: agentic-mode invocation.
    "action": _validate_action,
    "feature_widget": _validate_feature_widget,
}


def _candidates_from_payload(data) -> list | None:
    """Coerce a parsed JSON value into a list of block-candidate dicts.

    Accepts:
      - {"blocks": [...]}            -- explicit wrapper key
      - [...]                        -- bare array of blocks
      - {"type": "...", ...}         -- single block object; models often
                                        emit one block this way instead
                                        of as a one-element list

    Returns None when the shape is something else (e.g. an unrelated
    JSON object the model decided to fence)."""
    if isinstance(data, dict) and isinstance(data.get("blocks"), list):
        return data["blocks"]
    if isinstance(data, list):
        return data
    # Single bare block object: wrap it. Recognise by the presence of a
    # known `type` so unrelated JSON dicts don't get adopted.
    if isinstance(data, dict) and data.get("type") in BLOCK_VALIDATORS:
        return [data]
    return None


def _salvage_objects(payload: str) -> list[dict]:
    """When the overall JSON array is invalid, try to recover individual
    top-level objects.

    Models occasionally emit one bad object inside an otherwise-fine
    array (a missing key, a stray apostrophe). Strict ``json.loads``
    rejects the whole batch; this walker scans for balanced ``{...}``
    spans at depth 1 and parses each one independently. Bad objects
    are dropped silently, we'd rather show 7 valid conjugation tables
    and skip the broken subjonctif than render nothing.

    Only called as a fallback after a full ``json.loads`` failure.
    """
    out: list[dict] = []
    depth = 0
    start = -1
    in_string = False
    escape = False

    for i, ch in enumerate(payload):
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
            continue

        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            if depth == 0:
                continue
            depth -= 1
            if depth == 0 and start != -1:
                snippet = payload[start : i + 1]
                start = -1
                try:
                    obj = json.loads(snippet)
                    if isinstance(obj, dict):
                        out.append(obj)
                except json.JSONDecodeError:
                    # Skip this one, keep walking.
                    continue
    return out


def _validate_candidates(candidates: list) -> list[dict]:
    cleaned = []
    for entry in candidates:
        if not isinstance(entry, dict):
            continue
        validator = BLOCK_VALIDATORS.get(entry.get("type"))
        if validator is None:
            continue
        result = validator(entry)
        if result is not None:
            cleaned.append(result)
    return cleaned[:8]


def extract_blocks(raw_text: str) -> tuple[str, list[dict]]:
    """Pull the trailing ``` ```blocks <json> ``` fence off the reply.

    Tries two strategies:

      1. Explicit ``` ```blocks ``` fence, what we ask agents to emit.
      2. Generic ``` ```json ``` fence, fallback for models that ignore
         the structured-output instruction and default to ```json. We
         only adopt the fallback if the parsed JSON actually validates
         as our block schema, so unrelated JSON snippets in chat replies
         (e.g. a code example in a conversational answer) stay visible.

    Returns ``(prose_without_fence, validated_blocks)``. If neither
    strategy yields any valid blocks, returns the original text and [].
    """
    if not raw_text:
        return "", []

    # ── Strategy 1: explicit ```blocks fence ────────────────────
    match = _FENCE_RE.search(raw_text)
    if match:
        payload = match.group("json").strip()
        prose = (raw_text[: match.start()] + raw_text[match.end() :]).strip()
        try:
            data = json.loads(payload)
        except json.JSONDecodeError as exc:
            # Strict parse failed, try to salvage individual objects so
            # one malformed entry doesn't kill the whole reply.
            salvaged = _salvage_objects(payload)
            if salvaged:
                logger.info(
                    "blocks fence: strict parse failed (%s); salvaged %d objects",
                    exc,
                    len(salvaged),
                )
                return prose, _validate_candidates(salvaged)
            logger.warning("blocks fence had invalid JSON: %s", exc)
            return raw_text, []

        candidates = _candidates_from_payload(data)
        if candidates is None:
            return raw_text, []
        return prose, _validate_candidates(candidates)

    # ── Strategy 2: generic ```json fallback ────────────────────
    # Walk every fenced JSON-ish block in order; accept the first one
    # that validates. This way a code-tutorial reply containing several
    # JSON snippets only loses the one that's actually our schema.
    for fb in _FALLBACK_FENCE_RE.finditer(raw_text):
        payload = fb.group("json").strip()

        cleaned = []
        try:
            data = json.loads(payload)
            candidates = _candidates_from_payload(data)
            if candidates is not None:
                cleaned = _validate_candidates(candidates)
        except json.JSONDecodeError:
            # Try the per-object salvage even when strict parse fails.
            salvaged = _salvage_objects(payload)
            cleaned = _validate_candidates(salvaged) if salvaged else []

        if not cleaned:
            continue
        prose = (raw_text[: fb.start()] + raw_text[fb.end() :]).strip()
        return prose, cleaned

    # ── Strategy 3: bare trailing array ─────────────────────────
    # Some models (notably gemini-flash and groq's 70b) put the JSON
    # blocks inline in the prose with NO fence at all, just a bare
    # `[{...}]` at the end of the reply. We salvage only when the array
    # is the trailing token AND it parses to objects with a known block
    # `type`. Anchored to end-of-string so a JSON array used illustratively
    # mid-reply doesn't get eaten.
    bare = _BARE_TRAILING_ARRAY_RE.search(raw_text)
    if bare:
        payload = bare.group("json").strip()
        cleaned = []
        try:
            data = json.loads(payload)
            candidates = _candidates_from_payload(data)
            if candidates is not None:
                cleaned = _validate_candidates(candidates)
        except json.JSONDecodeError:
            salvaged = _salvage_objects(payload)
            cleaned = _validate_candidates(salvaged) if salvaged else []

        if cleaned:
            prose = raw_text[: bare.start()].strip()
            return prose, cleaned

    return raw_text, []
