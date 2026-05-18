import pytest

from apps.exam_prep.models import ExamExercise


@pytest.mark.django_db
def test_exam_exercise_language_defaults_to_fr():
    ex = ExamExercise.objects.create(
        section="CO",
        cefr_level="B1",
        title="t",
        content={},
    )
    assert ex.language == "fr"
