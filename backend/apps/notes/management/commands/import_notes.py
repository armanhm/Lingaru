"""Import the 80 'Our Notes' study notes from data/structured_notes.json.

Idempotent: re-running updates existing notes by (language, note_number)
and re-creates their NoteWord rows from scratch.
"""

import json
from datetime import date as date_cls
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.notes.models import Note, NoteWord

# backend/apps/notes/management/commands/import_notes.py -> repo root
DEFAULT_JSON_PATH = Path(__file__).resolve().parents[5] / "data" / "structured_notes.json"


class Command(BaseCommand):
    help = "Import study notes from data/structured_notes.json."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="No-op flag (kept for consistency); import is already idempotent.",
        )
        parser.add_argument(
            "--path",
            type=str,
            default=None,
            help="Override path to the structured notes JSON file.",
        )

    def handle(self, *args, **options):
        json_path = Path(options["path"]) if options["path"] else DEFAULT_JSON_PATH
        if not json_path.exists():
            raise CommandError(f"JSON file not found: {json_path}")

        with json_path.open("r", encoding="utf-8") as f:
            payload = json.load(f)

        notes_data = payload.get("notes", [])
        if not isinstance(notes_data, list):
            raise CommandError("JSON 'notes' field must be a list.")

        created_count = 0
        updated_count = 0
        total_words = 0

        with transaction.atomic():
            for item in notes_data:
                note_number = item["note_number"]
                date_str = item["date"]
                title = item.get("title") or ""
                words = item.get("words") or []

                note, was_created = Note.objects.update_or_create(
                    language="en",
                    note_number=note_number,
                    defaults={
                        "date": date_cls.fromisoformat(date_str),
                        "title": title,
                        "is_active": True,
                    },
                )
                if was_created:
                    created_count += 1
                else:
                    updated_count += 1

                NoteWord.objects.filter(note=note).delete()
                for idx, w in enumerate(words):
                    NoteWord.objects.create(
                        note=note,
                        word=w.get("word", ""),
                        definition=w.get("definition") or "",
                        example=w.get("example") or "",
                        order=idx,
                    )
                    total_words += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"imported {len(notes_data)} notes, {total_words} words. "
                f"created {created_count}, updated {updated_count}."
            )
        )
