"""Frequency-rank → CEFR level mapping for the dictionary cache pre-warm.

Brackets approximate the CEFR vocab-size bands (A1 ≈ 500 lemmas, A2 ≈ 1000
cumulative, B1 ≈ 2000, B2 ≈ 4000). The Lonsdale corpus skews slightly easier
than strict CEFR averages because the most-frequent words are disproportionately
function words, so we use slightly wider A1/A2 ranges. See the design spec at
docs/superpowers/specs/2026-06-27-llm-cache-layer-design.md.
"""

VALID_LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")


def cefr_from_rank(rank: int) -> str:
    """Map a 1-indexed frequency rank to a CEFR level.

    >>> cefr_from_rank(1)
    'A1'
    >>> cefr_from_rank(500)
    'A1'
    >>> cefr_from_rank(501)
    'A2'
    >>> cefr_from_rank(3000)
    'C2'
    """
    if rank <= 500:
        return "A1"
    if rank <= 1000:
        return "A2"
    if rank <= 1700:
        return "B1"
    if rank <= 2400:
        return "B2"
    if rank <= 2800:
        return "C1"
    return "C2"
