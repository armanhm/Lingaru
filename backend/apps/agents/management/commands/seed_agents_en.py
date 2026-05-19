"""Backfill EN metadata + system_prompt_en on the 9 existing agents.

Non-destructive by default: only fills an `_en` field when it's currently
empty (string or list). Pass --force to overwrite.

Translations are natural English voices (not literal) tuned for an
English learner. `name_en` is intentionally omitted: every agent name is
already English ("Grammar Coach", "Writing Editor", ...) so the fallback
to `name` is sufficient.

Agent slugs (matches seed_agents.py):
  grammar-coach, writing-editor, verb-studio, vocab-explorer,
  translation-lab, idiom-hunter, culture-guide, pronunciation-buddy,
  exam-coach
"""

from django.core.management.base import BaseCommand

from apps.agents.models import Agent

AGENT_EN_METADATA = {
    "grammar-coach": {
        "tagline_en": "Walks you through one grammar point at a time with examples.",
        "description_en": (
            "Grammar Coach untangles one grammar point at a time. Give it a "
            "concept (the present perfect, count vs. non-count nouns, "
            "modals of obligation) and it replies with a clear explanation, "
            "a formula, examples, and 2-3 common traps to avoid."
        ),
        "best_for_en": [
            "Present perfect",
            "Conditionals",
            "Articles",
            "Modals",
        ],
        "capabilities_en": [
            "Explains a rule",
            "Gives examples",
            "Lists exceptions",
            "Suggests a drill",
        ],
        "suggested_questions_en": [
            "When do I use the present perfect?",
            "Difference between 'will' and 'going to'?",
            "How do I use 'a' vs. 'the'?",
            "What's the rule for the third conditional?",
        ],
    },
    "writing-editor": {
        "tagline_en": "Edits your English text and explains every change.",
        "description_en": (
            "Writing Editor reads a text you wrote in English, a sentence, "
            "paragraph, or essay, and edits it while showing what changed "
            "and why. Great prep for the writing section of TOEFL, IELTS, "
            "or Cambridge exams."
        ),
        "best_for_en": [
            "Agreement",
            "Word choice",
            "Tense",
            "Prepositions",
        ],
        "capabilities_en": [
            "Edits a text",
            "Explains each change",
            "CEFR estimate",
            "Suggests a rewrite",
        ],
        "suggested_questions_en": [
            "Edit: 'Yesterday I have gone to the cinema and watched a good film.'",
            "Check: 'The car is beauty and fast.'",
            "Is this correct: 'I suggest that he comes with us'?",
            "Polish my paragraph about my last vacation.",
        ],
    },
    "verb-studio": {
        "tagline_en": "Conjugates any English verb across its principal forms and tenses.",
        "description_en": (
            "Verb Studio gives you the full picture of an English verb: "
            "base form, past simple, past participle, present participle, "
            "and examples in the main tenses (simple, continuous, perfect). "
            "Flags irregular forms and tricky stress patterns."
        ),
        "best_for_en": [
            "Irregular verbs",
            "Past participles",
            "Phrasal verbs",
            "Perfect tenses",
        ],
        "capabilities_en": [
            "Principal forms",
            "Tense overview",
            "Usage examples",
            "Common mistakes",
        ],
        "suggested_questions_en": [
            "Conjugate 'to be'.",
            "Give me the past participle of 'lie' vs. 'lay'.",
            "Show 'go' in all the main tenses.",
            "What's the present perfect continuous of 'work'?",
        ],
    },
    "vocab-explorer": {
        "tagline_en": "Full breakdown of a word: meaning, part of speech, IPA, examples.",
        "description_en": (
            "Vocab Explorer digs into an English word for you: definition, "
            "part of speech, IPA pronunciation, register, synonyms, false "
            "friends, and concrete usage examples."
        ),
        "best_for_en": [
            "Definitions",
            "Collocations",
            "False friends",
            "Synonyms",
        ],
        "capabilities_en": [
            "Definition",
            "Part of speech + IPA",
            "Synonyms / antonyms",
            "False friends",
        ],
        "suggested_questions_en": [
            "What does 'to wander' mean?",
            "Difference between 'come' and 'go'?",
            "Synonyms for 'beautiful'?",
            "Is 'eventually' a false friend?",
        ],
    },
    "translation-lab": {
        "tagline_en": "Translates EN <-> FR with context and nuance.",
        "description_en": (
            "Translation Lab works in both directions. It detects the "
            "source language, offers a couple of alternatives when useful, "
            "and explains the tough translation choices."
        ),
        "best_for_en": [
            "EN -> FR",
            "FR -> EN",
            "Idioms",
            "Register",
        ],
        "capabilities_en": [
            "Translation EN <-> FR",
            "Alternatives",
            "Notes on choices",
            "Auto language detection",
        ],
        "suggested_questions_en": [
            "Translate: 'Je voudrais reserver une table pour deux.'",
            "Translate: 'It's a piece of cake.'",
            "How do I say 'I'm looking forward to it' in French?",
            "Translate this sentence from my resume...",
        ],
    },
    "idiom-hunter": {
        "tagline_en": "Cracks open an English idiom: meaning, register, examples.",
        "description_en": (
            "Idiom Hunter walks you through English idioms: literal meaning, "
            "real meaning, register, and a natural example in context. "
            "Useful so you don't get tripped up by 'spill the beans' or "
            "'under the weather'."
        ),
        "best_for_en": [
            "Idioms",
            "Slang",
            "Register",
            "Word history",
        ],
        "capabilities_en": [
            "Literal vs. real meaning",
            "Register",
            "Example in context",
            "Origin",
        ],
        "suggested_questions_en": [
            "What does 'under the weather' mean?",
            "'Break a leg', where does it come from?",
            "Some idioms with 'time'?",
            "Difference between 'piece of cake' and 'walk in the park'?",
        ],
    },
    "culture-guide": {
        "tagline_en": "Cultural notes on the English-speaking world: habits, holidays, history.",
        "description_en": (
            "Culture Guide gives you the cultural cues that aren't in the "
            "textbooks: why Americans tip 20%, what Thanksgiving is really "
            "about, how to small-talk with a Brit, what to bring to a "
            "dinner party. Useful for learners preparing a trip or an oral exam."
        ),
        "best_for_en": [
            "Etiquette",
            "Holidays",
            "Daily life",
            "Regional differences",
        ],
        "capabilities_en": [
            "Cultural context",
            "Anecdotes",
            "Key vocabulary",
            "US vs. UK comparisons",
        ],
        "suggested_questions_en": [
            "How does a US dinner party work?",
            "What happens on Thanksgiving?",
            "How does healthcare work in the UK?",
            "What's the difference between New York and London?",
        ],
    },
    "pronunciation-buddy": {
        "tagline_en": "IPA + practical tips for nailing English pronunciation.",
        "description_en": (
            "Pronunciation Buddy helps you say a word or phrase correctly: "
            "IPA transcription, stress pattern, advice on the 'th' sound, "
            "weak vowels, silent letters, and linking between words."
        ),
        "best_for_en": [
            "IPA",
            "Word stress",
            "'th' sound",
            "Silent letters",
        ],
        "capabilities_en": [
            "IPA",
            "Syllable breakdown",
            "Stress placement",
            "Linking and weak forms",
        ],
        "suggested_questions_en": [
            "How do I pronounce 'thorough'?",
            "'Schedule': British or American?",
            "How do I stress 'photograph' vs. 'photographer'?",
            "How do you say 'colonel'?",
        ],
    },
    "exam-coach": {
        "tagline_en": "TOEFL / IELTS / Cambridge coach: strategy, drills, simulations.",
        "description_en": (
            "Exam Coach walks you through TOEFL, IELTS, and Cambridge "
            "(First / Advanced) prep. It explains each section's format, "
            "drills a specific question type, gives strategies for each "
            "paper (Reading, Listening, Writing, Speaking), and scores "
            "your practice writing against the official rubrics."
        ),
        "best_for_en": [
            "TOEFL",
            "IELTS",
            "Cambridge",
            "Strategies",
        ],
        "capabilities_en": [
            "Format of each section",
            "Drill on a question type",
            "Scoring against the official rubric",
            "Study plan over 4 / 6 / 12 weeks",
        ],
        "suggested_questions_en": [
            "What's the structure of the TOEFL? How many questions per section?",
            "How does the IELTS Speaking section work?",
            "Give me 5 Cambridge Advanced Reading-style questions.",
            "Score my essay against the IELTS Writing rubric.",
            "Build me a 6-week plan to go from B1 to B2.",
            "Difference between TOEFL and IELTS?",
        ],
    },
}

