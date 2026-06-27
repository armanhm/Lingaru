"""Tests for the async EE/EO grading path.

Covers:
- POST /sessions/<id>/respond/ for an EE/EO section returns 202 + a
  pending response (no LLM call inside the request thread).
- The grade_response task processes a pending response and writes the
  grading payload back to the row.
- The polling endpoint reports pending → done correctly.
- A malformed LLM response is marked GRADING_FAILED after retries
  (we patch the task to skip retries and exercise the failure path).
"""

from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model

from apps.exam_prep.models import ExamExercise, ExamResponse, ExamSession
from apps.exam_prep.tasks import grade_response

User = get_user_model()


@pytest.fixture
def ee_setup(db):
    user = User.objects.create_user(
        username="ee", email="ee@x.com", password="p", target_language="fr"
    )
    exercise = ExamExercise.objects.create(
        section="EE",
        cefr_level="B2",
        title="EE essay prompt",
        content={"prompt_fr": "Écrivez 200 mots sur le climat.", "rubric": "B2 rubric"},
    )
    session = ExamSession.objects.create(user=user, section="EE", cefr_level="B2")
    return user, exercise, session


def _fake_llm_result(content: str) -> MagicMock:
    r = MagicMock()
    r.content = content
    r.provider = "gemini"
    return r


# ---- view: respond returns 202, no LLM call in request thread ---------------


@pytest.mark.django_db(transaction=True)
def test_ee_respond_returns_202_and_queues_task(ee_setup, api_client):
    """The view persists the response then uses transaction.on_commit to
    queue the Celery task. Without transaction=True the test's wrapping
    transaction never commits, so the on_commit callback wouldn't fire and
    apply_async wouldn't be called — which is what the test is asserting.
    """
    user, exercise, session = ee_setup
    api_client.force_authenticate(user=user)

    with (
        patch("apps.exam_prep.tasks.grade_response.apply_async") as mock_apply,
        patch("apps.exam_prep.tasks.create_llm_router") as mock_router,
    ):
        resp = api_client.post(
            f"/api/exam-prep/sessions/{session.id}/respond/",
            {
                "exercise_id": exercise.id,
                "question_index": 0,
                "answer": "Mon avis sur le climat est…",
            },
            format="json",
        )

    assert resp.status_code == 202, resp.data
    assert resp.data["grading_status"] == ExamResponse.GRADING_PENDING
    assert resp.data["poll_url"].endswith("/grading/")
    # The router must never be invoked synchronously.
    assert not mock_router.called, "task-level LLM router must not be invoked synchronously"
    # apply_async fires only after the per-request transaction commits,
    # which proves the on_commit guard works as intended.
    mock_apply.assert_called_once()

    response_row = ExamResponse.objects.get(id=resp.data["response_id"])
    assert response_row.grading_status == ExamResponse.GRADING_PENDING
    # Task id was pre-generated and persisted BEFORE the task was queued.
    assert response_row.grading_task_id, "grading_task_id must be set before the task is enqueued"
    # The worker is enqueued with the same task id (no drift row vs worker).
    assert mock_apply.call_args.kwargs["task_id"] == response_row.grading_task_id


# ---- task: grades a pending row and writes back -----------------------------


@pytest.mark.django_db
def test_grade_response_task_writes_back(ee_setup):
    user, exercise, session = ee_setup
    response = ExamResponse.objects.create(
        session=session,
        exercise=exercise,
        user_answer="Le climat change rapidement…",
        grading_status=ExamResponse.GRADING_PENDING,
        score=0,
        max_score=20,
    )

    grading_payload = {
        "score": 14,
        "max_score": 20,
        "feedback_en": "Solid structure, watch tense agreement.",
        "feedback_fr": "Structure correcte, attention aux temps.",
    }

    with patch("apps.exam_prep.tasks.create_llm_router") as mock_router:
        mock_router.return_value.generate.return_value = _fake_llm_result(
            f"```json\n{__import__('json').dumps(grading_payload)}\n```"
        )
        result = grade_response(response.id)

    assert result == grading_payload
    response.refresh_from_db()
    assert response.grading_status == ExamResponse.GRADING_DONE
    assert response.score == 14
    assert response.max_score == 20
    assert response.grading_completed_at is not None
    # ai_feedback round-trips
    import json as _json

    assert _json.loads(response.ai_feedback) == grading_payload


# ---- task is idempotent on retry --------------------------------------------


