"""Seed French content topics (Topic + Lesson + Vocabulary + ReadingText)
from hand-authored JSON files in data/.

One JSON per CEFR level: topics_fr_a1.json, topics_fr_a2.json, ...
The command takes a --level flag to pick which one to import. No LLM
calls — the JSON is the source of truth.
"""

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.content.models import Lesson, ReadingText, Topic, Vocabulary

# settings.BASE_DIR points at backend/; data/ lives one level up at the repo root.
DATA_DIR = Path(settings.BASE_DIR).parent / "data"

LEVELS = ["a1", "a2", "b1", "b2", "c1c2"]


class Command(BaseCommand):
    help = (
        "Seed French content topics from data/topics_fr_<level>.json. "
        "Each topic creates a Topic + 3 Lessons (vocab/text/phrases) + "
        "Vocabulary + ReadingText rows. Idempotent."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--level",
            type=str,
            choices=LEVELS + ["all"],
            default="all",
            help="CEFR level to seed, or 'all' for every available file.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-create lessons/vocab/reading for existing topics.",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete FR topics in the file's taxonomy before reseeding.",
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
            help="Override the JSON path (single file). Use with --level a1.",
        )

    def handle(self, *args, **opts):
        targets = LEVELS if opts["level"] == "all" else [opts["level"]]

        for lvl in targets:
            path = (
                Path(opts["path"])
                if opts["path"] and opts["level"] == lvl
                else DATA_DIR / f"topics_fr_{lvl}.json"
            )
            if not path.exists():
                self.stdout.write(self.style.WARNING(f"Skipping {lvl}: {path.name} not found."))
                continue
            self._seed_level(lvl, path, opts)

    def _seed_level(self, level, path, opts):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON in {path}: {exc}") from exc

        topics_data = payload.get("topics")
        if not isinstance(topics_data, list) or not topics_data:
            raise CommandError(f"{path.name} must have a non-empty 'topics' array.")

        self._validate(topics_data)
        total = len(topics_data)
        self.stdout.write(f"\n=== Level {level.upper()} — {total} topics from {path.name} ===")

        if opts["dry_run"]:
            for i, t in enumerate(topics_data, 1):
                vocab_n = len(t.get("vocabulary", []))
                phrases_n = len(t.get("phrases", []))
                has_reading = "yes" if t.get("reading") else "no"
                self.stdout.write(
                    f"  [{i}/{total}] {t['name_fr']} "
                    f"(vocab={vocab_n}, phrases={phrases_n}, reading={has_reading})"
                )
            self.stdout.write(self.style.WARNING("Dry run — no DB writes."))
            return

        if opts["reset"]:
            self._reset(topics_data)

        created = updated = skipped = 0
        for i, topic_spec in enumerate(topics_data, 1):
            prefix = f"[{i}/{total}]"
            name_fr = topic_spec["name_fr"]

            try:
                with transaction.atomic():
                    topic, topic_created = Topic.objects.update_or_create(
                        name_fr=name_fr,
                        language="fr",
                        defaults={
                            "name_en": topic_spec.get("name_en", name_fr),
                            "description": topic_spec.get("description", ""),
                            "icon": topic_spec.get("icon", ""),
                            "order": topic_spec.get("order", 0),
                            "difficulty_level": topic_spec.get("difficulty_level", 1),
                        },
                    )

                    if topic_created:
                        action = "created"
                        created += 1
                    elif opts["force"] or opts["reset"]:
                        # --reset wipes lessons earlier in _reset(); --force does it
                        # here on a per-topic basis. Either path needs to recreate the
                        # lessons, otherwise we'd leave the topic with no content.
                        action = "updated"
                        updated += 1
                        if opts["force"]:
                            topic.lessons.filter(language="fr").delete()
                    else:
                        self.stdout.write(f"{prefix} {name_fr} (skipped, exists)")
                        skipped += 1
                        continue

                    self._create_lessons(topic, topic_spec)
            except Exception as exc:
                raise CommandError(f"Failed to seed topic '{name_fr}': {exc}") from exc

            self.stdout.write(f"{prefix} {name_fr} ({action})")

        self.stdout.write(
            self.style.SUCCESS(
                f"Level {level.upper()}: created {created}, updated {updated}, skipped {skipped}."
            )
        )

    def _create_lessons(self, topic, topic_spec):
        order = 10
        # Vocabulary lesson
        if topic_spec.get("vocabulary"):
            vocab_lesson = Lesson.objects.create(
                topic=topic,
                type="vocab",
                title=f"Vocabulaire : {topic.name_fr}",
                content={"description": "Liste de vocabulaire essentiel."},
                order=order,
                difficulty=topic.difficulty_level,
                language="fr",
            )
            order += 10
            vocab_objs = [
                Vocabulary(
                    lesson=vocab_lesson,
                    french=v["french"],
                    english=v.get("english", ""),
                    pronunciation=v.get("pronunciation", ""),
                    example_sentence=v.get("example_sentence", ""),
                    gender=v.get("gender", "a"),
                    part_of_speech=v.get("part_of_speech", ""),
                    language="fr",
                )
                for v in topic_spec["vocabulary"]
            ]
            Vocabulary.objects.bulk_create(vocab_objs)

        # Reading text lesson
        reading = topic_spec.get("reading")
        if reading:
            text_lesson = Lesson.objects.create(
                topic=topic,
                type="text",
                title=reading.get("title", f"Lecture : {topic.name_fr}"),
                content={"description": "Texte de compréhension écrite."},
                order=order,
                difficulty=topic.difficulty_level,
                language="fr",
            )
            order += 10
            ReadingText.objects.create(
                lesson=text_lesson,
                title=reading.get("title", topic.name_fr),
                content_fr=reading.get("content_fr", ""),
                content_en=reading.get("content_en", ""),
                comprehension_questions=reading.get("comprehension_questions", []),
                language="fr",
            )

        # Phrases lesson (stored as JSON inside Lesson.content; rendered by the UI)
        phrases = topic_spec.get("phrases") or []
        cultural_note = topic_spec.get("cultural_note", "")
        if phrases or cultural_note:
            Lesson.objects.create(
                topic=topic,
                type="grammar",
                title=f"Expressions clés : {topic.name_fr}",
                content={
                    "phrases": phrases,
                    "cultural_note": cultural_note,
                },
                order=order,
                difficulty=topic.difficulty_level,
                language="fr",
            )

    def _validate(self, topics_data):
        required_topic = {"name_fr"}
        for i, t in enumerate(topics_data, 1):
            missing = required_topic - set(t.keys())
            if missing:
                raise CommandError(f"Topic #{i} missing required keys: {missing}")

    def _reset(self, topics_data):
        names = [t["name_fr"] for t in topics_data]
        qs = Topic.objects.filter(name_fr__in=names, language="fr")
        topic_count = qs.count()
        Lesson.objects.filter(topic__in=qs, language="fr").delete()
        # Topics themselves are kept so update_or_create can update metadata;
        # only the lessons (and cascaded vocab/text) are wiped.
        self.stdout.write(
            self.style.WARNING(f"Reset: wiped lessons under {topic_count} FR topics.")
        )
