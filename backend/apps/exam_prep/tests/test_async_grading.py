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


@pytest.mark.django_db
def test_ee_respond_returns_202_and_queues_task(ee_setup, api_client):
    user, exercise, session = ee_setup
    api_client.force_authenticate(user=user)

    # Patch the router AT the task module (the only place that imports it
    # for grading). If the view ever reintroduces a synchronous router
    # call, this patch wouldn't intercept it — and mock_delay being called
    # is what proves the work was offloaded.
    with (
        patch("apps.exam_prep.tasks.grade_response.delay") as mock_delay,
        patch("apps.exam_prep.tasks.create_llm_router") as mock_router,
    ):
        mock_async_result = MagicMock()
        mock_async_result.id = "task-abc-123"
        mock_delay.return_value = mock_async_result

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
    # We mocked .delay so the real task never ran; mock_router should not
    # have been called either. Together these prove no LLM round-trip.
    assert not mock_router.called, "task-level LLM router must not be invoked synchronously"
    mock_delay.assert_called_once()

    response_row = ExamResponse.objects.get(id=resp.data["response_id"])
    assert response_row.grading_status == ExamResponse.GRADING_PENDING
    assert response_row.grading_task_id == "task-abc-123"


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

    assert result == {"error": "parse_failed"}
    response.refresh_from_db()
    assert response.grading_status == ExamResponse.GRADING_FAILED
    assert response.grading_completed_at is not None
