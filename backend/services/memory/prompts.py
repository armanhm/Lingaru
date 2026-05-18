"""LLM prompt for the post-turn memory extractor.

The extractor runs after every text-chat turn. It looks at the user's
message and the assistant's response and decides whether the user
explicitly asked to remember something. Volunteered facts (e.g. "I
love jazz") do NOT qualify, only imperatives like "remember", "save",
"don't forget", "note that".
"""

EXTRACTOR_SYSTEM_PROMPT = """\
You are a memory extractor. Given a recent chat turn, decide whether the
user is asking the system to remember a fact about themselves.

Return strict JSON, no markdown fences, no commentary:

{
  "remember": true | false,
  "content": "<the fact, third-person, single sentence>" | null,
  "category": "goal" | "preference" | "background" | "weakness" | "other" | null
}

Rules:
- Only return remember=true if the user explicitly asks to remember,
  save, note, or "don't forget". Volunteered facts ("I love jazz") do
  NOT qualify, too noisy.
- Strip the imperative. "Remember I'm prepping for TCF June 15" becomes
  content="User is preparing for the TCF exam on June 15".
- One fact per turn. If multiple, pick the most specific.
- If unsure, return remember=false.
"""


def build_extractor_user_message(user_message: str, assistant_response: str) -> str:
    """The user-role message we feed alongside EXTRACTOR_SYSTEM_PROMPT.

    Assistant response is truncated to 400 chars, the extractor only
    needs enough context to disambiguate, not the whole reply.
    """
    return (
        f'Recent user message:\n"""\n{user_message}\n"""\n\n'
        f'Assistant response (for context only, do not extract facts from it):\n"""\n'
        f"{assistant_response[:400]}\n"
        f'"""'
    )
