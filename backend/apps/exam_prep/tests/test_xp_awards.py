"""Exam session XP is keyed by session so it can only be awarded once (#67)."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.exam_prep.models import ExamSession
from apps.exam_prep.scoring import XP_EXAM_PRACTICE
from apps.gamification.models import UserStats, XPTransaction

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="ex", email="ex@example.com", password="p", target_language="fr"
    )


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _finish(client, session):
    return client.post(f"/api/exam-prep/sessions/{session.id}/complete/", format="json")


@pytest.mark.django_db
class TestExamSessionXP:
    def test_award_is_keyed_by_session(self, client, user):
        session = ExamSession.objects.create(user=user, section="CO", cefr_level="B1")
        response = _finish(client, session)
        assert response.status_code == 200
        assert response.data["xp_earned"] == XP_EXAM_PRACTICE
        txn = XPTransaction.objects.get(user=user)
        assert (txn.activity_type, txn.source_id) == (
            "exam_CO_practice",
            f"exam_session_{session.id}",
        )

    def test_already_awarded_session_reports_zero_xp(self, client, user):
        """A racing duplicate completion must not award or report XP twice."""
        session = ExamSession.objects.create(user=user, section="CO", cefr_level="B1")
        XPTransaction.objects.create(
            user=user,
            activity_type="exam_CO_practice",
            xp_amount=XP_EXAM_PRACTICE,
            source_id=f"exam_session_{session.id}",
        )
        response = _finish(client, session)
        assert response.data["xp_earned"] == 0
        assert XPTransaction.objects.filter(user=user).count() == 1
        assert UserStats.objects.get(user=user).total_xp == 0
