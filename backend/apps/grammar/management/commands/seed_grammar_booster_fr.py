"""Seed the Grammar Booster with ~50 French topics across 8 categories.

The taxonomy (category names, topic titles, CEFR levels) is hardcoded;
the prose (summary, explanation, formula, examples) is drafted at run-time
by the existing LLM router. Idempotent: skips topics that already exist
unless --force is set.
"""

import json
import logging
import re

from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.grammar.models import GrammarCategory, GrammarTopic
from services.llm.factory import create_llm_router

logger = logging.getLogger(__name__)


TAXONOMY = [
    {
        "slug": "temps-modes-verbaux",
        "name": "Les temps et modes verbaux",
        "icon": "⏰",
        "order": 10,
        "topics": [
            {"title": "Passé composé / imparfait : le contraste", "cefr": "B1"},
            {"title": "Plus-que-parfait", "cefr": "B1"},
            {"title": "Futur simple", "cefr": "A2"},
            {"title": "Futur antérieur", "cefr": "B2"},
            {"title": "Conditionnel présent", "cefr": "B1"},
            {"title": "Conditionnel passé", "cefr": "B2"},
            {"title": "Subjonctif présent", "cefr": "B1"},
            {"title": "Subjonctif passé (reconnaissance)", "cefr": "B2"},
            {"title": "Présent de l'indicatif : verbes irréguliers fréquents", "cefr": "A2"},
            {"title": "Passé simple (reconnaissance uniquement)", "cefr": "B2"},
            {"title": "L'impératif (y compris avec pronoms)", "cefr": "A2"},
        ],
    },
    {
        "slug": "systemes-hypothetiques",
        "name": "Les systèmes hypothétiques (si)",
        "icon": "❓",
        "order": 20,
        "topics": [
            {"title": "Si + présent → futur", "cefr": "A2"},
            {"title": "Si + imparfait → conditionnel présent", "cefr": "B1"},
            {"title": "Si + plus-que-parfait → conditionnel passé", "cefr": "B2"},
        ],
    },
    {
        "slug": "pronoms",
        "name": "Les pronoms",
        "icon": "🔁",
        "order": 30,
        "topics": [
            {"title": "Pronoms COD et COI", "cefr": "A2"},
            {"title": "Pronoms relatifs simples : qui, que, dont, où", "cefr": "B1"},
            {"title": "Pronoms relatifs composés : auquel, lesquels, duquel...", "cefr": "B2"},
            {"title": "Verbes pronominaux et leur accord au passé composé", "cefr": "B1"},
            {"title": "Pronoms en et y", "cefr": "B1"},
            {"title": "Pronoms démonstratifs : celui, celle, ceux, celles", "cefr": "B1"},
            {"title": "Pronoms possessifs : le mien, la tienne, les siens...", "cefr": "B1"},
            {"title": "L'ordre des doubles pronoms", "cefr": "B2"},
            {"title": "Pronoms toniques : moi, toi, lui, eux...", "cefr": "A2"},
        ],
    },
    {
        "slug": "constructions-verbales",
        "name": "Constructions verbales",
        "icon": "🔗",
        "order": 40,
        "topics": [
            {"title": "Verbes + à / verbes + de (rection verbale)", "cefr": "B1"},
            {"title": "Gérondif (en faisant) vs participe présent (faisant)", "cefr": "B2"},
            {"title": "Verbes + infinitif direct (vouloir, pouvoir, devoir...)", "cefr": "A2"},
            {"title": "La voix passive (être + participe passé + par/de)", "cefr": "B1"},
            {
                "title": (
                    "Les semi-auxiliaires (faire faire, laisser faire, venir de, être en train de)"
                ),
                "cefr": "B2",
            },
        ],
    },
    {
        "slug": "accords",
        "name": "Les accords",
        "icon": "🪢",
        "order": 50,
        "topics": [
            {"title": "Accord du participe passé avec avoir (COD antéposé)", "cefr": "B2"},
            {"title": "Accord du participe passé avec être", "cefr": "B1"},
            {"title": "Accord du participe des verbes pronominaux", "cefr": "B2"},
            {
                "title": (
                    "Accord des adjectifs (cas particuliers : couleurs composées, demi, nu...)"
                ),
                "cefr": "B1",
            },
        ],
    },
    {
        "slug": "logique-du-discours",
        "name": "Les mots de liaison et la logique du discours",
        "icon": "🪡",
        "order": 60,
        "topics": [
            {
                "title": "La cause (parce que, car, puisque, comme, grâce à, à cause de)",
                "cefr": "B1",
            },
            {
                "title": ("La conséquence (donc, si bien que, c'est pourquoi, tellement... que)"),
                "cefr": "B1",
            },
            {"title": "Le but (pour que + subj., afin de, de peur que)", "cefr": "B2"},
            {
                "title": (
                    "L'opposition / concession (mais, bien que + subj., malgré, "
                    "en dépit de, quoique)"
                ),
                "cefr": "B2",
            },
            {"title": "La condition (à condition que, à moins que, pourvu que)", "cefr": "B2"},
            {"title": "Le temps (avant que + subj., après que, dès que, depuis que)", "cefr": "B1"},
        ],
    },
    {
        "slug": "subjonctif-declencheurs",
        "name": "Le subjonctif : ses déclencheurs",
        "icon": "🎯",
        "order": 70,
        "topics": [
            {"title": "Volonté et désir (vouloir que, souhaiter que)", "cefr": "B1"},
            {"title": "Nécessité (il faut que, il est nécessaire que)", "cefr": "B1"},
            {"title": "Émotion (être content que, avoir peur que)", "cefr": "B1"},
            {"title": "Doute (je ne pense pas que, douter que)", "cefr": "B2"},
        ],
    },
    {
        "slug": "autres-points-frequents",
        "name": "Autres points fréquents",
        "icon": "📌",
        "order": 80,
        "topics": [
            {
                "title": (
                    "La négation complexe (ne... plus, ne... jamais, ne... que, "
                    "ne... aucun, ne... ni... ni)"
                ),
                "cefr": "B1",
            },
            {"title": "Le discours indirect et la concordance des temps", "cefr": "B2"},
            {"title": "L'interrogation (est-ce que / inversion / registre soutenu)", "cefr": "B1"},
            {"title": "Comparatifs et superlatifs (meilleur vs mieux)", "cefr": "B1"},
            {
                "title": (
                    "Les articles (défini/indéfini/partitif) et leur disparition après la négation"
                ),
                "cefr": "A2",
            },
            {
                "title": (
                    "Adjectifs et pronoms indéfinis (tout, chaque, quelques, plusieurs, certains)"
                ),
                "cefr": "B1",
            },
            {"title": "La place de l'adjectif (avant/après le nom)", "cefr": "B1"},
        ],
    },
]


