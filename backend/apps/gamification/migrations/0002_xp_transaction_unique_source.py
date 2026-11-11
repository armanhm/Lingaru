from django.conf import settings
from django.db import migrations, models
from django.db.models import Count, Min

SOURCE_ID_MAX_LENGTH = 100


def _dup_suffix(pk):
    return f"#dup{pk}"


def tag_legacy_duplicates(apps, schema_editor):
    """Make pre-existing duplicate awards unique so the constraint can be added.

    Before this migration award_xp never de-duplicated, so a user can hold
    several rows with the same (activity_type, source_id). The earliest row keeps
    its key; later ones get a "#dup<pk>" suffix. XP already granted is left
    untouched, so total_xp and the history view do not change.
    """
    XPTransaction = apps.get_model("gamification", "XPTransaction")
    groups = (
        XPTransaction.objects.filter(source_id__isnull=False)
        .values("user_id", "activity_type", "source_id")
        .annotate(n=Count("id"), first_id=Min("id"))
        .filter(n__gt=1)
    )
    for group in groups:
        duplicates = XPTransaction.objects.filter(
            user_id=group["user_id"],
            activity_type=group["activity_type"],
            source_id=group["source_id"],
        ).exclude(pk=group["first_id"])
        for txn in duplicates:
            suffix = _dup_suffix(txn.pk)
            txn.source_id = txn.source_id[: SOURCE_ID_MAX_LENGTH - len(suffix)] + suffix
            txn.save(update_fields=["source_id"])


def untag_legacy_duplicates(apps, schema_editor):
    XPTransaction = apps.get_model("gamification", "XPTransaction")
    for txn in XPTransaction.objects.filter(source_id__contains="#dup"):
        suffix = _dup_suffix(txn.pk)
        if txn.source_id.endswith(suffix):
            txn.source_id = txn.source_id[: -len(suffix)]
            txn.save(update_fields=["source_id"])


class Migration(migrations.Migration):
    dependencies = [
        ("gamification", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(tag_legacy_duplicates, untag_legacy_duplicates),
        migrations.AddConstraint(
            model_name="xptransaction",
            constraint=models.UniqueConstraint(
                condition=models.Q(("source_id__isnull", False)),
                fields=("user", "activity_type", "source_id"),
                name="unique_xp_award_per_source",
            ),
        ),
    ]
