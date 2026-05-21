import json
from datetime import date

import pytest
from django.core.management import call_command

from apps.notes.models import Note, NoteWord


def _write_json(tmp_path, payload):
    p = tmp_path / "notes.json"
    p.write_text(json.dumps(payload), encoding="utf-8")
    return p


@pytest.mark.django_db
def test_import_creates_notes_and_words(tmp_path):
    payload = {
        "notes": [
            {
                "note_number": 1,
                "date": "2022-08-05",
                "title": None,
                "words": [
                    {"word": "call off", "definition": "cancel", "example": None},
                    {"word": "speak up", "definition": None, "example": None},
                ],
            },
            {
                "note_number": 2,
                "date": "2022-08-06",
                "title": "Phrasal verbs",
                "words": [
                    {"word": "back down", "definition": None, "example": None},
                ],
            },
        ]
    }
    path = _write_json(tmp_path, payload)
    call_command("import_notes", path=str(path))

    assert Note.objects.count() == 2
    assert NoteWord.objects.count() == 3

    note1 = Note.objects.get(language="en", note_number=1)
    assert note1.title == ""
    assert note1.date == date(2022, 8, 5)
    assert list(note1.words.values_list("word", flat=True)) == ["call off", "speak up"]

    note2 = Note.objects.get(language="en", note_number=2)
    assert note2.title == "Phrasal verbs"


@pytest.mark.django_db
def test_import_is_idempotent(tmp_path):
    payload = {
        "notes": [
            {
                "note_number": 1,
                "date": "2022-08-05",
                "title": None,
                "words": [
                    {"word": "call off", "definition": "cancel", "example": None},
                ],
            }
        ]
    }
    path = _write_json(tmp_path, payload)
    call_command("import_notes", path=str(path))
    call_command("import_notes", path=str(path))
    assert Note.objects.count() == 1
    assert NoteWord.objects.count() == 1


@pytest.mark.django_db
def test_import_updates_title_and_recreates_words(tmp_path):
    payload = {
        "notes": [
            {
                "note_number": 1,
                "date": "2022-08-05",
                "title": None,
                "words": [
                    {"word": "call off", "definition": "cancel", "example": None},
                    {"word": "speak up", "definition": None, "example": None},
                ],
            }
        ]
    }
    path = _write_json(tmp_path, payload)
    call_command("import_notes", path=str(path))
    original_word_ids = set(NoteWord.objects.values_list("id", flat=True))

    payload["notes"][0]["title"] = "Updated title"
    payload["notes"][0]["words"] = [
        {"word": "back down", "definition": "yield", "example": None},
    ]
    _write_json(tmp_path, payload)
    call_command("import_notes", path=str(path))

    note = Note.objects.get(language="en", note_number=1)
    assert note.title == "Updated title"
    new_words = list(note.words.values_list("word", flat=True))
    assert new_words == ["back down"]
    new_word_ids = set(NoteWord.objects.values_list("id", flat=True))
    assert original_word_ids.isdisjoint(new_word_ids)
