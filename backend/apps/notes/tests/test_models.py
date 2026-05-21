from datetime import date

import pytest
from django.db import IntegrityError

from apps.notes.models import Note, NoteWord


@pytest.mark.django_db
def test_note_can_be_created_with_words():
    note = Note.objects.create(note_number=1, date=date(2022, 8, 5), language="en")
    NoteWord.objects.create(note=note, word="call off", definition="cancel", order=0)
    NoteWord.objects.create(note=note, word="speak up", definition="speak loudly", order=1)

    assert Note.objects.count() == 1
    assert note.words.count() == 2
    assert list(note.words.values_list("word", flat=True)) == ["call off", "speak up"]


@pytest.mark.django_db
def test_unique_constraint_on_language_and_note_number():
    Note.objects.create(note_number=1, date=date(2022, 8, 5), language="en")
    with pytest.raises(IntegrityError):
        Note.objects.create(note_number=1, date=date(2022, 8, 6), language="en")


@pytest.mark.django_db
def test_same_note_number_allowed_across_languages():
    Note.objects.create(note_number=1, date=date(2022, 8, 5), language="en")
    Note.objects.create(note_number=1, date=date(2022, 8, 5), language="fr")
    assert Note.objects.count() == 2


@pytest.mark.django_db
def test_cascade_delete_note_removes_words():
    note = Note.objects.create(note_number=2, date=date(2022, 8, 6), language="en")
    NoteWord.objects.create(note=note, word="back down", order=0)
    NoteWord.objects.create(note=note, word="pass up", order=1)
    assert NoteWord.objects.count() == 2

    note.delete()
    assert Note.objects.count() == 0
    assert NoteWord.objects.count() == 0


@pytest.mark.django_db
def test_note_default_language_is_en():
    note = Note.objects.create(note_number=3, date=date(2022, 8, 7))
    assert note.language == "en"


@pytest.mark.django_db
def test_notes_default_ordering_is_newest_first():
    Note.objects.create(note_number=1, date=date(2022, 8, 5), language="en")
    Note.objects.create(note_number=2, date=date(2022, 8, 6), language="en")
    Note.objects.create(note_number=3, date=date(2022, 8, 7), language="en")
    numbers = list(Note.objects.values_list("note_number", flat=True))
    assert numbers == [3, 2, 1]
