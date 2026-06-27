"""Query-count regressions for the agent-runs list endpoint.

The serializer's message_count field used to fire one COUNT per row.
After PR-perf, the view annotates message_count_annotated so 20 runs is
a constant number of queries, not 20 + 1.
"""

import pytest
from django.contrib.auth import get_user_model

from apps.agents.models import Agent, AgentRun
from apps.assistant.models import Conversation, Message

User = get_user_model()


@pytest.fixture
def user_with_runs(db):
    user = User.objects.create_user(username="runs", email="r@x.com", password="p")
    agent = Agent.objects.create(slug="conv", name="Conv", system_prompt="...")
    for i in range(5):
        conv = Conversation.objects.create(user=user, title=f"thread {i}")
        AgentRun.objects.create(user=user, agent=agent, conversation=conv)
        # 3 messages per conversation so the count is meaningful
        for j in range(3):
            Message.objects.create(conversation=conv, role="user", content=f"m{j}")
    return user, agent


@pytest.mark.django_db
def test_runs_list_does_not_n_plus_one(user_with_runs, api_client, django_assert_num_queries):
    user, agent = user_with_runs
    api_client.force_authenticate(user=user)

    # 5 runs, each with 3 messages. The view should NOT issue one query per
    # run for message counts — that would be 6+ extra queries.
    # Today the optimized path takes exactly 2 queries:
    #   1) lookup agent by slug
    #   2) AgentRun list with select_related(conversation) + Count() annotation
    # Pin to <=3 to allow for a future addition without making this test
    # silently regress to N+1 again.
    with django_assert_num_queries(2):
        response = api_client.get(f"/api/agents/{agent.slug}/runs/")
    assert response.status_code == 200, response.data
    assert len(response.data) == 5
    # Sanity-check the annotation is producing real counts (not zero).
    assert all(r["message_count"] == 3 for r in response.data), (
        f"got message_counts {[r['message_count'] for r in response.data]}"
    )
