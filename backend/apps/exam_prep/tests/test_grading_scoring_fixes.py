"""Regression tests for #66 (EE/EO grading prompt + score validation) and
#68 (exam session scoring)."""

from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model

from apps.exam_prep.models import ExamExercise, ExamProgress, ExamResponse, ExamSession
from apps.exam_prep.tasks import grade_response
from services.llm.prompts import get_system_prompt

User = get_user_model()


def _llm(content):
    r = MagicMock()
    r.content = content
    r.provider = "gemini"
    return r


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="u", email="u@x.com", password="p", target_language="fr"
    )


def _ee_response(user, language="fr"):
    ex = ExamExercise.objects.create(
        section="EE", cefr_level="B2", title="t", language=language, content={"prompt_fr": "p"}
    )
    s = ExamSession.objects.create(user=user, section="EE", cefr_level="B2", max_score=20)
    return ExamResponse.objects.create(
        session=s,
        exercise=ex,
        user_answer="x",
        grading_status=ExamResponse.GRADING_PENDING,
        max_score=20,
    )


# ---- #66 --------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("language", ["fr", "en"])
def test_grade_response_uses_language_correct_nonempty_json_prompt(user, language):
    resp = _ee_response(user, language)
    with patch("apps.exam_prep.tasks.create_llm_router") as router:
        router.return_value.generate.return_value = _llm('{"score": 10, "max_score": 20}')
        grade_response(resp.id)
    prompt = router.return_value.generate.call_args.kwargs["system_prompt"]
    assert prompt
    assert "JSON" in prompt
    assert prompt == get_system_prompt(language, "exam_ee_grading")


@pytest.mark.django_db
def test_grade_response_eo_uses_eo_prompt(user):
    resp = _ee_response(user)
    resp.session.section = "EO"
    resp.session.save()
    with patch("apps.exam_prep.tasks.create_llm_router") as router:
        router.return_value.generate.return_value = _llm('{"score": 10}')
        grade_response(resp.id)
    prompt = router.return_value.generate.call_args.kwargs["system_prompt"]
    assert prompt == get_system_prompt("fr", "exam_eo_grading")


@pytest.mark.django_db
def test_out_of_range_score_is_clamped(user):
    resp = _ee_response(user)
    with patch("apps.exam_prep.tasks.create_llm_router") as router:
        router.return_value.generate.return_value = _llm('{"score": 99, "max_score": 20}')
        grade_response(resp.id)
    resp.refresh_from_db()
    assert resp.grading_status == ExamResponse.GRADING_DONE
    assert resp.score == 20
    assert resp.max_score == 20


@pytest.mark.django_db
def test_negative_and_string_numeric_scores(user):
    resp = _ee_response(user)
    with patch("apps.exam_prep.tasks.create_llm_router") as router:
        router.return_value.generate.return_value = _llm('{"score": "15"}')
        grade_response(resp.id)
    resp.refresh_from_db()
    assert resp.score == 15

    resp2 = _ee_response(user)
    with patch("apps.exam_prep.tasks.create_llm_router") as router:
        router.return_value.generate.return_value = _llm('{"score": -4}')
        grade_response(resp2.id)
    resp2.refresh_from_db()
    assert resp2.score == 0


@pytest.mark.django_db
@pytest.mark.parametrize("bad", ['{"score": "15/20"}', '{"score": null}', "[1, 2]", '{"x": 1}'])
def test_non_numeric_score_on_final_retry_is_failed_not_pending(user, bad):
    resp = _ee_response(user)
    with (
        patch("apps.exam_prep.tasks.create_llm_router") as router,
        patch.object(grade_response, "max_retries", 0),
    ):
        router.return_value.generate.return_value = _llm(bad)
        result = grade_response(resp.id)
    assert result["error"] == "grading_failed"
    resp.refresh_from_db()
    assert resp.grading_status == ExamResponse.GRADING_FAILED


@pytest.mark.django_db
def test_non_numeric_score_before_final_retry_raises_for_autoretry(user):
    resp = _ee_response(user)
    with patch("apps.exam_prep.tasks.create_llm_router") as router:
        router.return_value.generate.return_value = _llm('{"score": "15/20"}')
        with pytest.raises(ValueError):
            grade_response.run(resp.id)
    resp.refresh_from_db()
    assert resp.grading_status == ExamResponse.GRADING_PENDING


# ---- #68 --------------------------------------------------------------------


def _mcq_setup(user, n_questions=2):
    ex = ExamExercise.objects.create(
        section="CE",
        cefr_level="B1",
        title="ce",
        content={
            "questions": [
                {"prompt": f"q{i}", "options": ["a", "b"], "correct_answer": "a"}
                for i in range(n_questions)
            ]
        },
    )
    s = ExamSession.objects.create(user=user, section="CE", cefr_level="B1", max_score=n_questions)
    return ex, s


def _answer(client, s, ex, idx, ans):
    return client.post(
        f"/api/exam-prep/sessions/{s.id}/respond/",
        {"exercise_id": ex.id, "question_index": idx, "answer": ans},
        format="json",
    )