SYSTEM_PROMPT = (
    "You are a French grammar tutor. You write concise grammar lessons in French "
    "for adult learners studying for the TCF/TEF exam. You output STRICT JSON only, "
    "no markdown fences, no commentary. Use idiomatic, natural French. Keep explanations "
    "focused and practical — no fluff."
)


USER_PROMPT_TEMPLATE = """Topic: {title}
Category: {category_name}
CEFR level: {cefr_level}

Produce a grammar lesson as a JSON object with keys: summary, explanation, formula, examples.
- summary: one sentence in French, max 150 characters.
- explanation: 150-300 word markdown body in French. Brief intro, "Quand l'utiliser ?", "Comment le former ?", "Pièges fréquents" if relevant. Bullet lists where natural.
- formula: one-line structural pattern in French if applicable, else empty string.
- examples: 3-5 objects with idiomatic French sentence and English translation.

Return ONLY the JSON object. No prose around it. No code fences."""


_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)


def _strip_fences(text: str) -> str:
    return _FENCE_RE.sub("", text.strip()).strip()


def _unique_slug(base: str) -> str:
    base = base[:180] or "topic"
    if not GrammarTopic.objects.filter(slug=base).exists():
        return base
    existing = set(
        GrammarTopic.objects.filter(slug__startswith=f"{base}-").values_list("slug", flat=True)
    )
    i = 2
    while f"{base}-{i}" in existing or GrammarTopic.objects.filter(slug=f"{base}-{i}").exists():
        i += 1
    return f"{base}-{i}"


