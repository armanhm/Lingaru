"""Verify the target_language=fr backfill on User rows.

We can't directly invoke a historical migration in pytest, but we CAN
assert the post-migration invariant: any row created via the model
defaults to target_language='fr'. This catches a future migration that drops
the default by mistake.
"""

import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
def test_user_target_language_backfills_to_fr():
    user = User.objects.create_user(username="bku", email="bku@x.com", password="x")
    assert user.target_language == "fr"
