"""Seed the Grammar Booster with curated French lessons from a JSON file.

The lesson content is hand-authored and lives in `data/grammar_booster_fr.json`
at the repo root. No LLM calls — the JSON is the source of truth, fully
reviewable and reproducible across environments.
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.grammar.models import GrammarCategory, GrammarTopic

# backend/apps/grammar/management/commands/seed_grammar_booster_fr.py -> repo root
DEFAULT_JSON_PATH = Path(__file__).resolve().parents[5] / "data" / "grammar_booster_fr.json"


class Command(BaseCommand):
    help = (
        "Seed the Grammar Booster with hand-authored French grammar lessons "
        "(8 categories, ~50 topics) from data/grammar_booster_fr.json. Idempotent."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-write existing topics with content from the JSON.",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete all FR topics in the taxonomy before reseeding (transactional).",
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
            help="Override the JSON path (default: data/grammar_booster_fr.json).",
        )

    def handle(self, *args, **opts):
        path = Path(opts["path"]) if opts["path"] else DEFAULT_JSON_PATH
        if not path.exists():
            raise CommandError(f"JSON file not found: {path}")

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON in {path}: {exc}") from exc

        categories_data = payload.get("categories")
        if not isinstance(categories_data, list) or not categories_data:
            raise CommandError("JSON must have a non-empty 'categories' array.")

        self._validate(categories_data)
        taxonomy_slugs = [c["slug"] for c in categories_data]
        total_topics = sum(len(c["topics"]) for c in categories_data)

        self.stdout.write(
            f"Loaded {len(categories_data)} categories, {total_topics} topics from {path.name}."
        )

        if opts["dry_run"]:
            self._print_dry_run(categories_data)
            return

        if opts["reset"]:
            self._reset(taxonomy_slugs)

        created = updated = skipped = 0
        topic_index = 0
        for cat_spec in categories_data:
            category, cat_created = GrammarCategory.objects.update_or_create(
                slug=cat_spec["slug"],
                defaults={
                    "name": cat_spec["name"],
                    "icon": cat_spec.get("icon", ""),
                    "order": cat_spec.get("order", 0),
                    "language": "fr",
                },
            )
            if cat_created:
                self.stdout.write(f"  -> category '{cat_spec['name']}' created")

            for order_idx, topic_spec in enumerate(cat_spec["topics"], start=1):
                topic_index += 1
                prefix = f"[{topic_index}/{total_topics}]"
                title = topic_spec["title"]
                slug = topic_spec["slug"]

                existing = GrammarTopic.objects.filter(slug=slug).first()
                if existing and not opts["force"]:
                    self.stdout.write(f"{prefix} {title} (skipped, exists)")
                    skipped += 1
                    continue

                defaults = {
                    "category": category,
                    "title": title,
                    "cefr_level": topic_spec["cefr_level"],
                    "summary": topic_spec.get("summary", ""),
                    "explanation": topic_spec["explanation"],
                    "formula": topic_spec.get("formula", ""),
                    "examples": topic_spec.get("examples", []),
                    "order": order_idx * 10,
                    "language": "fr",
                }
                _, was_created = GrammarTopic.objects.update_or_create(
                    slug=slug,
                    defaults=defaults,
                )
                if was_created:
                    self.stdout.write(f"{prefix} {title} (created)")
                    created += 1
                else:
                    self.stdout.write(f"{prefix} {title} (updated)")
                    updated += 1

        self.stdout.write(
            self.style.SUCCESS(f"Created {created}, updated {updated}, skipped {skipped}.")
        )

    def _validate(self, categories_data):
        required_cat = {"slug", "name", "topics"}
        required_topic = {"title", "slug", "cefr_level", "explanation"}
        for cat in categories_data:
            missing_cat = required_cat - set(cat.keys())
            if missing_cat:
                raise CommandError(f"Category missing keys: {missing_cat} in {cat}")
            for topic in cat["topics"]:
                missing_topic = required_topic - set(topic.keys())
                if missing_topic:
                    raise CommandError(
                        f"Topic in '{cat['slug']}' missing keys: {missing_topic} "
                        f"(topic title: {topic.get('title', '?')})"
                    )

    def _print_dry_run(self, categories_data):
        topic_index = 0
        total = sum(len(c["topics"]) for c in categories_data)
        for cat in categories_data:
            self.stdout.write(f"\n{cat.get('icon', '')} {cat['name']} ({cat['slug']})")
            for topic in cat["topics"]:
                topic_index += 1
                self.stdout.write(
                    f"  [{topic_index}/{total}] [{topic['cefr_level']}] {topic['title']}"
                )
        self.stdout.write(self.style.WARNING("\nDry run -- no DB writes."))

    def _reset(self, taxonomy_slugs):
        with transaction.atomic():
            cats = GrammarCategory.objects.filter(slug__in=taxonomy_slugs, language="fr")
            topic_count = GrammarTopic.objects.filter(category__in=cats, language="fr").count()
            cat_count = cats.count()
            GrammarTopic.objects.filter(category__in=cats, language="fr").delete()
            self.stdout.write(
                self.style.WARNING(
                    f"Reset: deleted {topic_count} topics across {cat_count} categories."
                )
            )