@pytest.mark.django_db
def test_repeat_answer_overwrites(user, api_client):
    api_client.force_authenticate(user=user)
    ex, s = _mcq_setup(user)
    assert _answer(api_client, s, ex, 0, "b").status_code == 200
    assert _answer(api_client, s, ex, 0, "a").status_code == 200
    rows = ExamResponse.objects.filter(session=s)
    assert rows.count() == 1
    assert rows.get().score == 1
    resp = api_client.post(f"/api/exam-prep/sessions/{s.id}/complete/")
    assert resp.status_code == 200
    s.refresh_from_db()
    assert s.score == 1
    assert s.max_score == 2


@pytest.mark.django_db
def test_partial_session_scores_against_session_max(user, api_client):
    api_client.force_authenticate(user=user)
    ex, s = _mcq_setup(user, n_questions=4)
    _answer(api_client, s, ex, 0, "a")
    resp = api_client.post(f"/api/exam-prep/sessions/{s.id}/complete/")
    assert resp.status_code == 200
    s.refresh_from_db()
    assert s.max_score == 4
    progress = ExamProgress.objects.get(user=user, section="CE")
    assert progress.best_score_pct == 25
    assert resp.data["xp_earned"] == 15  # not perfect


@pytest.mark.django_db
def test_empty_session_awards_no_xp(user, api_client):
    api_client.force_authenticate(user=user)
    ex, s = _mcq_setup(user)
    with patch("apps.exam_prep.views.award_xp") as award:
        resp = api_client.post(f"/api/exam-prep/sessions/{s.id}/complete/")
    assert resp.status_code == 200
    assert resp.data["xp_earned"] == 0
    award.assert_not_called()
    assert not ExamProgress.objects.filter(user=user, sessions_completed__gt=0).exists()


@pytest.mark.django_db
def test_complete_with_pending_grading_returns_409(user, api_client):
    api_client.force_authenticate(user=user)
    resp_row = _ee_response(user)
    s = resp_row.session
    resp = api_client.post(f"/api/exam-prep/sessions/{s.id}/complete/")
    assert resp.status_code == 409
    s.refresh_from_db()
    assert s.completed_at is None
    resp_row.grading_status = ExamResponse.GRADING_DONE
    resp_row.score = 10
    resp_row.save()
    resp = api_client.post(f"/api/exam-prep/sessions/{s.id}/complete/")
    assert resp.status_code == 200
    s.refresh_from_db()
    assert s.score == 10


@pytest.mark.django_db
def test_exercise_must_match_session_section_and_level(user, api_client):
    api_client.force_authenticate(user=user)
    ex, s = _mcq_setup(user)
    other_level = ExamExercise.objects.create(
        section="CE",
        cefr_level="C1",
        title="x",
        content={"questions": [{"prompt": "q", "correct_answer": "a"}]},
    )
    other_section = ExamExercise.objects.create(
        section="CO",
        cefr_level="B1",
        title="y",
        content={"questions": [{"prompt": "q", "correct_answer": "a"}]},
    )
    assert _answer(api_client, s, other_level, 0, "a").status_code == 400
    assert _answer(api_client, s, other_section, 0, "a").status_code == 400
    assert ExamResponse.objects.filter(session=s).count() == 0


@pytest.mark.django_db(transaction=True)
def test_ee_reanswer_resets_grading_and_requeues(user, api_client):
    api_client.force_authenticate(user=user)
    resp_row = _ee_response(user)
    s, ex = resp_row.session, resp_row.exercise
    resp_row.grading_status = ExamResponse.GRADING_DONE
    resp_row.score = 15
    resp_row.save()
    with patch("apps.exam_prep.tasks.grade_response.apply_async") as apply:
        r = _answer(api_client, s, ex, 0, "new text")
    assert r.status_code == 202
    assert ExamResponse.objects.filter(session=s).count() == 1
    row = ExamResponse.objects.get(session=s)
    assert row.grading_status == ExamResponse.GRADING_PENDING
    assert row.score == 0
    assert row.user_answer == "new text"
    apply.assert_called_once()


@pytest.mark.django_db
@pytest.mark.parametrize("idx", [-1, 2, 99])
def test_mcq_out_of_range_or_negative_index_rejected(user, api_client, idx):
    api_client.force_authenticate(user=user)
    ex, s = _mcq_setup(user)
    assert _answer(api_client, s, ex, idx, "a").status_code == 400
    assert ExamResponse.objects.filter(session=s).count() == 0


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("idx", [-1, 1, 5])
def test_ee_nonzero_index_rejected(user, api_client, idx):
    api_client.force_authenticate(user=user)
    row = _ee_response(user)
    with patch("apps.exam_prep.tasks.grade_response.apply_async") as apply:
        r = _answer(api_client, row.session, row.exercise, idx, "text")
    assert r.status_code == 400
    apply.assert_not_called()
    assert ExamResponse.objects.filter(session=row.session).count() == 1


@pytest.mark.django_db
def test_complete_never_exceeds_session_max(user, api_client):
    api_client.force_authenticate(user=user)
    ex, s = _mcq_setup(user)
    for i in range(2):
        ExamResponse.objects.create(
            session=s, exercise=ex, question_index=i, user_answer="a", score=1, max_score=1
        )
    ExamResponse.objects.create(
        session=s, exercise=ex, question_index=7, user_answer="a", score=1, max_score=1
    )
    resp = api_client.post(f"/api/exam-prep/sessions/{s.id}/complete/")
    assert resp.status_code == 200
    s.refresh_from_db()
    assert s.score == s.max_score == 2
