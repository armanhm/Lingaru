"""Celery tasks for the Exam Prep app.

The EE (production écrite) and EO (production orale) sections grade
student writing/speaking with an LLM. That call blocks for 2-3s, so we
run it as a Celery task and let the frontend poll for the result.

Auto-graded sections (CO / CE — multiple choice) stay synchronous in
the view; they don't need this path.
"""

import json
import logging
import re

from celery import shared_task
from django.utils import timezone

from apps.exam_prep.models import ExamResponse
from services.llm.factory import create_llm_router
from services.llm.prompts import SYSTEM_PROMPTS

logger = logging.getLogger(__name__)


def _parse_grading_json(text: str) -> dict | None:
    """Strip markdown fences and parse the LLM's grading JSON.

    Mirrors the shape used by the dictionary parser. Returns None on
    any failure — caller decides whether to mark the response as failed.
    """
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return None


@shared_task(
    name="exam_prep.grade_response",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=60,
    max_retries=2,
)
def grade_response(self, response_id: int) -> dict:
    """Grade an EE/EO ExamResponse via the LLM and persist the result.

    Idempotent on retry — re-running on a completed row is a no-op so
    Celery autoretry can't corrupt state.

    Returns the grading dict for the polling endpoint to surface.
    """
    try:
        response = ExamResponse.objects.select_related("exercise", "session").get(id=response_id)
    except ExamResponse.DoesNotExist:
        logger.warning("grade_response: ExamResponse %s vanished", response_id)
        return {"error": "response_not_found"}

    if response.grading_status == ExamResponse.GRADING_DONE:
        # A previous attempt already finished — return the existing grading.
        try:
            return json.loads(response.ai_feedback) if response.ai_feedback else {}
        except json.JSONDecodeError:
            return {}

    section = response.session.section
    if section not in ("EE", "EO"):
        # Shouldn't happen, but don't loop forever on a misqueued task.
        response.grading_status = ExamResponse.GRADING_NOT_REQUIRED
        response.save(update_fields=["grading_status"])
        return {"error": "section_not_graded", "section": section}

    prompt_key = "exam_ee_grading" if section == "EE" else "exam_eo_grading"
    system_prompt = SYSTEM_PROMPTS.get(prompt_key, "")
    exercise = response.exercise
    task_prompt = exercise.content.get("prompt_fr", exercise.content.get("prompt_en", ""))
    rubric = exercise.content.get("rubric", "")
    user_msg = (
        f"Task: {task_prompt}\n"
        f"{'Rubric: ' + rubric if rubric else ''}\n\n"
        f"Student response:\n{response.user_answer}"
    )

    router = create_llm_router()
    llm_result = router.generate(
        messages=[{"role": "user", "content": user_msg}],
        system_prompt=system_prompt,
    )
    grading = _parse_grading_json(llm_result.content)

    if grading is None:
        # We exhausted retries on a malformed response — mark as failed
        # and surface a clean error to the polling client. We deliberately
        # don't re-raise here on the final retry; raising would leave the
        # row stuck in "pending" forever.
        if self.request.retries >= self.max_retries:
            response.grading_status = ExamResponse.GRADING_FAILED
            response.grading_completed_at = timezone.now()
            response.ai_feedback = json.dumps(
                {"error": "parse_failed", "raw": llm_result.content[:500]}
            )
            response.save(update_fields=["grading_status", "grading_completed_at", "ai_feedback"])
            return {"error": "parse_failed"}
        # Otherwise: let Celery retry per @shared_task autoretry policy.
        raise ValueError("LLM returned unparseable JSON")

    ai_score = grading.get("score", 0)
    ai_max = grading.get("max_score", 20)
    response.score = ai_score
    response.max_score = ai_max
    response.ai_feedback = json.dumps(grading, ensure_ascii=False)
    response.grading_status = ExamResponse.GRADING_DONE
    response.grading_completed_at = timezone.now()
    response.save(
        update_fields=[
            "score",
            "max_score",
            "ai_feedback",
            "grading_status",
            "grading_completed_at",
        ]
    )
    return grading