@pytest.mark.django_db
def test_grade_response_task_skips_already_done(ee_setup):
    user, exercise, session = ee_setup
    response = ExamResponse.objects.create(
        session=session,
        exercise=exercise,
        user_answer="x",
        grading_status=ExamResponse.GRADING_DONE,
        score=18,
        max_score=20,
        ai_feedback='{"score":18,"max_score":20}',
    )

    with patch("apps.exam_prep.tasks.create_llm_router") as mock_router:
        result = grade_response(response.id)

    # No LLM call: the task short-circuited on the GRADING_DONE row.
    assert not mock_router.called
    assert result == {"score": 18, "max_score": 20}


# ---- polling endpoint: pending → done ---------------------------------------


@pytest.mark.django_db
def test_polling_endpoint_reports_status_transitions(ee_setup, api_client):
    user, exercise, session = ee_setup
    api_client.force_authenticate(user=user)
    response = ExamResponse.objects.create(
        session=session,
        exercise=exercise,
        user_answer="…",
        grading_status=ExamResponse.GRADING_PENDING,
        score=0,
        max_score=20,
    )

    # Pending: poll returns pending, no grading dict yet.
    resp = api_client.get(f"/api/exam-prep/responses/{response.id}/grading/")
    assert resp.status_code == 200
    assert resp.data["status"] == "pending"
    assert "grading" not in resp.data

    # Simulate task completion.
    response.grading_status = ExamResponse.GRADING_DONE
    response.score = 16
    response.ai_feedback = '{"score":16,"max_score":20,"feedback_en":"Good."}'
    response.save()

    resp = api_client.get(f"/api/exam-prep/responses/{response.id}/grading/")
    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "done"
    assert resp.data["score"] == 16
    assert resp.data["grading"] == {
        "score": 16,
        "max_score": 20,
        "feedback_en": "Good.",
    }


@pytest.mark.django_db
def test_polling_endpoint_404s_for_other_users_responses(ee_setup, api_client):
    user, exercise, session = ee_setup
    response = ExamResponse.objects.create(
        session=session,
        exercise=exercise,
        user_answer="…",
        grading_status=ExamResponse.GRADING_PENDING,
    )
    other = User.objects.create_user(
        username="o", email="o@x.com", password="p", target_language="fr"
    )
    api_client.force_authenticate(user=other)

    resp = api_client.get(f"/api/exam-prep/responses/{response.id}/grading/")
    assert resp.status_code == 404


# ---- failure path: parse error → GRADING_FAILED -----------------------------


@pytest.mark.django_db
def test_grade_response_marks_failed_after_unparseable_output(ee_setup):
    """When the LLM emits junk that the parser can't recover, after the
    autoretry budget is exhausted the task writes GRADING_FAILED so the
    poller doesn't sit on pending forever."""
    user, exercise, session = ee_setup
    response = ExamResponse.objects.create(
        session=session,
        exercise=exercise,
        user_answer="…",
        grading_status=ExamResponse.GRADING_PENDING,
    )

    # Patch the task's self.request.retries to look like the final retry.
    # We call the task as a plain function with a fake "self" via .run() —
    # but bind=True requires a real Task. Easiest: monkeypatch max_retries
    # to 0 so the first call IS the final attempt.
    with (
        patch("apps.exam_prep.tasks.create_llm_router") as mock_router,
        patch.object(grade_response, "max_retries", 0),
    ):
        mock_router.return_value.generate.return_value = _fake_llm_result("this is not json at all")
        result = grade_response(response.id)

    assert result["error"] == "grading_failed"
    response.refresh_from_db()
    assert response.grading_status == ExamResponse.GRADING_FAILED
    assert response.grading_completed_at is not None


@pytest.mark.django_db
def test_grade_response_marks_failed_when_router_raises(ee_setup):
    """The previous version of the task let exceptions from router.generate
    (network error, timeout, rate limit) propagate out, leaving the row
    stuck in GRADING_PENDING. This test pins the behaviour: on the final
    retry the unified try/except writes GRADING_FAILED instead."""
    user, exercise, session = ee_setup
    response = ExamResponse.objects.create(
        session=session,
        exercise=exercise,
        user_answer="…",
        grading_status=ExamResponse.GRADING_PENDING,
    )

    with (
        patch("apps.exam_prep.tasks.create_llm_router") as mock_router,
        patch.object(grade_response, "max_retries", 0),
    ):
        mock_router.return_value.generate.side_effect = TimeoutError("LLM took too long")
        result = grade_response(response.id)

    assert result["error"] == "grading_failed"
    assert "LLM took too long" in result["detail"]
    response.refresh_from_db()
    assert response.grading_status == ExamResponse.GRADING_FAILED
    assert response.grading_completed_at is not None
