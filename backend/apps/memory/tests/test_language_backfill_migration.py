"""Verify the language=fr backfill on MemoryNote rows.

We can't directly invoke a historical migration in pytest, but we CAN
assert the post-migration invariant: any row created via the model
defaults to language='fr'. This catches a future migration that drops
the default by mistake.
"""

import pytest
from django.contrib.auth import get_user_model

from apps.memory.models import MemoryNote

User = get_user_model()


@pytest.mark.django_db
def test_memory_note_backfills_to_fr():
    user = User.objects.create_user(username="bk", email="bk@x.com", password="x")
    note = MemoryNote.objects.create(user=user, content="legacy")
    assert note.language == "fr"
