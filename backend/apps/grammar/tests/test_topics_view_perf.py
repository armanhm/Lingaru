"""Query-count regression for the grammar topic list endpoint.

Before the fix, GrammarTopicListSerializer fired:
- 1 query per topic for `drill_count` (.drills.count())
- 1 query per topic for `_user_mastery` (GrammarMastery.objects.filter(...).first())

With 10 topics that's 20+1 queries. After the fix the view annotates
drill_count_annotated and prefetches a per-user `_prefetched_user_mastery`
attribute, so the count is constant regardless of list size.
"""

import pytest
from django.contrib.auth import get_user_model

from apps.grammar.models import (
    GrammarCategory,
    GrammarDrillItem,
    GrammarMastery,
    GrammarTopic,
)

User = get_user_model()


@pytest.fixture
def topics_with_mastery(db):
    user = User.objects.create_user(
        username="g", email="g@x.com", password="p", target_language="fr"
    )
    cat = GrammarCategory.objects.create(slug="tenses", name="Les temps", language="fr")
    for i in range(10):
        topic = GrammarTopic.objects.create(
            category=cat,
            slug=f"t{i}",
            title=f"Topic {i}",
            cefr_level="A2",
            language="fr",
            is_active=True,
        )
        # Each topic has 3 drill items so drill_count is meaningful.
        for j in range(3):
            GrammarDrillItem.objects.create(
                topic=topic, type="mcq", prompt=f"p{j}", correct_answer="a"
            )
        # User has practiced half the topics
        if i % 2 == 0:
            GrammarMastery.objects.create(user=user, topic=topic, mastery_score=50)
    return user


@pytest.mark.django_db
def test_topics_list_does_not_n_plus_one(
    topics_with_mastery, api_client, django_assert_num_queries
):
    user = topics_with_mastery
    api_client.force_authenticate(user=user)

    # 10 topics: pre-fix would issue 1 + 10*2 = 21 queries. After the fix:
    #   1) GrammarTopic list with annotate(drill_count) + select_related(category)
    #      + Prefetch(mastery_records filtered by user)
    # That's 2 queries (list + prefetch). Cap at 3 for any single-query
    # auth/middleware addition we don't know about.
    with django_assert_num_queries(2):
        response = api_client.get("/api/grammar/topics/")
    assert response.status_code == 200, response.data
    assert len(response.data) == 10
    # Sanity-check that prefetched mastery is applied: half should have a
    # non-zero score, half should be 0.
    scores = sorted(t["mastery"] for t in response.data)
    assert scores.count(0) == 5
    assert scores.count(50.0) == 5
    # And that drill counts are accurate (real annotation, not a stub).
    assert all(t["drill_count"] == 3 for t in response.data)
