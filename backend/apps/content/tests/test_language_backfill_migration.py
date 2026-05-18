"""Verify the language=fr backfill on existing content rows.

We can't directly invoke a historical migration in pytest, but we CAN
assert the post-migration invariant: any row created via the model
defaults to language='fr'. This catches a future migration that drops
the default by mistake.
"""

import pytest

from apps.content.models import Lesson, Topic, Vocabulary


@pytest.mark.django_db
def test_pre_existing_content_rows_default_to_fr():
    """Simulates the post-migration state for legacy rows by relying on
    the field default (which is what the migration uses)."""
    t = Topic.objects.create(name_fr="Legacy", name_en="Legacy", order=1, difficulty_level=1)
    lesson = Lesson.objects.create(topic=t, title="L", order=1, type="vocab", difficulty=1)
    vocab = Vocabulary.objects.create(lesson=lesson, french="legacy", english="legacy")
    # All three created without specifying language.
    assert t.language == "fr"
    assert lesson.language == "fr"
    assert vocab.language == "fr"
