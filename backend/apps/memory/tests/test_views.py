import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.memory.models import MemoryNote

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="alice", email="alice@example.com", password="x")


@pytest.fixture
def other_user(db):
    return User.objects.create_user(username="bob", email="bob@example.com", password="x")


@pytest.fixture
def client_for(db):
    def _make(user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    return _make


@pytest.mark.django_db
def test_list_returns_only_active_by_default(user, client_for):
    MemoryNote.objects.create(user=user, content="active note")
    MemoryNote.objects.create(user=user, content="inactive note", is_active=False)

    response = client_for(user).get("/api/memory/notes/")

    assert response.status_code == 200
    contents = [n["content"] for n in response.json()]
    assert contents == ["active note"]


@pytest.mark.django_db
def test_list_includes_inactive_when_requested(user, client_for):
    MemoryNote.objects.create(user=user, content="active note")
    MemoryNote.objects.create(user=user, content="inactive note", is_active=False)

    response = client_for(user).get("/api/memory/notes/?include_inactive=true")

    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.django_db
def test_list_isolates_users(user, other_user, client_for):
    MemoryNote.objects.create(user=other_user, content="bob's note")

    response = client_for(user).get("/api/memory/notes/")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
def test_create_forces_source_to_user(user, client_for):
    response = client_for(user).post(
        "/api/memory/notes/",
        {"content": "Prepping for TCF June 15", "category": "goal", "source": "assistant_detected"},
        format="json",
    )

    assert response.status_code == 201
    body = response.json()
    assert body["source"] == "user"
    assert body["category"] == "goal"
    note = MemoryNote.objects.get(pk=body["id"])
    assert note.source == "user"


@pytest.mark.django_db
def test_create_rejects_blank_content(user, client_for):
    response = client_for(user).post(
        "/api/memory/notes/",
        {"content": "   "},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_create_rejects_over_500_chars(user, client_for):
    response = client_for(user).post(
        "/api/memory/notes/",
        {"content": "x" * 501},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_patch_edits_content_and_category(user, client_for):
    note = MemoryNote.objects.create(user=user, content="old", category="other")

    response = client_for(user).patch(
        f"/api/memory/notes/{note.pk}/",
        {"content": "new", "category": "goal"},
        format="json",
    )

    assert response.status_code == 200
    note.refresh_from_db()
    assert note.content == "new"
    assert note.category == "goal"


@pytest.mark.django_db
def test_patch_cannot_change_source(user, client_for):
    """PATCH must not let a client claim a note was assistant-detected
    (or vice versa). `source` is read-only at the serializer layer; this
    test pins that invariant against future serializer changes."""
    note = MemoryNote.objects.create(user=user, content="x", source="user")

    response = client_for(user).patch(
        f"/api/memory/notes/{note.pk}/",
        {"content": "y", "source": "assistant_detected"},
        format="json",
    )

    assert response.status_code == 200
    note.refresh_from_db()
    assert note.source == "user"
    assert note.content == "y"


@pytest.mark.django_db
def test_patch_other_users_note_returns_404(user, other_user, client_for):
    note = MemoryNote.objects.create(user=other_user, content="bob's")

    response = client_for(user).patch(
        f"/api/memory/notes/{note.pk}/",
        {"content": "hijacked"},
        format="json",
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_delete_soft_deletes(user, client_for):
    note = MemoryNote.objects.create(user=user, content="will be deleted")

    response = client_for(user).delete(f"/api/memory/notes/{note.pk}/")

    assert response.status_code == 204
    note.refresh_from_db()
    assert note.is_active is False


@pytest.mark.django_db
def test_delete_is_idempotent(user, client_for):
    note = MemoryNote.objects.create(user=user, content="x", is_active=False)

    response = client_for(user).delete(f"/api/memory/notes/{note.pk}/")

    assert response.status_code == 204
    note.refresh_from_db()
    assert note.is_active is False


@pytest.mark.django_db
def test_unauthenticated_returns_401(db):
    response = APIClient().get("/api/memory/notes/")
    assert response.status_code in (401, 403)
