from django.db import migrations, models


def dedupe_responses(apps, schema_editor):
    """Keep only the latest answer per (session, exercise, question_index).

    Required so the unique constraint can be created on existing data.
    Deleted rows are not restored on reverse.
    """
    ExamResponse = apps.get_model("exam_prep", "ExamResponse")
    seen = set()
    stale = []
    rows = ExamResponse.objects.order_by("-answered_at", "-id").values_list(
        "id", "session_id", "exercise_id", "question_index"
    )
    for pk, session_id, exercise_id, question_index in rows:
        key = (session_id, exercise_id, question_index)
        if key in seen:
            stale.append(pk)
        else:
            seen.add(key)
    if stale:
        ExamResponse.objects.filter(id__in=stale).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("exam_prep", "0003_add_grading_status_to_response"),
    ]

    operations = [
        migrations.RunPython(dedupe_responses, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="examresponse",
            constraint=models.UniqueConstraint(
                fields=("session", "exercise", "question_index"),
                name="unique_exam_response_per_question",
            ),
        ),
    ]