AGENT_EN_PROMPTS = {
    "grammar-coach": (
        "You are a patient grammar coach for English learners. When the "
        "learner asks about a grammar point, explain it in clear, simple "
        "language. Always give 2-3 example sentences and note one common "
        "mistake learners make. When they share a sentence, identify any "
        "grammar issues kindly and explain the correction."
    ),
    "writing-editor": (
        "You are an English writing editor. When the learner submits a "
        "paragraph, give them: (1) one specific thing they did well, "
        "(2) two concrete suggestions for improvement (clarity, word "
        "choice, structure), and (3) a revised version of their paragraph "
        "in clearer English. Be encouraging and constructive."
    ),
    "verb-studio": (
        "You are an English verb coach. English verbs are largely "
        "irregular in their past forms and have important aspects "
        "(simple, continuous, perfect). When the learner asks about a "
        "verb, give its three principal forms (base, past, past "
        "participle) and an example in each major tense (present, past, "
        "present perfect, future). Highlight any irregularity."
    ),
    "vocab-explorer": (
        "You are an English vocabulary coach. When the learner asks "
        "about a word, give the definition, part of speech, two example "
        "sentences, and one common collocation. If they ask for a 'word "
        "of the day', pick something at their CEFR level. For phrasal "
        "verbs, always show the literal meaning and the idiomatic one."
    ),
    "translation-lab": (
        "You are a translation coach for English learners. When the "
        "learner gives you a sentence in their native language (or in "
        "French), translate it to natural English and explain ONE "
        "tricky choice in the translation: an idiomatic phrasing, a "
        "tense decision, or a word that doesn't have a direct equivalent."
    ),
    "idiom-hunter": (
        "You are a guide to English idioms and expressions. When the "
        "learner asks about an idiom or phrase, give them the literal "
        "meaning, the figurative meaning, the origin if interesting, "
        "and 2 example sentences in context. For requests like 'teach me "
        "an idiom', pick one at their level and present it the same way."
    ),
    "culture-guide": (
        "You are a guide to English-speaking culture (UK, US, Canada, "
        "Australia, etc.). When the learner asks about customs, "
        "holidays, food, music, history, or social etiquette, give them "
        "a concise answer with one fun fact. Be playful and curious. "
        "Note regional differences when they matter."
    ),
    "pronunciation-buddy": (
        "You are a pronunciation buddy for English learners. When the "
        "learner asks about a word's pronunciation, give the IPA "
        "transcription, a rhyme or comparison to a familiar word, and "
        "a tip about which syllable carries the stress. Mention common "
        "pitfalls (silent letters, weak vowels, the 'th' sound, etc.)."
    ),
    "exam-coach": (
        "You are an English exam-prep coach (TOEFL, IELTS, Cambridge "
        "First/Advanced). Help the learner with exam strategies, sample "
        "questions, and time-management tips. Tailor advice to whichever "
        "exam they mention. Be specific: cite section names, scoring "
        "criteria, and common pitfalls for that exam."
    ),
}


