"""Pre-warm DictionaryCache for the top-N most-frequent French lemmas.

Reads `data/dictionary_seed_fr.csv` (rank,lemma,part_of_speech), calls the LLM
router once per missing entry, and writes the result to DictionaryCache with
kind=LOOKUP, source=SEED, and a CEFR level derived from the frequency rank.

Idempotent: rows already present are skipped (no LLM call).
"""

import csv
import logging
import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.dictionary.cefr import cefr_from_rank
from apps.dictionary.models import DictionaryCache
from apps.dictionary.parsing import parse_json_response
from apps.dictionary.views import LOOKUP_SYSTEM_PROMPT_FR
from services.llm.factory import create_llm_router

logger = logging.getLogger(__name__)

DEFAULT_CSV_PATH = Path(settings.BASE_DIR).parent / "data" / "dictionary_seed_fr.csv"
FAILURE_LOG_PATH = Path(settings.BASE_DIR).parent / "data" / "dictionary_seed_failures.log"


class Command(BaseCommand):
    help = (
        "Pre-warm DictionaryCache with LLM-generated entries for the top-N "
        "most-frequent French lemmas. Reads data/dictionary_seed_fr.csv. "
        "Idempotent — re-runs skip rows already in the cache."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            type=str,
            default=None,
            help=f"Override CSV path (default: {DEFAULT_CSV_PATH}).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Process only the first N rows (useful for staged rollouts).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would happen, no LLM calls, no DB writes.",
        )
        parser.add_argument(
            "--retry-failed",
            action="store_true",
            help=(
                "Only re-attempt lemmas listed in "
                "data/dictionary_seed_failures.log from a prior run."
            ),
        )
        parser.add_argument(
            "--sleep",
            type=float,
            default=0.0,
            help="Seconds to sleep between LLM calls (default: 0).",
        )

    def handle(self, *args, **opts):
        path = Path(opts["path"]) if opts["path"] else DEFAULT_CSV_PATH
        if not path.exists():
            raise CommandError(f"Seed CSV not found: {path}")

        rows = self._load_rows(path)
        if opts["retry_failed"]:
            rows = self._filter_to_failures(rows)
        if opts["limit"]:
            rows = rows[: opts["limit"]]

        self.stdout.write(f"Lemmas to consider: {len(rows)}")

        skipped = created = failed = 0
        if opts["dry_run"]:
            self.stdout.write(self.style.WARNING("Dry run — no LLM calls, no DB writes."))
            for r in rows[:10]:
                self.stdout.write(
                    f"  rank={r['rank']:4d}  cefr={cefr_from_rank(r['rank'])}  lemma={r['lemma']}"
                )
            if len(rows) > 10:
                self.stdout.write(f"  ... ({len(rows) - 10} more)")
            return

        router = create_llm_router()
        failures: list[str] = []

        # Pre-fetch all existing LOOKUP keys in one query so the per-lemma
        # "is this already cached?" check is an O(1) set lookup instead of
        # N round-trips to the DB. At 3000 lemmas this turns 3000 SELECTs
        # into one. We update the set as we create rows so re-seeds
        # within the same run stay consistent.
        existing_keys: set[str] = set(
            DictionaryCache.objects.filter(kind=DictionaryCache.LOOKUP).values_list(
                "key", flat=True
            )
        )

        for i, r in enumerate(rows, start=1):
            lemma = r["lemma"]
            rank = r["rank"]
            cefr = cefr_from_rank(rank)
            prefix = f"[{i}/{len(rows)}]"

            if lemma in existing_keys:
                self.stdout.write(f"{prefix} {lemma} (skipped — cached)")
                skipped += 1
                continue

            try:
                llm_result = router.generate(
                    messages=[{"role": "user", "content": lemma}],
                    system_prompt=LOOKUP_SYSTEM_PROMPT_FR,
                )
                parsed = parse_json_response(llm_result.content)
                if parsed is None:
                    raise ValueError("malformed JSON from LLM")

                DictionaryCache.objects.create(
                    kind=DictionaryCache.LOOKUP,
                    key=lemma,
                    result=parsed,
                    cefr_level=cefr,
                    source=DictionaryCache.SEED,
                )
                existing_keys.add(lemma)
                self.stdout.write(
                    f"{prefix} {lemma} (created, CEFR={cefr}, provider={llm_result.provider})"
                )
                created += 1
            except Exception as exc:
                logger.warning("Seed failed for %r: %s", lemma, exc)
                self.stdout.write(self.style.ERROR(f"{prefix} {lemma} — FAILED: {exc}"))
                failures.append(lemma)
                failed += 1

            if opts["sleep"]:
                time.sleep(opts["sleep"])

        if failures:
            FAILURE_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
            with FAILURE_LOG_PATH.open("w", encoding="utf-8") as f:
                for lemma in failures:
                    f.write(f"{lemma}\n")
            self.stdout.write(
                self.style.WARNING(f"Wrote {len(failures)} failures to {FAILURE_LOG_PATH}")
            )

        self.stdout.write(
            self.style.SUCCESS(f"Done: {created} created, {skipped} skipped, {failed} failed.")
        )

    def _load_rows(self, path: Path) -> list[dict]:
        rows: list[dict] = []
        with path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for raw in reader:
                try:
                    rows.append(
                        {
                            "rank": int(raw["rank"]),
                            "lemma": raw["lemma"].strip().lower(),
                            "part_of_speech": (raw.get("part_of_speech") or "").strip(),
                        }
                    )
                except (KeyError, ValueError, AttributeError) as exc:
                    # AttributeError: csv.DictReader emits None for missing
                    # columns, so raw["lemma"].strip() would fail.
                    raise CommandError(f"Bad CSV row {raw}: {exc}") from exc
        # Sort by rank to make CEFR derivation correct even if the CSV is unsorted.
        rows.sort(key=lambda r: r["rank"])
        return rows

    def _filter_to_failures(self, rows: list[dict]) -> list[dict]:
        if not FAILURE_LOG_PATH.exists():
            self.stdout.write(self.style.WARNING("No failure log found; nothing to retry."))
            return []
        with FAILURE_LOG_PATH.open("r", encoding="utf-8") as f:
            failed_lemmas = {line.strip() for line in f if line.strip()}
        return [r for r in rows if r["lemma"] in failed_lemmas]
