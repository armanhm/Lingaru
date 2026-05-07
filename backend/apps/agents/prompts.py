"""Shared prompt fragments for the agents app.

The structured-payloads instruction below gets appended to every agent's
``system_prompt`` so the LLM knows it can emit a fenced ```blocks segment
that the frontend will render as cards.

Single source of truth: imported by both the data migration and the
seed-agents management command, so a fresh DB and an existing one end up
with identical prompts. The marker string lets us update the wording
later without splitting any prompt that's been edited via admin.
"""

from __future__ import annotations

BLOCK_FENCE_INSTRUCTION_MARK = "<!-- structured-payloads:v1 -->"

BLOCK_FENCE_INSTRUCTION = f"""

{BLOCK_FENCE_INSTRUCTION_MARK}
## Optional: structured render blocks

When it would help the learner, append a fenced code segment to your
reply that the frontend can render as cards. The fence is *optional* —
if a plain prose answer is fine, omit it.

Format (literal):

```blocks
[
  {{ "type": "audio", "text": "<French phrase>", "lang": "fr" }},
  {{ "type": "vocab_card", "french": "...", "english": "...", "pos": "...", "example_fr": "..." }},
  {{ "type": "expression", "fr": "...", "en": "...", "note": "..." }},
  {{ "type": "conjugation_table", "verb": "...", "tense": "...",
     "rows": [{{"pronoun": "je", "form": "..."}}, ...] }},
  {{ "type": "quiz", "questions": [
       {{ "kind": "mcq", "prompt": "...", "options": ["a","b","c","d"],
          "correct": 0, "explanation": "..." }},
       {{ "kind": "multi", "prompt": "...", "options": [...],
          "correct": [0,2], "explanation": "..." }},
       {{ "kind": "true_false", "prompt": "...", "correct": true,
          "explanation": "..." }},
       {{ "kind": "matching", "prompt": "...",
          "pairs": [{{"left": "...", "right": "..."}}, ...] }},
       {{ "kind": "short", "prompt": "...",
          "accept": ["bonjour", "Bonjour"] }}
  ] }}
]
```

Rules:
- Emit the fence at the very end of your reply, after the prose.
- Use double-quoted JSON only. No comments, no trailing commas.
- Pick block types that fit the content. A conjugation question deserves
  a `conjugation_table`; a vocab explanation deserves `vocab_card`s; a
  short comprehension check deserves a small `quiz`.
- For `quiz` blocks, include 1-3 questions max. Mix `kind`s when natural.
- Skip the fence entirely if the reply is purely conversational.
"""


def ensure_block_instruction(system_prompt: str) -> str:
    """Append the structured-payloads instruction if it isn't already there.

    Idempotent — safe to call on a prompt that's already been processed.
    Used by both the data migration and the ``seed_agents`` command so a
    fresh DB and a long-running production DB end up with the same prompts.
    """
    text = system_prompt or ""
    if BLOCK_FENCE_INSTRUCTION_MARK in text:
        return text
    return text.rstrip() + BLOCK_FENCE_INSTRUCTION
