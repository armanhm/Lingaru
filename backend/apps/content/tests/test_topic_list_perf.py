"""Query-count regression for /api/content/topics/.

Before the fix, `lesson_count` was `source="lessons.count"` — a separate
COUNT() per topic. With 20+ topics that's 20+ queries. After the fix the
view annotates lesson_count_annotated in one aggregate, so the response
size doesn't drive the query count.
"""

import pytest
from django.contrib.auth import get_user_model

from apps.content.models import Lesson, Topic

User = get_user_model()


@pytest.fixture
def topics_with_lessons(db):
    user = User.objects.create_user(
        username="t", email="t@x.com", password="p", target_language="fr"
    )
    for i in range(15):
        topic = Topic.objects.create(
            name_fr=f"Topic {i}",
            name_en=f"Topic {i}",
            order=i,
            difficulty_level=1,
            language="fr",
        )
        for j in range(3):
            Lesson.objects.create(
                topic=topic,
                type="vocab",
                title=f"L{j}",
                order=j,
                difficulty=1,
                language="fr",
            )
    return user


@pytest.mark.django_db
def test_topic_list_does_not_n_plus_one(topics_with_lessons, api_client, django_assert_num_queries):
    user = topics_with_lessons
    api_client.force_authenticate(user=user)

    # 15 topics × 1 COUNT each pre-fix = 15+1 queries.
    # Post-fix: 1 aggregate query returns the list with lesson_count_annotated.
    with django_assert_num_queries(1):
        response = api_client.get("/api/content/topics/")
    assert response.status_code == 200, response.data
    assert len(response.data) == 15
    assert all(t["lesson_count"] == 3 for t in response.data)