def _is_empty(value):
    if value is None:
        return True
    if isinstance(value, (list, tuple, dict, str)):
        return len(value) == 0
    return False


class Command(BaseCommand):
    help = "Backfill EN metadata + system_prompt_en on existing agents."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite existing _en values instead of skipping them.",
        )

    def handle(self, *args, **options):
        force = options["force"]
        total_filled = 0
        total_skipped = 0
        unknown = 0

        for agent in Agent.objects.all().order_by("order", "slug"):
            metadata = AGENT_EN_METADATA.get(agent.slug)
            prompt = AGENT_EN_PROMPTS.get(agent.slug)

            if metadata is None and prompt is None:
                unknown += 1
                self.stdout.write(
                    self.style.WARNING(f"  ? no EN data defined for agent slug={agent.slug}")
                )
                continue

            updates = []
            skipped_fields = []

            if prompt is not None:
                if force or _is_empty(agent.system_prompt_en):
                    agent.system_prompt_en = prompt
                    updates.append("system_prompt_en")
                else:
                    skipped_fields.append("system_prompt_en")

            if metadata is not None:
                for field, value in metadata.items():
                    if force or _is_empty(getattr(agent, field)):
                        setattr(agent, field, value)
                        updates.append(field)
                    else:
                        skipped_fields.append(field)

            if updates:
                agent.save(update_fields=updates)
                total_filled += len(updates)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  + {agent.slug}: wrote {len(updates)} field(s)"
                        + (f", skipped {len(skipped_fields)}" if skipped_fields else "")
                    )
                )
            else:
                total_skipped += len(skipped_fields)
                self.stdout.write(f"  ~ {agent.slug}: all {len(skipped_fields)} EN fields already set")

        self.stdout.write(
            self.style.SUCCESS(
                f"\nEN agent metadata: +{total_filled} field(s) filled, "
                f"{total_skipped} already set, {unknown} unknown slug (skipped)."
            )
        )
