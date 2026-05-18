import pytest
from django.contrib.auth import get_user_model

from apps.memory.models import MemoryExtractionLog, MemoryNote

User = get_user_model()


@pytest.mark.django_db
def test_memory_note_defaults():
    user = User.objects.create_user(username="u1", email="u1@example.com", password="x")
    note = MemoryNote.objects.create(user=user, content="Prepping for TCF on June 15")

    assert note.category == "other"
    assert note.source == "user"
    assert note.is_active is True
    assert note.created_at is not None
    assert note.updated_at is not None


@pytest.mark.django_db
def test_memory_note_ordering_by_most_recent_update():
    user = User.objects.create_user(username="u2", email="u2@example.com", password="x")
    first = MemoryNote.objects.create(user=user, content="first")
    second = MemoryNote.objects.create(user=user, content="second")
    first.content = "first edited"
    first.save()

    notes = list(MemoryNote.objects.filter(user=user))
    assert notes[0].pk == first.pk
    assert notes[1].pk == second.pk


@pytest.mark.django_db
def test_memory_extraction_log_can_link_to_note_and_message():
    """A log row can reference a saved note (extracted=True) or be a
    null record (extracted=False) when the LLM said 'no note here'."""
    user = User.objects.create_user(username="u3", email="u3@example.com", password="x")
    note = MemoryNote.objects.create(user=user, content="example")

    log_success = MemoryExtractionLog.objects.create(
        user=user,
        note=note,
        extracted=True,
        raw_output='{"remember": true, "content": "example"}',
    )
    log_null = MemoryExtractionLog.objects.create(
        user=user,
        extracted=False,
        raw_output='{"remember": false}',
    )

    assert log_success.note == note
    assert log_null.note is None
    assert log_null.message is None


@pytest.mark.django_db
def test_memory_note_language_defaults_to_fr():
    user = User.objects.create_user(username="lang_user", email="lu@x.com", password="x")
    note = MemoryNote.objects.create(user=user, content="x")
    assert note.language == "fr"


@pytest.mark.django_db
def test_memory_note_can_be_en():
    user = User.objects.create_user(username="lang_user2", email="lu2@x.com", password="x")
    note = MemoryNote.objects.create(user=user, content="x", language="en")
    assert note.language == "en"
