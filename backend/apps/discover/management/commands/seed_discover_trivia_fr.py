"""Seed TriviaTemplate rows from a hand-authored JSON bank.

Source of truth: `data/discover_trivia_fr.json` (loadable via --path).
Each entry maps 1:1 to a TriviaTemplate row keyed on (slug, language='fr').

No LLM calls at seed time. Idempotent — re-running with new JSON entries
adds them; --force rewrites existing rows.
"""

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.discover.models import TriviaTemplate

DATA_DIR = Path(settings.BASE_DIR).parent / "data"
REQUIRED_FIELDS = {"slug", "title", "fact_fr"}


class Command(BaseCommand):
    help = (
        "Seed TriviaTemplate from data/discover_trivia_fr.json. "
        "Idempotent — keyed on (slug, language='fr')."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            type=str,
            default=None,
            help="Override the JSON path (default: data/discover_trivia_fr.json).",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite existing rows (default: skip rows already in the bank).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would happen without writing to the DB.",
        )

    def handle(self, *args, **opts):
        path = Path(opts["path"]) if opts["path"] else DATA_DIR / "discover_trivia_fr.json"
        if not path.exists():
            raise CommandError(f"Seed file not found: {path}")

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON in {path}: {exc}") from exc

        entries = payload.get("entries")
        if not isinstance(entries, list) or not entries:
            raise CommandError(f"{path.name} must have a non-empty 'entries' array.")

        self._validate(entries, path)
        total = len(entries)
        self.stdout.write(f"\n=== Trivia FR — {total} entries from {path.name} ===")

        if opts["dry_run"]:
            for i, e in enumerate(entries[:10], 1):
                self.stdout.write(f"  [{i}/{total}] {e['slug']:30s} {e['title']}")
            if total > 10:
                self.stdout.write(f"  ... ({total - 10} more)")
            self.stdout.write(self.style.WARNING("Dry run — no DB writes."))
            return

        # Pre-fetch existing slugs in one query so we don't N+1 the bank.
        existing = set(TriviaTemplate.objects.filter(language="fr").values_list("slug", flat=True))
        created = updated = skipped = 0

        for i, entry in enumerate(entries, 1):
            slug = entry["slug"].strip()

            if slug in existing and not opts["force"]:
                skipped += 1
                continue

            defaults = {
                "title": entry["title"].strip(),
                "summary": entry.get("summary", "").strip(),
                "fact_fr": entry["fact_fr"].strip(),
                "fact_en": entry.get("fact_en", "").strip(),
                "level": entry.get("level", "").strip(),
                "category": entry.get("category", "").strip(),
                "is_active": entry.get("is_active", True),
            }
            _, was_created = TriviaTemplate.objects.update_or_create(
                slug=slug, language="fr", defaults=defaults
            )
            if was_created:
                created += 1
                self.stdout.write(f"  [{i}/{total}] {slug} (created)")
            else:
                updated += 1
                self.stdout.write(f"  [{i}/{total}] {slug} (updated)")

        self.stdout.write(
            self.style.SUCCESS(f"Done: {created} created, {updated} updated, {skipped} skipped.")
        )

    def _validate(self, entries, path):
        seen = set()
        for i, e in enumerate(entries, 1):
            missing = REQUIRED_FIELDS - set(e.keys())
            if missing:
                raise CommandError(f"{path.name} entry #{i} missing required keys: {missing}")
            slug = e["slug"].strip()
            if not slug:
                raise CommandError(f"{path.name} entry #{i} has empty slug.")
            if slug in seen:
                raise CommandError(f"{path.name} entry #{i}: duplicate slug {slug!r} in file.")
            seen.add(slug)
