import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.exam_prep.models import ExamExercise

User = get_user_model()


@pytest.mark.django_db
def test_exam_exercises_filtered_by_language_en_user_gets_empty():
    en_user = User.objects.create_user(
        username="e", email="e@x.com", password="x", target_language="en"
    )
    ExamExercise.objects.create(
        section="CO",
        cefr_level="B1",
        title="FR Exercise",
        content={},
        language="fr",
    )

    client = APIClient()
    client.force_authenticate(en_user)
    response = client.get("/api/exam-prep/exercises/")
    assert response.status_code == 200
    body = response.json()
    # Bare list expected (no pagination in ExerciseListView)
    if isinstance(body, dict):
        items = body.get("results", body.get("exercises", []))
    else:
        items = body
    assert items == [] or items == {}


@pytest.mark.django_db
def test_exam_exercises_filtered_by_language_fr_user_sees_fr():
    fr_user = User.objects.create_user(
        username="e2", email="e2@x.com", password="x", target_language="fr"
    )
    ExamExercise.objects.create(
        section="CO",
        cefr_level="B1",
        title="FR Exercise",
        content={},
        language="fr",
    )
    ExamExercise.objects.create(
        section="CO",
        cefr_level="B1",
        title="EN Exercise",
        content={},
        language="en",
    )

    client = APIClient()
    client.force_authenticate(fr_user)
    response = client.get("/api/exam-prep/exercises/")
    assert response.status_code == 200
    body = response.json()
    if isinstance(body, list):
        titles = [ex["title"] for ex in body]
    elif isinstance(body, dict):
        items = body.get("results", body.get("exercises", []))
        titles = [ex["title"] for ex in items] if isinstance(items, list) else []
    else:
        titles = []
    assert "FR Exercise" in titles
    assert "EN Exercise" not in titles
