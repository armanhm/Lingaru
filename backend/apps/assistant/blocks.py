"""Structured render-block parser for assistant replies.

The assistant's plain-text reply can be enriched with a typed payload the
frontend renders as cards (audio, vocab, conjugation table, inline quiz,
expression). The LLM is asked — via the agent's system prompt — to append
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
  cause that single block (or the whole batch) to be skipped — never
  crash the reply or leak a stack trace into the chat.
- Idempotent: if the model omits blocks (e.g. for a free-form chat
  agent), this returns ([], original_text) unchanged.
"""

from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

# Match either ```blocks {...}``` or ```blocks [...]```; captures the JSON.
# Tolerant of whitespace and an optional `json` after `blocks`.
_FENCE_RE = re.compile(
    r"```\s*blocks(?:\s+json)?\s*\n(?P<json>.*?)\n?```",
    re.DOTALL | re.IGNORECASE,
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

    if kind == "mcq":
        opts = q.get("options")
        correct = q.get("correct")
        if not (_is_list_of_str(opts) and 2 <= len(opts) <= 6):
            return None
        if not (isinstance(correct, int) and 0 <= correct < len(opts)):
            return None
        out["options"] = [s.strip() for s in opts]
        out["correct"] = correct

    elif kind == "multi":
        opts = q.get("options")
        correct = q.get("correct")
        if not (_is_list_of_str(opts) and 2 <= len(opts) <= 6):
            return None
        if not (
            isinstance(correct, list)
            and all(isinstance(i, int) and 0 <= i < len(opts) for i in correct)
            and correct
        ):
            return None
        out["options"] = [s.strip() for s in opts]
        out["correct"] = sorted(set(correct))

    elif kind == "true_false":
        correct = q.get("correct")
        if not isinstance(correct, bool):
            return None
        out["correct"] = correct

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
}


def extract_blocks(raw_text: str) -> tuple[str, list[dict]]:
    """Pull the trailing ``` ```blocks <json> ``` fence off the reply.

    Returns ``(prose_without_fence, validated_blocks)``. If the fence is
    absent or malformed, returns the original text and an empty list.
    """
    if not raw_text:
        return "", []

    match = _FENCE_RE.search(raw_text)
    if not match:
        return raw_text, []

    payload = match.group("json").strip()
    prose = (raw_text[: match.start()] + raw_text[match.end() :]).strip()

    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        logger.warning("blocks fence had invalid JSON: %s", exc)
        return raw_text, []  # leave the original text alone — visible debug

    # The fence may contain either {"blocks": [...]} or just [...]
    if isinstance(data, dict) and isinstance(data.get("blocks"), list):
        candidates = data["blocks"]
    elif isinstance(data, list):
        candidates = data
    else:
        return raw_text, []

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

    return prose, cleaned[:8]  # cap to keep replies bounded
