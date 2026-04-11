"""CEFR scoring and XP constants for exam prep."""

CEFR_THRESHOLDS = [
    (95, "C2"),
    (85, "C1"),
    (75, "B2"),
    (65, "B1"),
    (50, "A2"),
    (30, "A1"),
]

XP_EXAM_PRACTICE = 15
XP_EXAM_MOCK_COMPLETE = 30
XP_EXAM_PERFECT = 50


def score_to_cefr(percentage: float) -> str:
    """Map a percentage score to a CEFR level."""
    for threshold, level in CEFR_THRESHOLDS:
        if percentage >= threshold:
            return level
    return ""
