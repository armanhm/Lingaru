"""Shared parsing helpers for dictionary / conjugation LLM responses.

Extracted from `views.py` so management commands and any future caller
(workers, tasks, retry scripts) can use the exact same parser. Keeping
two copies in sync was a latent bug — see PR #46 review.
"""

import json
import re


def parse_json_response(text: str) -> dict | None:
    """Extract and parse JSON from an LLM response.

    Handles three common LLM output shapes:
    1. Plain JSON.
    2. JSON wrapped in a ```json … ``` markdown fence.
    3. JSON embedded inside surrounding prose (extracts the first {…}).

    Returns the parsed dict on success, None on any parse failure.
    """
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return None
