import pytest
from django.contrib.auth import get_user_model

from apps.my_notes.models import MyNote

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="alice", email="alice@x.com", password="x")


@pytest.mark.django_db
def test_create_with_required_fields(user):
    note = MyNote.objects.create(user=user, title="Subjunctive practice")
    assert note.id is not None
    assert note.kind == "freeform"
    assert note.language == "fr"
    assert note.tags == []
    assert note.body_markdown == ""
    assert note.is_favorite is False
    assert note.is_public is False
    assert note.created_at is not None
    assert note.updated_at is not None


@pytest.mark.django_db
def test_default_ordering_by_updated_at_desc(user):
    first = MyNote.objects.create(user=user, title="first")
    second = MyNote.objects.create(user=user, title="second")
    # Bump first so it becomes most recently updated.
    first.title = "first-updated"
    first.save()

    ordered = list(MyNote.objects.all())
    assert ordered[0].id == first.id
    assert ordered[1].id == second.id


@pytest.mark.django_db
def test_cascade_delete_with_user(user):
    MyNote.objects.create(user=user, title="A")
    MyNote.objects.create(user=user, title="B")
    assert MyNote.objects.count() == 2

    user.delete()
    assert MyNote.objects.count() == 0


@pytest.mark.django_db
def test_str_includes_title(user):
    note = MyNote.objects.create(user=user, title="My title")
    assert "My title" in str(note)
