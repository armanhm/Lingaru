import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

BEFORE = [("gamification", "0001_initial")]
AFTER = [("gamification", "0002_xp_transaction_unique_source")]


def _migrate(targets):
    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate(targets)
    return executor.loader.project_state(targets).apps


@pytest.mark.django_db(transaction=True)
def test_unique_source_migration_tags_legacy_duplicates_and_reverses():
    old_apps = _migrate(BEFORE)
    XPTransaction = old_apps.get_model("gamification", "XPTransaction")
    user = get_user_model().objects.create_user(username="legacy", email="legacy@example.com")
    first = XPTransaction.objects.create(
        user_id=user.pk, activity_type="dictation", xp_amount=15, source_id="dictation_clip_1"
    )
    dup = XPTransaction.objects.create(
        user_id=user.pk, activity_type="dictation", xp_amount=15, source_id="dictation_clip_1"
    )
    other = XPTransaction.objects.create(
        user_id=user.pk, activity_type="quiz_perfect", xp_amount=25, source_id="dictation_clip_1"
    )
    no_source = [
        XPTransaction.objects.create(user_id=user.pk, activity_type="mini_game_x", xp_amount=2)
        for _ in range(2)
    ]

    try:
        new_apps = _migrate(AFTER)
        NewXP = new_apps.get_model("gamification", "XPTransaction")
        assert NewXP.objects.get(pk=first.pk).source_id == "dictation_clip_1"
        assert NewXP.objects.get(pk=dup.pk).source_id == f"dictation_clip_1#dup{dup.pk}"
        assert NewXP.objects.get(pk=other.pk).source_id == "dictation_clip_1"
        assert NewXP.objects.filter(pk__in=[t.pk for t in no_source], source_id=None).count() == 2
        # No XP is clawed back.
        assert NewXP.objects.filter(user_id=user.pk).count() == 5

        old_apps = _migrate(BEFORE)
        OldXP = old_apps.get_model("gamification", "XPTransaction")
        assert OldXP.objects.get(pk=dup.pk).source_id == "dictation_clip_1"
    finally:
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
