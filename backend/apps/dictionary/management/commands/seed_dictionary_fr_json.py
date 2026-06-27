"""Seed DictionaryCache from hand-authored JSON files (Phase 1 v2).

Unlike `seed_dictionary_fr`, this loader does NOT call the LLM. The source
of truth is `data/dictionary_seed_fr_<level>.json`, authored by hand and
reviewed in git. Each entry's payload matches the shape the dictionary API
already returns to the frontend, so the loader is a direct
`update_or_create` with no transformation.

Idempotent — re-running skips/refreshes existing rows by (kind, key).
"""

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.dictionary.models import DictionaryCache

DATA_DIR = Path(settings.BASE_DIR).parent / "data"
LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"]

REQUIRED_FIELDS = {"lemma", "definitions"}


class Command(BaseCommand):
    help = (
        "Seed DictionaryCache from hand-authored JSON files in data/. "
        "No LLM calls. Idempotent — keyed on (kind=lookup, key=lemma)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--level",
            type=str,
            choices=LEVELS + ["all"],
            default="all",
            help="CEFR level to seed, or 'all' for every available level file.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite existing rows (default: skip rows already in the cache).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would happen without writing to the DB.",
        )
        parser.add_argument(
            "--path",
            type=str,
            default=None,
            help="Override the JSON path (single file). Use with --level.",
        )

    def handle(self, *args, **opts):
        targets = LEVELS if opts["level"] == "all" else [opts["level"]]

        total_created = total_updated = total_skipped = 0

        for lvl in targets:
            path = (
                Path(opts["path"])
                if opts["path"] and opts["level"] == lvl
                else DATA_DIR / f"dictionary_seed_fr_{lvl}.json"
            )
            if not path.exists():
                self.stdout.write(
                    self.style.WARNING(f"Skipping {lvl}: {path.name} not found.")
                )
                continue

            created, updated, skipped = self._seed_level(lvl, path, opts)
            total_created += created
            total_updated += updated
            total_skipped += skipped

        self.stdout.write(
            self.style.SUCCESS(
                f"Done: {total_created} created, {total_updated} updated, "
                f"{total_skipped} skipped."
            )
        )

    def _seed_level(self, level: str, path: Path, opts: dict) -> tuple[int, int, int]:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON in {path}: {exc}") from exc

        entries = payload.get("entries")
        if not isinstance(entries, list) or not entries:
            raise CommandError(f"{path.name} must have a non-empty 'entries' array.")

        self._validate(entries, path)
        total = len(entries)
        self.stdout.write(
            f"\n=== Level {level.upper()} — {total} entries from {path.name} ==="
        )

        if opts["dry_run"]:
            for i, e in enumerate(entries[:10], 1):
                self.stdout.write(
                    f"  [{i}/{total}] {e['lemma']} "
                    f"(cefr={e.get('cefr_level', level.upper())}, "
                    f"pos={e.get('part_of_speech', '?')})"
                )
            if total > 10:
                self.stdout.write(f"  ... ({total - 10} more)")
            self.stdout.write(self.style.WARNING("Dry run — no DB writes."))
            return 0, 0, 0

        created = updated = skipped = 0
        for i, entry in enumerate(entries, 1):
            lemma = entry["lemma"].strip().lower()
            cefr_level = entry.get("cefr_level", level.upper())

            # Result payload returned by /api/dictionary/lookup/ on a hit.
            result_payload = {
                "word": lemma,
                "part_of_speech": entry.get("part_of_speech"),
                "definitions": entry["definitions"],
                "examples": entry.get("examples", []),
                "synonyms": entry.get("synonyms", []),
                "antonyms": entry.get("antonyms", []),
                "etymology": entry.get("etymology"),
                "register": entry.get("register", "neutral"),
                "gender": entry.get("gender"),
            }

            existing = DictionaryCache.objects.filter(
                kind=DictionaryCache.LOOKUP, key=lemma
            ).first()

            if existing and not opts["force"]:
                self.stdout.write(f"  [{i}/{total}] {lemma} (skipped — exists)")
                skipped += 1
                continue

            DictionaryCache.objects.update_or_create(
                kind=DictionaryCache.LOOKUP,
                key=lemma,
                defaults={
                    "result": result_payload,
                    "cefr_level": cefr_level,
                    "source": DictionaryCache.SEED,
                },
            )
            if existing:
                self.stdout.write(f"  [{i}/{total}] {lemma} (updated)")
                updated += 1
            else:
                self.stdout.write(f"  [{i}/{total}] {lemma} (created)")
                created += 1

        return created, updated, skipped

    def _validate(self, entries: list, path: Path) -> None:
        seen: set[str] = set()
        for i, e in enumerate(entries, 1):
            missing = REQUIRED_FIELDS - set(e.keys())
            if missing:
                raise CommandError(
                    f"{path.name} entry #{i} missing required keys: {missing}"
                )
            lemma = (e.get("lemma") or "").strip().lower()
            if not lemma:
                raise CommandError(f"{path.name} entry #{i} has empty lemma.")
            if lemma in seen:
                raise CommandError(
                    f"{path.name} entry #{i}: duplicate lemma {lemma!r} in file."
                )
            seen.add(lemma)
            if not isinstance(e.get("definitions"), list) or not e["definitions"]:
                raise CommandError(
                    f"{path.name} entry #{i} ({lemma}): definitions must be a non-empty list."
                )