class Command(BaseCommand):
    help = "Seed the Grammar Booster with ~50 French topics across 7 categories. Idempotent."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-generate prose for topics that already exist.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Only process the first N topics across all categories.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List what would be done; no DB writes, no LLM calls.",
        )

    def handle(self, *args, **options):
        force = options["force"]
        limit = options["limit"]
        dry_run = options["dry_run"]

        total = sum(len(cat["topics"]) for cat in TAXONOMY)
        if limit is not None:
            total = min(total, limit)

        if dry_run:
            self.stdout.write(self.style.WARNING(f"[DRY RUN] would process {total} topics"))
        else:
            self.stdout.write(f"Seeding {total} French grammar topics...")

        router = None if dry_run else create_llm_router()

        created = updated = skipped = failed = 0
        idx = 0

        for cat_spec in TAXONOMY:
            if not dry_run:
                category, _ = GrammarCategory.objects.update_or_create(
                    slug=cat_spec["slug"],
                    language="fr",
                    defaults={
                        "name": cat_spec["name"],
                        "icon": cat_spec["icon"],
                        "order": cat_spec["order"],
                    },
                )
            else:
                category = None

            for topic_idx, topic_spec in enumerate(cat_spec["topics"]):
                if limit is not None and idx >= limit:
                    break
                idx += 1
                title = topic_spec["title"]
                cefr = topic_spec["cefr"]
                prefix = f"[{idx}/{total}]"

                if dry_run:
                    self.stdout.write(f"{prefix} {cat_spec['name']} — {title} ({cefr})")
                    continue

                existing = GrammarTopic.objects.filter(
                    category=category, title=title, language="fr"
                ).first()
                if existing and not force:
                    self.stdout.write(f"{prefix} {title} ⊘ (exists, skipped)")
                    skipped += 1
                    continue

                try:
                    payload = self._generate_lesson(
                        router, title=title, category_name=cat_spec["name"], cefr=cefr
                    )
                except Exception as exc:
                    logger.warning("LLM call failed for %r: %s", title, exc)
                    self.stdout.write(f"{prefix} {title} ✗ (LLM error)")
                    failed += 1
                    continue

                if payload is None:
                    self.stdout.write(f"{prefix} {title} ✗ (parse error)")
                    failed += 1
                    continue

                defaults = {
                    "category": category,
                    "cefr_level": cefr,
                    "summary": payload.get("summary", "")[:300],
                    "explanation": payload.get("explanation", ""),
                    "formula": payload.get("formula", "")[:400],
                    "examples": payload.get("examples", []),
                    "order": topic_idx,
                    "language": "fr",
                }

                if existing:
                    for k, v in defaults.items():
                        setattr(existing, k, v)
                    existing.save()
                    self.stdout.write(f"{prefix} {title} ✓ (updated)")
                    updated += 1
                else:
                    base_slug = slugify(title)
                    defaults["slug"] = _unique_slug(base_slug)
                    GrammarTopic.objects.create(title=title, **defaults)
                    self.stdout.write(f"{prefix} {title} ✓ (created)")
                    created += 1

            if limit is not None and idx >= limit:
                break

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f"[DRY RUN] {total} topics enumerated."))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Created {created}, updated {updated}, skipped {skipped}, failed {failed}."
                )
            )

    def _generate_lesson(self, router, *, title: str, category_name: str, cefr: str) -> dict | None:
        user_msg = USER_PROMPT_TEMPLATE.format(
            title=title, category_name=category_name, cefr_level=cefr
        )
        response = router.generate(
            messages=[{"role": "user", "content": user_msg}],
            system_prompt=SYSTEM_PROMPT,
        )
        raw = _strip_fences(response.content)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.warning("JSON parse failed for %r: %s\nRaw: %s", title, exc, raw[:500])
            return None

        if not isinstance(data, dict):
            logger.warning("LLM returned non-object for %r: %r", title, type(data).__name__)
            return None
        return data
