from django.db import migrations


def drop_legacy_icon_topics(apps, schema_editor):
    """Remove FR topics from the original 2025 seed that stored icons as
    icon-pack names ("hand-wave", "utensils") instead of emoji. They were
    duplicated by the hand-authored A1 set in data/topics_fr_a1.json, so
    deleting them removes user-facing visual breakage without losing
    content.
    """
    Topic = apps.get_model("content", "Topic")
    Topic.objects.filter(language="fr", icon__in=["hand-wave", "utensils"]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0003_grammarrule_language_lesson_language_and_more"),
    ]

    operations = [
        migrations.RunPython(drop_legacy_icon_topics, migrations.RunPython.noop),
    ]
