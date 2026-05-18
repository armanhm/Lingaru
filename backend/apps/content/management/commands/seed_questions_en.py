"""Seed MCQ quiz questions for the EN lessons.

For each EN vocab lesson, generate one MCQ question per vocab item:
"What is the French translation of '<english>'?"
Distractors are drawn from other vocab in the same lesson.

Skips text-type lessons (no vocab rows to mine). Idempotent: skips
when the lesson already has questions.
"""

import random

from django.core.management.base import BaseCommand

from apps.content.models import Lesson, Question, Vocabulary


class Command(BaseCommand):
    help = "Seed quiz questions for EN lessons."

    def handle(self, *args, **options):
        questions_created = 0
        lessons_seen = 0
        lessons_skipped = 0

        for lesson in Lesson.objects.filter(language="en"):
            lessons_seen += 1
            # Skip if this lesson already has questions (idempotency).
            if Question.objects.filter(lesson=lesson).exists():
                lessons_skipped += 1
                continue

            vocab_items = list(Vocabulary.objects.filter(lesson=lesson, language="en"))
            if not vocab_items:
                # Text-type lessons have no vocab; skip.
                continue

            for vocab in vocab_items:
                # Pick up to 3 distractors from other vocab in the same lesson.
                distractor_pool = [v.french for v in vocab_items if v.french != vocab.french]
                random.shuffle(distractor_pool)
                distractors = distractor_pool[:3]

                # If we don't have at least 1 distractor, skip this question
                # (would be a trivial MCQ with one option).
                if not distractors:
                    continue

                Question.objects.create(
                    lesson=lesson,
                    type="mcq",
                    prompt=f"What is the French translation of '{vocab.english}'?",
                    correct_answer=vocab.french,
                    wrong_answers=distractors,
                    difficulty=lesson.difficulty,
                    language="en",
                )
                questions_created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"EN questions seeded: +{questions_created} "
                f"({lessons_seen} EN lessons seen, {lessons_skipped} skipped as already populated)"
            )
        )
