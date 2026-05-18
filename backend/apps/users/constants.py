"""Shared language constants used across multiple apps.

Lives in its own module (not apps.users.models) so other apps can
import LANGUAGE_CHOICES without triggering a User-model import cycle
when their migrations run.
"""

LANGUAGE_CHOICES = [
    ("fr", "French"),
    ("en", "English"),
]
LANGUAGE_CODES = {code for code, _ in LANGUAGE_CHOICES}
