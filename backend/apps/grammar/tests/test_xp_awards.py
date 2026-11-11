"""Grammar session XP is keyed by session so it can only be awarded once (#67)."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.gamification.models import UserStats, XPTransaction
from apps.grammar.models import GrammarSession

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="gx", email="gx@example.com", password="p")


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _finish(client, session):
    return client.post(f"/api/grammar/sessions/{session.id}/complete/", format="json")


@pytest.mark.django_db
class TestGrammarSessionXP:
    def test_award_is_keyed_by_session(self, client, user):
        session = GrammarSession.objects.create(user=user, mode="drill", score=2, total=2)
        response = _finish(client, session)
        assert response.status_code == 200
        assert response.data["xp_earned"] == 16
        txn = XPTransaction.objects.get(user=user)
        assert (txn.activity_type, txn.source_id) == (
            "grammar_drill",
            f"grammar_session_{session.id}",
        )

    def test_already_awarded_session_reports_zero_xp(self, client, user):
        """A racing duplicate completion must not award or report XP twice."""
        session = GrammarSession.objects.create(user=user, mode="drill", score=2, total=2)
        XPTransaction.objects.create(
            user=user,
            activity_type="grammar_drill",
            xp_amount=16,
            source_id=f"grammar_session_{session.id}",
        )
        response = _finish(client, session)
        assert response.data["xp_earned"] == 0
        assert XPTransaction.objects.filter(user=user).count() == 1
        assert UserStats.objects.get(user=user).total_xp == 0
