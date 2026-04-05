"""Seed conjugation questions for common French verbs."""

from django.core.management.base import BaseCommand
from apps.content.models import Lesson, Question, Topic


CONJUGATIONS = {
    "avoir": {
        "present": {
            "j'": "ai", "tu": "as", "il/elle": "a",
            "nous": "avons", "vous": "avez", "ils/elles": "ont",
        },
        "passe_compose": {
            "j'": "ai eu", "tu": "as eu", "il/elle": "a eu",
            "nous": "avons eu", "vous": "avez eu", "ils/elles": "ont eu",
        },
        "imparfait": {
            "j'": "avais", "tu": "avais", "il/elle": "avait",
            "nous": "avions", "vous": "aviez", "ils/elles": "avaient",
        },
    },
    "etre": {
        "present": {
            "je": "suis", "tu": "es", "il/elle": "est",
            "nous": "sommes", "vous": "etes", "ils/elles": "sont",
        },
        "passe_compose": {
            "j'": "ai ete", "tu": "as ete", "il/elle": "a ete",
            "nous": "avons ete", "vous": "avez ete", "ils/elles": "ont ete",
        },
        "imparfait": {
            "j'": "etais", "tu": "etais", "il/elle": "etait",
            "nous": "etions", "vous": "etiez", "ils/elles": "etaient",
        },
    },
    "manger": {
        "present": {
            "je": "mange", "tu": "manges", "il/elle": "mange",
            "nous": "mangeons", "vous": "mangez", "ils/elles": "mangent",
        },
        "passe_compose": {
            "j'": "ai mange", "tu": "as mange", "il/elle": "a mange",
            "nous": "avons mange", "vous": "avez mange", "ils/elles": "ont mange",
        },
        "imparfait": {
            "je": "mangeais", "tu": "mangeais", "il/elle": "mangeait",
            "nous": "mangions", "vous": "mangiez", "ils/elles": "mangeaient",
        },
    },
    "faire": {
        "present": {
            "je": "fais", "tu": "fais", "il/elle": "fait",
            "nous": "faisons", "vous": "faites", "ils/elles": "font",
        },
        "passe_compose": {
            "j'": "ai fait", "tu": "as fait", "il/elle": "a fait",
            "nous": "avons fait", "vous": "avez fait", "ils/elles": "ont fait",
        },
        "imparfait": {
            "je": "faisais", "tu": "faisais", "il/elle": "faisait",
            "nous": "faisions", "vous": "faisiez", "ils/elles": "faisaient",
        },
    },
    "aller": {
        "present": {
            "je": "vais", "tu": "vas", "il/elle": "va",
            "nous": "allons", "vous": "allez", "ils/elles": "vont",
        },
        "passe_compose": {
            "je": "suis alle", "tu": "es alle", "il/elle": "est alle",
            "nous": "sommes alles", "vous": "etes alles", "ils/elles": "sont alles",
        },
        "imparfait": {
            "j'": "allais", "tu": "allais", "il/elle": "allait",
            "nous": "allions", "vous": "alliez", "ils/elles": "allaient",
        },
    },
}


class Command(BaseCommand):
    help = "Seed conjugation drill questions for common French verbs."

    def handle(self, *args, **options):
        topic, _ = Topic.objects.get_or_create(
            name_fr="Conjugaison",
            defaults={
                "name_en": "Conjugation",
                "description": "French verb conjugation drills",
                "icon": "✏️",
                "order": 100,
                "difficulty_level": 2,
            },
        )
        lesson, _ = Lesson.objects.get_or_create(
            topic=topic,
            title="Verb Conjugation Drills",
            defaults={"type": "grammar", "content": {}, "order": 1, "difficulty": 2},
        )

        created = 0
        for verb, tenses in CONJUGATIONS.items():
            for tense, subjects in tenses.items():
                for subject, answer in subjects.items():
                    prompt = f"Conjugate {verb} ({tense}, {subject})"
                    _, is_new = Question.objects.get_or_create(
                        lesson=lesson,
                        type="conjugation",
                        prompt=prompt,
                        defaults={
                            "correct_answer": answer,
                            "wrong_answers": [],
                            "explanation": f"{subject} {answer} ({verb}, {tense})",
                            "difficulty": 2,
                        },
                    )
                    if is_new:
                        created += 1

        self.stdout.write(self.style.SUCCESS(f"Created {created} conjugation questions."))
