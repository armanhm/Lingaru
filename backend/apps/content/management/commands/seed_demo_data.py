"""Seed the database with comprehensive French learning demo data.

Adds 6 new topics (3-8) with lessons, vocabulary, grammar rules, reading
texts, questions, and 12 discover cards.  Idempotent: skips any topic
whose name_fr already exists.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.content.models import (
    GrammarRule,
    Lesson,
    Question,
    ReadingText,
    Topic,
    Vocabulary,
)
from apps.discover.models import DiscoverCard


class Command(BaseCommand):
    help = "Seed the database with rich demo content (6 topics + discover cards)"

    # ------------------------------------------------------------------ #
    #  helpers
    # ------------------------------------------------------------------ #

    def _topic_exists(self, name_fr: str) -> bool:
        return Topic.objects.filter(name_fr=name_fr).exists()

    def _bulk_vocab(self, lesson, rows):
        """rows: list of (french, english, pronunciation, example, gender, pos)"""
        for fr, en, pron, ex, gender, pos in rows:
            Vocabulary.objects.create(
                lesson=lesson,
                french=fr,
                english=en,
                pronunciation=pron,
                example_sentence=ex,
                gender=gender,
                part_of_speech=pos,
            )

    def _bulk_questions(self, lesson, rows):
        """rows: list of (type, prompt, correct, wrong_list, explanation, diff)"""
        for qtype, prompt, correct, wrong, expl, diff in rows:
            Question.objects.create(
                lesson=lesson,
                type=qtype,
                prompt=prompt,
                correct_answer=correct,
                wrong_answers=wrong,
                explanation=expl,
                difficulty=diff,
            )

    # ------------------------------------------------------------------ #
    #  TOPIC 3 — Les voyages
    # ------------------------------------------------------------------ #

    def _seed_topic_3(self):
        name_fr = "Les voyages"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)")
            return

        t = Topic.objects.create(
            name_fr=name_fr,
            name_en="Travel",
            description="Vocabulary and grammar for travelling in French-speaking countries.",
            icon="✈️",
            order=3,
            difficulty_level=2,
        )

        # -- Vocab lesson ------------------------------------------------
        l_vocab = Lesson.objects.create(
            topic=t,
            type="vocab",
            title="Airport, Hotel & Directions",
            content={"intro": "Essential words for getting around while travelling."},
            order=1,
            difficulty=2,
        )

        self._bulk_vocab(
            l_vocab,
            [
                (
                    "l'aéroport",
                    "airport",
                    "la.e.ʁɔ.pɔʁ",
                    "Nous arrivons à l'aéroport à midi.",
                    "m",
                    "noun",
                ),
                ("l'avion", "airplane", "la.vjɔ̃", "L'avion décolle dans une heure.", "m", "noun"),
                (
                    "le billet",
                    "ticket",
                    "lə bi.jɛ",
                    "J'ai acheté un billet aller-retour.",
                    "m",
                    "noun",
                ),
                ("la valise", "suitcase", "la va.liz", "Ma valise est trop lourde.", "f", "noun"),
                (
                    "le passeport",
                    "passport",
                    "lə pas.pɔʁ",
                    "N'oubliez pas votre passeport.",
                    "m",
                    "noun",
                ),
                (
                    "l'hôtel",
                    "hotel",
                    "lo.tɛl",
                    "Nous avons réservé un hôtel au centre-ville.",
                    "m",
                    "noun",
                ),
                ("la chambre", "room", "la ʃɑ̃bʁ", "La chambre donne sur la mer.", "f", "noun"),
                (
                    "la gare",
                    "train station",
                    "la ɡaʁ",
                    "Le train part de la gare de Lyon.",
                    "f",
                    "noun",
                ),
                ("le plan", "map / plan", "lə plɑ̃", "Avez-vous un plan de la ville ?", "m", "noun"),
                (
                    "tout droit",
                    "straight ahead",
                    "tu dʁwa",
                    "Allez tout droit pendant deux cents mètres.",
                    "a",
                    "adverb",
                ),
                (
                    "à gauche",
                    "to the left",
                    "a ɡoʃ",
                    "Tournez à gauche au feu rouge.",
                    "a",
                    "adverb",
                ),
                (
                    "à droite",
                    "to the right",
                    "a dʁwat",
                    "La pharmacie est à droite.",
                    "a",
                    "adverb",
                ),
            ],
        )

        # -- Grammar lesson -----------------------------------------------
        l_gram = Lesson.objects.create(
            topic=t,
            type="grammar",
            title="Le futur simple",
            content={"intro": "How to talk about future plans and events."},
            order=2,
            difficulty=2,
        )

        GrammarRule.objects.create(
            lesson=l_gram,
            title="Le futur simple — formation",
            explanation=(
                "The futur simple is formed by adding endings to the infinitive "
                "(for -re verbs, drop the final -e first).\n\n"
                "| Pronoun | Ending |\n"
                "|---------|--------|\n"
                "| je | -ai |\n"
                "| tu | -as |\n"
                "| il/elle/on | -a |\n"
                "| nous | -ons |\n"
                "| vous | -ez |\n"
                "| ils/elles | -ont |\n\n"
                "Example with **parler**: je parlerai, tu parleras, il parlera, "
                "nous parlerons, vous parlerez, ils parleront."
            ),
            formula="infinitive + -ai / -as / -a / -ons / -ez / -ont",
            examples=[
                "Je voyagerai en France cet été. (I will travel to France this summer.)",
                "Nous prendrons le train de huit heures. (We will take the 8 o'clock train.)",
                "Ils arriveront demain matin. (They will arrive tomorrow morning.)",
                "Tu visiteras le Louvre ? (Will you visit the Louvre?)",
            ],
            exceptions=[
                "être → je serai",
                "avoir → j'aurai",
                "aller → j'irai",
                "faire → je ferai",
                "venir → je viendrai",
                "pouvoir → je pourrai",
                "voir → je verrai",
            ],
        )

        # -- Reading text -------------------------------------------------
        l_text = Lesson.objects.create(
            topic=t,
            type="text",
            title="Un voyage à Lyon",
            content={"intro": "Read about a trip to Lyon and test your comprehension."},
            order=3,
            difficulty=2,
        )

        ReadingText.objects.create(
            lesson=l_text,
            title="Un voyage à Lyon",
            content_fr=(
                "L'été dernier, Sophie et Marc ont décidé de visiter Lyon. "
                "Ils ont pris le TGV depuis Paris et le trajet a duré seulement deux heures. "
                "À leur arrivée, ils ont déposé leurs valises à l'hôtel et sont partis "
                "explorer le Vieux Lyon à pied.\n\n"
                "Le quartier est magnifique, avec ses ruelles étroites et ses traboules, "
                "ces passages secrets qui traversent les immeubles. Ils ont déjeuné dans "
                "un bouchon lyonnais où ils ont goûté les quenelles et la salade lyonnaise.\n\n"
                "Le lendemain, ils ont visité le musée des Confluences et se sont promenés "
                "le long des berges du Rhône. Sophie a acheté des pralines roses, une "
                "spécialité locale. Avant de repartir, Marc a dit : « Lyon est une ville "
                "incroyable. Nous reviendrons, c'est sûr ! »"
            ),
            content_en=(
                "Last summer, Sophie and Marc decided to visit Lyon. "
                "They took the TGV from Paris and the trip lasted only two hours. "
                "Upon arrival, they dropped their suitcases at the hotel and went off "
                "to explore Old Lyon on foot.\n\n"
                "The neighborhood is magnificent, with its narrow alleys and traboules — "
                "secret passages that run through the buildings. They had lunch in "
                "a traditional Lyonnais bouchon where they tasted quenelles and "
                "salade lyonnaise.\n\n"
                "The next day, they visited the Confluences museum and walked "
                "along the banks of the Rhône. Sophie bought pralines roses, a "
                "local specialty. Before leaving, Marc said: 'Lyon is an incredible "
                "city. We'll come back for sure!'"
            ),
            vocabulary_highlights=[
                "TGV",
                "traboules",
                "bouchon lyonnais",
                "quenelles",
                "pralines roses",
                "berges",
                "ruelles",
            ],
            comprehension_questions=[
                {
                    "question": "How did Sophie and Marc travel to Lyon?",
                    "answer": "By TGV (high-speed train) from Paris",
                },
                {
                    "question": "What are traboules?",
                    "answer": "Secret passages that run through buildings in Vieux Lyon",
                },
                {
                    "question": "What did they eat at the bouchon?",
                    "answer": "Quenelles and salade lyonnaise",
                },
                {"question": "What local specialty did Sophie buy?", "answer": "Pralines roses"},
            ],
        )

        # -- Questions (spread across lessons) ----------------------------
        self._bulk_questions(
            l_vocab,
            [
                (
                    "mcq",
                    "What does 'l'aéroport' mean?",
                    "airport",
                    ["airplane", "ticket", "train station"],
                    "'L'aéroport' is masculine — the airport.",
                    1,
                ),
                (
                    "mcq",
                    "What does 'la valise' mean?",
                    "suitcase",
                    ["passport", "ticket", "map"],
                    "'La valise' is feminine — the suitcase.",
                    1,
                ),
                (
                    "fill_blank",
                    "Tournez _____ au feu rouge. (to the left)",
                    "à gauche",
                    ["à droite", "tout droit", "au sud"],
                    "'À gauche' means to the left.",
                    1,
                ),
                (
                    "translate",
                    "Translate: 'Don't forget your passport.'",
                    "N'oubliez pas votre passeport.",
                    [],
                    "Negation wraps the verb: n'oubliez pas.",
                    2,
                ),
            ],
        )

        self._bulk_questions(
            l_gram,
            [
                (
                    "fill_blank",
                    "Je _____ en France cet été. (voyager, futur simple)",
                    "voyagerai",
                    ["voyage", "voyagé", "voyageais"],
                    "Futur simple of voyager: voyager + ai = voyagerai.",
                    2,
                ),
                (
                    "conjugation",
                    "Conjugate 'avoir' in futur simple for 'nous':",
                    "aurons",
                    ["avons", "aurez", "auront"],
                    "Avoir is irregular in futur simple: nous aurons.",
                    2,
                ),
                (
                    "mcq",
                    "Which is the correct futur simple of 'être' for 'je'?",
                    "serai",
                    ["suis", "serais", "étais"],
                    "Être is irregular: je serai (not 'serais' which is conditional).",
                    2,
                ),
                (
                    "translate",
                    "Translate: 'They will arrive tomorrow morning.'",
                    "Ils arriveront demain matin.",
                    [],
                    "Futur simple of arriver + demain matin.",
                    2,
                ),
            ],
        )

        self.stdout.write(self.style.SUCCESS(f"  Created topic '{name_fr}'"))

    # ------------------------------------------------------------------ #
    #  TOPIC 4 — Le travail
    # ------------------------------------------------------------------ #

    def _seed_topic_4(self):
        name_fr = "Le travail"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)")
            return

        t = Topic.objects.create(
            name_fr=name_fr,
            name_en="Work & Career",
            description="Talk about your job, the office, and professional life.",
            icon="💼",
            order=4,
            difficulty_level=2,
        )

        # -- Vocab --------------------------------------------------------
        l_vocab = Lesson.objects.create(
            topic=t,
            type="vocab",
            title="Office & Job Vocabulary",
            content={"intro": "Words for the workplace and professional life."},
            order=1,
            difficulty=2,
        )

        self._bulk_vocab(
            l_vocab,
            [
                (
                    "le bureau",
                    "office / desk",
                    "lə by.ʁo",
                    "Je travaille dans un grand bureau.",
                    "m",
                    "noun",
                ),
                (
                    "l'entreprise",
                    "company",
                    "lɑ̃.tʁə.pʁiz",
                    "Elle dirige une petite entreprise.",
                    "f",
                    "noun",
                ),
                ("le patron", "boss", "lə pa.tʁɔ̃", "Le patron organise une réunion.", "m", "noun"),
                (
                    "la réunion",
                    "meeting",
                    "la ʁe.y.njɔ̃",
                    "La réunion commence à quatorze heures.",
                    "f",
                    "noun",
                ),
                (
                    "l'ordinateur",
                    "computer",
                    "lɔʁ.di.na.tœʁ",
                    "Mon ordinateur est lent aujourd'hui.",
                    "m",
                    "noun",
                ),
                (
                    "le salaire",
                    "salary",
                    "lə sa.lɛʁ",
                    "Il a reçu une augmentation de salaire.",
                    "m",
                    "noun",
                ),
                (
                    "un emploi",
                    "a job",
                    "ɛ̃.n‿ɑ̃.plwa",
                    "Elle cherche un emploi à Paris.",
                    "m",
                    "noun",
                ),
                (
                    "le collègue",
                    "colleague",
                    "lə kɔ.lɛɡ",
                    "Mon collègue est très sympathique.",
                    "m",
                    "noun",
                ),
                (
                    "travailler",
                    "to work",
                    "tʁa.va.je",
                    "Je travaille du lundi au vendredi.",
                    "a",
                    "verb",
                ),
                (
                    "embaucher",
                    "to hire",
                    "ɑ̃.bo.ʃe",
                    "L'entreprise va embaucher dix personnes.",
                    "a",
                    "verb",
                ),
                (
                    "démissionner",
                    "to resign",
                    "de.mi.sjɔ.ne",
                    "Il a démissionné la semaine dernière.",
                    "a",
                    "verb",
                ),
            ],
        )

        # -- Grammar ------------------------------------------------------
        l_gram = Lesson.objects.create(
            topic=t,
            type="grammar",
            title="Passé composé — avoir vs être",
            content={"intro": "Master the most important French past tense."},
            order=2,
            difficulty=2,
        )

        GrammarRule.objects.create(
            lesson=l_gram,
            title="Passé composé with avoir",
            explanation=(
                "Most French verbs form the passé composé with **avoir** + past participle.\n\n"
                "| Pronoun | Example (parler) |\n"
                "|---------|------------------|\n"
                "| j' | ai parlé |\n"
                "| tu | as parlé |\n"
                "| il/elle | a parlé |\n"
                "| nous | avons parlé |\n"
                "| vous | avez parlé |\n"
                "| ils/elles | ont parlé |\n\n"
                "The past participle does **not** agree with the subject when using avoir "
                "(unless a direct object precedes the verb)."
            ),
            formula="subject + avoir (present) + past participle",
            examples=[
                "J'ai travaillé toute la journée. (I worked all day.)",
                "Elle a fini le rapport. (She finished the report.)",
                "Nous avons mangé au restaurant. (We ate at the restaurant.)",
            ],
            exceptions=[
                "Agreement with preceding direct object: Les lettres que j'ai écrites. (The letters that I wrote.)",
            ],
        )

        GrammarRule.objects.create(
            lesson=l_gram,
            title="Passé composé with être",
            explanation=(
                "A small group of verbs (mostly verbs of motion and state change) "
                "use **être** as the auxiliary. The past participle must agree in "
                "gender and number with the subject.\n\n"
                "The classic mnemonic is **DR & MRS VANDERTRAMP**:\n"
                "Devenir, Revenir, Monter, Rester, Sortir, Venir, Aller, Naître, "
                "Descendre, Entrer, Retourner, Tomber, Rentrer, Arriver, Mourir, Partir.\n\n"
                "All **reflexive** (pronominal) verbs also use être."
            ),
            formula="subject + être (present) + past participle (agrees with subject)",
            examples=[
                "Elle est allée au bureau. (She went to the office.)",
                "Ils sont partis à huit heures. (They left at eight.)",
                "Nous nous sommes levés tôt. (We got up early.)",
            ],
            exceptions=[
                "Monter, descendre, sortir, rentrer, passer, retourner use avoir when they have a direct object: J'ai monté les valises. (I carried the suitcases up.)",
            ],
        )

        # -- Reading text -------------------------------------------------
        l_text = Lesson.objects.create(
            topic=t,
            type="text",
            title="Mon premier jour au bureau",
            content={"intro": "Read about someone's first day at work."},
            order=3,
            difficulty=2,
        )

        ReadingText.objects.create(
            lesson=l_text,
            title="Mon premier jour au bureau",
            content_fr=(
                "Ce matin, j'ai commencé mon nouveau travail dans une agence de "
                "communication à Bordeaux. Je me suis levé très tôt parce que je ne "
                "voulais pas arriver en retard.\n\n"
                "Quand je suis arrivé au bureau, ma responsable, Claire, m'a accueilli "
                "avec un grand sourire. Elle m'a présenté à toute l'équipe : les graphistes, "
                "les rédacteurs et le directeur commercial. Tout le monde était très "
                "sympathique.\n\n"
                "Claire m'a montré mon bureau et mon ordinateur. Ensuite, nous avons "
                "assisté à une réunion sur un nouveau projet pour un client important. "
                "J'ai pris beaucoup de notes. À midi, mes collègues m'ont invité à "
                "déjeuner dans un petit restaurant près du bureau.\n\n"
                "Le soir, j'étais fatigué mais content. J'ai appelé ma mère pour lui "
                "raconter ma journée. Elle était très fière de moi."
            ),
            content_en=(
                "This morning, I started my new job at a communications agency "
                "in Bordeaux. I got up very early because I didn't want to arrive late.\n\n"
                "When I arrived at the office, my manager, Claire, welcomed me "
                "with a big smile. She introduced me to the whole team: the graphic "
                "designers, the writers, and the sales director. Everyone was very "
                "friendly.\n\n"
                "Claire showed me my desk and my computer. Then we attended a meeting "
                "about a new project for an important client. I took a lot of notes. "
                "At noon, my colleagues invited me to have lunch at a small restaurant "
                "near the office.\n\n"
                "In the evening, I was tired but happy. I called my mother to tell "
                "her about my day. She was very proud of me."
            ),
            vocabulary_highlights=[
                "agence de communication",
                "responsable",
                "graphistes",
                "rédacteurs",
                "directeur commercial",
                "réunion",
                "collègues",
            ],
            comprehension_questions=[
                {
                    "question": "Where is the new job located?",
                    "answer": "At a communications agency in Bordeaux",
                },
                {
                    "question": "Who welcomed the narrator?",
                    "answer": "Claire, the manager (responsable)",
                },
                {
                    "question": "What happened at the meeting?",
                    "answer": "They discussed a new project for an important client",
                },
                {
                    "question": "What did the narrator do at lunchtime?",
                    "answer": "Went to a small restaurant near the office with colleagues",
                },
            ],
        )

        # -- Questions ----------------------------------------------------
        self._bulk_questions(
            l_vocab,
            [
                (
                    "mcq",
                    "What does 'le bureau' mean?",
                    "office / desk",
                    ["boss", "meeting", "salary"],
                    "'Le bureau' can mean both 'office' and 'desk'.",
                    1,
                ),
                (
                    "mcq",
                    "What does 'embaucher' mean?",
                    "to hire",
                    ["to fire", "to resign", "to work"],
                    "'Embaucher' means to hire. The opposite is 'licencier' (to fire).",
                    1,
                ),
                (
                    "fill_blank",
                    "La _____ commence à quatorze heures. (meeting)",
                    "réunion",
                    ["bureau", "entreprise", "salaire"],
                    "'La réunion' means the meeting.",
                    1,
                ),
                (
                    "translate",
                    "Translate: 'She is looking for a job in Paris.'",
                    "Elle cherche un emploi à Paris.",
                    [],
                    "'Chercher' means to look for (no preposition needed in French).",
                    2,
                ),
            ],
        )

        self._bulk_questions(
            l_gram,
            [
                (
                    "fill_blank",
                    "Elle _____ allée au bureau. (être, passé composé)",
                    "est",
                    ["a", "avait", "était"],
                    "'Aller' uses être in the passé composé: elle est allée.",
                    2,
                ),
                (
                    "mcq",
                    "Which verb uses 'être' in the passé composé?",
                    "partir",
                    ["manger", "travailler", "finir"],
                    "'Partir' is a verb of motion and uses être.",
                    2,
                ),
                (
                    "conjugation",
                    "Passé composé of 'finir' for 'nous':",
                    "avons fini",
                    ["sommes finis", "avons finir", "ont fini"],
                    "'Finir' uses avoir: nous avons fini.",
                    2,
                ),
                (
                    "fill_blank",
                    "Ils _____ partis à huit heures. (être, passé composé)",
                    "sont",
                    ["ont", "étaient", "avaient"],
                    "'Partir' uses être: ils sont partis.",
                    2,
                ),
            ],
        )

        self.stdout.write(self.style.SUCCESS(f"  Created topic '{name_fr}'"))

    # ------------------------------------------------------------------ #
    #  TOPIC 5 — La santé
    # ------------------------------------------------------------------ #

    def _seed_topic_5(self):
        name_fr = "La santé"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)")
            return

        t = Topic.objects.create(
            name_fr=name_fr,
            name_en="Health",
            description="Body parts, symptoms, and visiting the doctor.",
            icon="❤️",
            order=5,
            difficulty_level=2,
        )

        # -- Vocab --------------------------------------------------------
        l_vocab = Lesson.objects.create(
            topic=t,
            type="vocab",
            title="Body, Symptoms & Doctor Visits",
            content={"intro": "Essential health vocabulary for everyday situations."},
            order=1,
            difficulty=2,
        )

        self._bulk_vocab(
            l_vocab,
            [
                ("la tête", "head", "la tɛt", "J'ai mal à la tête.", "f", "noun"),
                ("le bras", "arm", "lə bʁɑ", "Il s'est cassé le bras.", "m", "noun"),
                ("la jambe", "leg", "la ʒɑ̃b", "Elle a une douleur à la jambe.", "f", "noun"),
                ("le ventre", "stomach / belly", "lə vɑ̃tʁ", "J'ai mal au ventre.", "m", "noun"),
                ("le dos", "back", "lə do", "Mon dos me fait souffrir.", "m", "noun"),
                ("la fièvre", "fever", "la fjɛvʁ", "Le patient a de la fièvre.", "f", "noun"),
                ("la toux", "cough", "la tu", "Cette toux dure depuis une semaine.", "f", "noun"),
                ("le rhume", "cold", "lə ʁym", "J'ai attrapé un rhume.", "m", "noun"),
                (
                    "le médecin",
                    "doctor",
                    "lə med.sɛ̃",
                    "Je dois aller chez le médecin.",
                    "m",
                    "noun",
                ),
                (
                    "l'ordonnance",
                    "prescription",
                    "lɔʁ.dɔ.nɑ̃s",
                    "Le médecin m'a donné une ordonnance.",
                    "f",
                    "noun",
                ),
                (
                    "la pharmacie",
                    "pharmacy",
                    "la faʁ.ma.si",
                    "La pharmacie est ouverte le dimanche.",
                    "f",
                    "noun",
                ),
                (
                    "le médicament",
                    "medicine / medication",
                    "lə me.di.ka.mɑ̃",
                    "Prenez ce médicament trois fois par jour.",
                    "m",
                    "noun",
                ),
            ],
        )

        # -- Grammar ------------------------------------------------------
        l_gram = Lesson.objects.create(
            topic=t,
            type="grammar",
            title="L'impératif",
            content={"intro": "Giving commands, instructions, and advice."},
            order=2,
            difficulty=2,
        )

        GrammarRule.objects.create(
            lesson=l_gram,
            title="L'impératif — formation et usage",
            explanation=(
                "The imperative is used for commands, requests, and advice. "
                "It exists in three forms: **tu**, **nous**, **vous**.\n\n"
                "For most verbs, take the present tense and drop the subject pronoun. "
                "For **-er** verbs and **aller**, drop the final **-s** from the tu form.\n\n"
                "| Verb | tu | nous | vous |\n"
                "|------|----|------|------|\n"
                "| parler | parle | parlons | parlez |\n"
                "| finir | finis | finissons | finissez |\n"
                "| prendre | prends | prenons | prenez |\n"
                "| être | sois | soyons | soyez |\n"
                "| avoir | aie | ayons | ayez |"
            ),
            formula="present tense minus subject pronoun (-er: drop final -s for tu)",
            examples=[
                "Prenez ce médicament deux fois par jour. (Take this medicine twice a day.)",
                "Repose-toi bien. (Rest well. — informal)",
                "Mangeons des légumes ! (Let's eat vegetables!)",
                "Soyez patient. (Be patient. — formal)",
            ],
            exceptions=[
                "être → sois, soyons, soyez (irregular)",
                "avoir → aie, ayons, ayez (irregular)",
                "savoir → sache, sachons, sachez (irregular)",
                "Negative imperative: Ne mange pas ça ! (Don't eat that!)",
            ],
        )

        # -- Reading text -------------------------------------------------
        l_text = Lesson.objects.create(
            topic=t,
            type="text",
            title="Chez le médecin",
            content={"intro": "A dialogue at the doctor's office."},
            order=3,
            difficulty=2,
        )

        ReadingText.objects.create(
            lesson=l_text,
            title="Chez le médecin",
            content_fr=(
                "Patient : Bonjour, docteur. Je ne me sens pas bien depuis trois jours.\n\n"
                "Médecin : Bonjour. Quels sont vos symptômes ?\n\n"
                "Patient : J'ai mal à la gorge, je tousse beaucoup et j'ai un peu de fièvre. "
                "Ce matin, j'avais trente-huit degrés.\n\n"
                "Médecin : Je vais vous examiner. Ouvrez la bouche, s'il vous plaît. "
                "Votre gorge est rouge et enflée. Respirez profondément... "
                "Vos poumons sont clairs, c'est bien.\n\n"
                "Patient : Est-ce que c'est grave ?\n\n"
                "Médecin : Non, c'est une angine virale. Reposez-vous pendant quelques jours, "
                "buvez beaucoup d'eau et prenez du paracétamol pour la fièvre. "
                "Je vais vous faire une ordonnance pour un sirop contre la toux.\n\n"
                "Patient : Merci, docteur. Combien de temps ça va durer ?\n\n"
                "Médecin : En général, cinq à sept jours. Si les symptômes ne s'améliorent "
                "pas dans une semaine, revenez me voir."
            ),
            content_en=(
                "Patient: Hello, doctor. I haven't been feeling well for three days.\n\n"
                "Doctor: Hello. What are your symptoms?\n\n"
                "Patient: I have a sore throat, I'm coughing a lot, and I have a slight fever. "
                "This morning, I was at thirty-eight degrees.\n\n"
                "Doctor: I'll examine you. Open your mouth, please. "
                "Your throat is red and swollen. Breathe deeply... "
                "Your lungs are clear, that's good.\n\n"
                "Patient: Is it serious?\n\n"
                "Doctor: No, it's a viral throat infection. Rest for a few days, "
                "drink plenty of water, and take paracetamol for the fever. "
                "I'll write you a prescription for cough syrup.\n\n"
                "Patient: Thank you, doctor. How long will it last?\n\n"
                "Doctor: Usually, five to seven days. If the symptoms don't improve "
                "within a week, come back and see me."
            ),
            vocabulary_highlights=[
                "symptômes",
                "gorge",
                "fièvre",
                "examiner",
                "angine virale",
                "ordonnance",
                "sirop",
                "paracétamol",
            ],
            comprehension_questions=[
                {"question": "How long has the patient been sick?", "answer": "Three days"},
                {"question": "What temperature did the patient have?", "answer": "38 degrees"},
                {
                    "question": "What is the diagnosis?",
                    "answer": "A viral throat infection (angine virale)",
                },
                {
                    "question": "What does the doctor prescribe?",
                    "answer": "Paracetamol for fever and cough syrup",
                },
            ],
        )

        # -- Questions ----------------------------------------------------
        self._bulk_questions(
            l_vocab,
            [
                (
                    "mcq",
                    "What does 'la fièvre' mean?",
                    "fever",
                    ["cough", "cold", "headache"],
                    "'La fièvre' means fever.",
                    1,
                ),
                (
                    "fill_blank",
                    "J'ai mal à la _____. (head)",
                    "tête",
                    ["bras", "jambe", "dos"],
                    "'J'ai mal à la tête' means 'I have a headache'.",
                    1,
                ),
                (
                    "translate",
                    "Translate: 'I caught a cold.'",
                    "J'ai attrapé un rhume.",
                    [],
                    "'Attraper un rhume' is the French expression for catching a cold.",
                    2,
                ),
                (
                    "mcq",
                    "What is 'l'ordonnance'?",
                    "prescription",
                    ["pharmacy", "medicine", "appointment"],
                    "'L'ordonnance' is a prescription from the doctor.",
                    1,
                ),
            ],
        )

        self._bulk_questions(
            l_gram,
            [
                (
                    "fill_blank",
                    "_____ ce médicament deux fois par jour. (prendre, impératif vous)",
                    "Prenez",
                    ["Prends", "Prenons", "Prend"],
                    "Imperative vous form of prendre: prenez.",
                    2,
                ),
                (
                    "mcq",
                    "What is the tu imperative of 'parler'?",
                    "parle",
                    ["parles", "parlons", "parlez"],
                    "For -er verbs, drop the -s: parle (not parles).",
                    2,
                ),
                (
                    "conjugation",
                    "Give the imperative (vous) of 'être':",
                    "soyez",
                    ["êtes", "serez", "étiez"],
                    "Être is irregular in the imperative: soyez.",
                    2,
                ),
                (
                    "translate",
                    "Translate: 'Rest well!' (informal)",
                    "Repose-toi bien !",
                    [],
                    "Reflexive imperative: verb + hyphen + toi.",
                    2,
                ),
            ],
        )

        self.stdout.write(self.style.SUCCESS(f"  Created topic '{name_fr}'"))

    # ------------------------------------------------------------------ #
    #  TOPIC 6 — Les loisirs
    # ------------------------------------------------------------------ #

    def _seed_topic_6(self):
        name_fr = "Les loisirs"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)")
            return

        t = Topic.objects.create(
            name_fr=name_fr,
            name_en="Hobbies & Leisure",
            description="Sports, music, arts, and how to talk about your free time.",
            icon="🎨",
            order=6,
            difficulty_level=1,
        )

        # -- Vocab --------------------------------------------------------
        l_vocab = Lesson.objects.create(
            topic=t,
            type="vocab",
            title="Sports, Music & Arts",
            content={"intro": "Talk about your hobbies and leisure activities."},
            order=1,
            difficulty=1,
        )

        self._bulk_vocab(
            l_vocab,
            [
                (
                    "le football",
                    "soccer / football",
                    "lə fut.bol",
                    "Je joue au football le samedi.",
                    "m",
                    "noun",
                ),
                (
                    "la natation",
                    "swimming",
                    "la na.ta.sjɔ̃",
                    "La natation est bonne pour le dos.",
                    "f",
                    "noun",
                ),
                (
                    "le vélo",
                    "cycling / bicycle",
                    "lə ve.lo",
                    "Je fais du vélo tous les matins.",
                    "m",
                    "noun",
                ),
                (
                    "la lecture",
                    "reading",
                    "la lɛk.tyʁ",
                    "La lecture est mon passe-temps préféré.",
                    "f",
                    "noun",
                ),
                (
                    "la musique",
                    "music",
                    "la my.zik",
                    "J'écoute de la musique en travaillant.",
                    "f",
                    "noun",
                ),
                (
                    "la peinture",
                    "painting",
                    "la pɛ̃.tyʁ",
                    "Elle fait de la peinture le dimanche.",
                    "f",
                    "noun",
                ),
                (
                    "le cinéma",
                    "cinema / movies",
                    "lə si.ne.ma",
                    "On va au cinéma ce soir ?",
                    "m",
                    "noun",
                ),
                ("la danse", "dance", "la dɑ̃s", "Elle prend des cours de danse.", "f", "noun"),
                (
                    "la randonnée",
                    "hiking",
                    "la ʁɑ̃.dɔ.ne",
                    "Nous faisons de la randonnée en montagne.",
                    "f",
                    "noun",
                ),
                (
                    "le jardinage",
                    "gardening",
                    "lə ʒaʁ.di.naʒ",
                    "Mon père adore le jardinage.",
                    "m",
                    "noun",
                ),
                ("jouer", "to play", "ʒu.e", "Les enfants jouent dans le parc.", "a", "verb"),
            ],
        )

        # -- Grammar ------------------------------------------------------
        l_gram = Lesson.objects.create(
            topic=t,
            type="grammar",
            title="Comparatif et superlatif",
            content={"intro": "How to compare things and express extremes."},
            order=2,
            difficulty=1,
        )

        GrammarRule.objects.create(
            lesson=l_gram,
            title="Le comparatif",
            explanation=(
                "To compare two things in French:\n\n"
                "- **plus ... que** (more ... than)\n"
                "- **moins ... que** (less ... than)\n"
                "- **aussi ... que** (as ... as)\n\n"
                "The adjective agrees in gender and number with the noun it describes."
            ),
            formula="plus / moins / aussi + adjective + que",
            examples=[
                "Le football est plus populaire que le tennis. (Soccer is more popular than tennis.)",
                "La natation est moins dangereuse que le ski. (Swimming is less dangerous than skiing.)",
                "La danse est aussi amusante que la musique. (Dance is as fun as music.)",
            ],
            exceptions=[
                "bon → meilleur (not 'plus bon'): Ce film est meilleur que l'autre.",
                "bien → mieux (not 'plus bien'): Elle chante mieux que moi.",
                "mauvais → pire or plus mauvais (both accepted).",
            ],
        )

        GrammarRule.objects.create(
            lesson=l_gram,
            title="Le superlatif",
            explanation=(
                "To express the highest or lowest degree:\n\n"
                "- **le/la/les plus** + adjective (the most)\n"
                "- **le/la/les moins** + adjective (the least)\n\n"
                "The definite article agrees with the noun. When the adjective normally "
                "follows the noun, the superlative does too."
            ),
            formula="le/la/les + plus/moins + adjective (+ de + group)",
            examples=[
                "C'est le sport le plus populaire du monde. (It's the most popular sport in the world.)",
                "C'est la plus belle chanson de l'album. (It's the most beautiful song on the album.)",
                "C'est le film le moins intéressant de l'année. (It's the least interesting film of the year.)",
            ],
            exceptions=[
                "bon → le meilleur / la meilleure: C'est la meilleure équipe.",
                "mauvais → le pire / la pire: C'est le pire film.",
            ],
        )

        # -- Reading text -------------------------------------------------
        l_text = Lesson.objects.create(
            topic=t,
            type="text",
            title="Le weekend de Pierre",
            content={"intro": "Read about Pierre's weekend activities."},
            order=3,
            difficulty=1,
        )

        ReadingText.objects.create(
            lesson=l_text,
            title="Le weekend de Pierre",
            content_fr=(
                "Pierre adore les weekends parce qu'il peut enfin faire ce qu'il aime. "
                "Le samedi matin, il joue au football avec ses amis dans le parc. "
                "C'est le meilleur moment de sa semaine. Après le match, ils vont "
                "prendre un café ensemble.\n\n"
                "L'après-midi, Pierre fait du vélo le long de la rivière. Il trouve "
                "que le vélo est plus relaxant que la course à pied. Parfois, il "
                "s'arrête pour lire un livre sur un banc.\n\n"
                "Le dimanche est plus calme. Pierre joue de la guitare le matin — "
                "il prend des cours depuis deux ans et il joue de mieux en mieux. "
                "Ensuite, il va au cinéma avec sa copine. Ils préfèrent les comédies, "
                "mais ce weekend ils ont vu un film d'aventure qui était aussi "
                "amusant qu'un bon dessin animé.\n\n"
                "Le dimanche soir, Pierre prépare le dîner en écoutant de la musique. "
                "C'est la fin parfaite d'un weekend réussi."
            ),
            content_en=(
                "Pierre loves weekends because he can finally do what he likes. "
                "On Saturday mornings, he plays soccer with his friends in the park. "
                "It's the best moment of his week. After the match, they go "
                "for coffee together.\n\n"
                "In the afternoon, Pierre cycles along the river. He finds "
                "cycling more relaxing than running. Sometimes, he "
                "stops to read a book on a bench.\n\n"
                "Sunday is quieter. Pierre plays guitar in the morning — "
                "he's been taking lessons for two years and plays better and better. "
                "Then he goes to the cinema with his girlfriend. They prefer comedies, "
                "but this weekend they saw an adventure film that was as "
                "fun as a good cartoon.\n\n"
                "On Sunday evening, Pierre makes dinner while listening to music. "
                "It's the perfect end to a successful weekend."
            ),
            vocabulary_highlights=[
                "football",
                "vélo",
                "course à pied",
                "guitare",
                "cinéma",
                "comédies",
                "dessin animé",
            ],
            comprehension_questions=[
                {
                    "question": "What does Pierre do on Saturday mornings?",
                    "answer": "Plays soccer with friends in the park",
                },
                {
                    "question": "What does Pierre find more relaxing than running?",
                    "answer": "Cycling (le vélo)",
                },
                {
                    "question": "How long has Pierre been taking guitar lessons?",
                    "answer": "Two years",
                },
                {
                    "question": "What type of film did they see this weekend?",
                    "answer": "An adventure film",
                },
            ],
        )

        # -- Questions ----------------------------------------------------
        self._bulk_questions(
            l_vocab,
            [
                (
                    "mcq",
                    "What does 'la natation' mean?",
                    "swimming",
                    ["hiking", "dancing", "cycling"],
                    "'La natation' means swimming.",
                    1,
                ),
                (
                    "fill_blank",
                    "Je fais du _____ tous les matins. (cycling)",
                    "vélo",
                    ["football", "cinéma", "jardinage"],
                    "'Faire du vélo' means to go cycling.",
                    1,
                ),
                (
                    "translate",
                    "Translate: 'I play soccer on Saturdays.'",
                    "Je joue au football le samedi.",
                    [],
                    "'Jouer au' + sport. Note 'le samedi' means 'on Saturdays' (habitual).",
                    1,
                ),
            ],
        )

        self._bulk_questions(
            l_gram,
            [
                (
                    "fill_blank",
                    "Le football est _____ populaire que le tennis. (more)",
                    "plus",
                    ["moins", "aussi", "très"],
                    "Comparative of superiority: plus ... que.",
                    1,
                ),
                (
                    "mcq",
                    "What is the correct comparative of 'bon'?",
                    "meilleur",
                    ["plus bon", "plus bien", "mieux"],
                    "'Bon' becomes 'meilleur' (not 'plus bon'). 'Mieux' is for 'bien'.",
                    1,
                ),
                (
                    "fill_blank",
                    "C'est le sport le plus populaire _____ monde. (in the)",
                    "du",
                    ["de", "au", "dans le"],
                    "Superlative + de + group: du monde (de + le = du).",
                    2,
                ),
                (
                    "translate",
                    "Translate: 'She sings better than me.'",
                    "Elle chante mieux que moi.",
                    [],
                    "'Bien' → 'mieux' (not 'plus bien').",
                    2,
                ),
                (
                    "mcq",
                    "What does 'le moins intéressant' mean?",
                    "the least interesting",
                    ["the most interesting", "less interesting", "not interesting"],
                    "'Le moins + adjective' = the least + adjective.",
                    1,
                ),
            ],
        )

        self.stdout.write(self.style.SUCCESS(f"  Created topic '{name_fr}'"))

    # ------------------------------------------------------------------ #
    #  TOPIC 7 — La ville
    # ------------------------------------------------------------------ #

    def _seed_topic_7(self):
        name_fr = "La ville"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)")
            return

        t = Topic.objects.create(
            name_fr=name_fr,
            name_en="City & Directions",
            description="Navigate a French city: places, directions, and prepositions.",
            icon="📍",
            order=7,
            difficulty_level=2,
        )

        # -- Vocab --------------------------------------------------------
        l_vocab = Lesson.objects.create(
            topic=t,
            type="vocab",
            title="Places & Asking Directions",
            content={"intro": "Know the key places in a city and how to ask your way."},
            order=1,
            difficulty=2,
        )

        self._bulk_vocab(
            l_vocab,
            [
                (
                    "la boulangerie",
                    "bakery",
                    "la bu.lɑ̃ʒ.ʁi",
                    "J'achète du pain à la boulangerie.",
                    "f",
                    "noun",
                ),
                (
                    "la bibliothèque",
                    "library",
                    "la bi.bli.jɔ.tɛk",
                    "La bibliothèque ferme à dix-huit heures.",
                    "f",
                    "noun",
                ),
                (
                    "la mairie",
                    "town hall",
                    "la mɛ.ʁi",
                    "La mairie est sur la place principale.",
                    "f",
                    "noun",
                ),
                (
                    "le marché",
                    "market",
                    "lə maʁ.ʃe",
                    "Le marché a lieu le dimanche matin.",
                    "m",
                    "noun",
                ),
                ("le musée", "museum", "lə my.ze", "Le musée d'Orsay est magnifique.", "m", "noun"),
                ("la poste", "post office", "la pɔst", "Je dois aller à la poste.", "f", "noun"),
                ("l'église", "church", "le.ɡliz", "L'église date du douzième siècle.", "f", "noun"),
                (
                    "le pont",
                    "bridge",
                    "lə pɔ̃",
                    "Traversez le pont pour arriver au parc.",
                    "m",
                    "noun",
                ),
                (
                    "le carrefour",
                    "crossroads / intersection",
                    "lə kaʁ.fuʁ",
                    "Tournez à droite au carrefour.",
                    "m",
                    "noun",
                ),
                ("le trottoir", "sidewalk", "lə tʁɔ.twaʁ", "Restez sur le trottoir.", "m", "noun"),
                (
                    "le quartier",
                    "neighborhood",
                    "lə kaʁ.tje",
                    "C'est un quartier très animé.",
                    "m",
                    "noun",
                ),
            ],
        )

        # -- Grammar ------------------------------------------------------
        l_gram = Lesson.objects.create(
            topic=t,
            type="grammar",
            title="Prépositions de lieu",
            content={"intro": "Master à, en, au, aux, and chez for places."},
            order=2,
            difficulty=2,
        )

        GrammarRule.objects.create(
            lesson=l_gram,
            title="Prépositions de lieu — à, en, au, aux, chez",
            explanation=(
                "French uses different prepositions depending on the type of place:\n\n"
                "**à** — cities and some locations: à Paris, à la poste, à l'école\n"
                "**en** — feminine countries, continents, and modes of transport: "
                "en France, en Afrique, en voiture\n"
                "**au** — masculine countries (singular): au Japon, au Canada\n"
                "**aux** — plural countries: aux États-Unis, aux Pays-Bas\n"
                "**chez** — someone's place: chez le médecin, chez moi\n\n"
                "For 'at / to a shop', use **à la / au / à l'**: "
                "à la boulangerie, au supermarché, à l'hôpital."
            ),
            formula="à (city/place) / en (fem. country) / au (masc. country) / aux (plural) / chez (person)",
            examples=[
                "J'habite à Lyon. (I live in Lyon.)",
                "Nous allons en Italie cet été. (We're going to Italy this summer.)",
                "Il travaille au Canada. (He works in Canada.)",
                "Je vais chez le dentiste. (I'm going to the dentist's.)",
                "Elle étudie aux États-Unis. (She studies in the United States.)",
            ],
            exceptions=[
                "Some masculine countries starting with a vowel use 'en': en Iran, en Irak, en Israël.",
                "Islands vary: à Cuba, à Madagascar, but en Corse, en Sicile.",
            ],
        )

        # -- Reading text -------------------------------------------------
        l_text = Lesson.objects.create(
            topic=t,
            type="text",
            title="Perdu dans Paris",
            content={"intro": "Read about a tourist lost in Paris asking for directions."},
            order=3,
            difficulty=2,
        )

        ReadingText.objects.create(
            lesson=l_text,
            title="Perdu dans Paris",
            content_fr=(
                "Thomas est un touriste américain en vacances à Paris. Ce matin, "
                "il veut visiter le musée du Louvre, mais il s'est perdu dans le "
                "quartier du Marais.\n\n"
                "Il s'approche d'une dame sur le trottoir :\n"
                "— Excusez-moi, madame. Pourriez-vous m'indiquer le chemin pour "
                "aller au Louvre ?\n"
                "— Bien sûr ! Allez tout droit jusqu'au carrefour, puis tournez "
                "à gauche. Continuez le long de la rue de Rivoli pendant environ "
                "dix minutes. Le musée sera sur votre droite.\n"
                "— Est-ce que c'est loin à pied ?\n"
                "— Non, c'est à vingt minutes environ. Sinon, vous pouvez prendre "
                "le métro à la station Saint-Paul. C'est à deux arrêts.\n\n"
                "Thomas remercie la dame et décide de marcher. En chemin, il passe "
                "devant une belle église et une boulangerie où il achète un croissant. "
                "Finalement, il arrive au Louvre juste à temps pour l'ouverture."
            ),
            content_en=(
                "Thomas is an American tourist on vacation in Paris. This morning, "
                "he wants to visit the Louvre museum, but he got lost in the "
                "Marais neighborhood.\n\n"
                "He approaches a woman on the sidewalk:\n"
                "— Excuse me, ma'am. Could you show me the way to "
                "the Louvre?\n"
                "— Of course! Go straight until the intersection, then turn "
                "left. Continue along Rue de Rivoli for about "
                "ten minutes. The museum will be on your right.\n"
                "— Is it far on foot?\n"
                "— No, it's about twenty minutes. Otherwise, you can take "
                "the metro at Saint-Paul station. It's two stops away.\n\n"
                "Thomas thanks the woman and decides to walk. On the way, he passes "
                "a beautiful church and a bakery where he buys a croissant. "
                "Finally, he arrives at the Louvre just in time for opening."
            ),
            vocabulary_highlights=[
                "trottoir",
                "carrefour",
                "tout droit",
                "à gauche",
                "rue de Rivoli",
                "métro",
                "station",
                "boulangerie",
            ],
            comprehension_questions=[
                {"question": "Where does Thomas want to go?", "answer": "The Louvre museum"},
                {"question": "In which neighborhood is he lost?", "answer": "Le Marais"},
                {
                    "question": "What are the two options to get to the Louvre?",
                    "answer": "Walk (20 minutes) or take the metro from Saint-Paul (2 stops)",
                },
                {
                    "question": "What does Thomas buy on the way?",
                    "answer": "A croissant from a bakery",
                },
            ],
        )

        # -- Questions ----------------------------------------------------
        self._bulk_questions(
            l_vocab,
            [
                (
                    "mcq",
                    "What does 'la boulangerie' mean?",
                    "bakery",
                    ["library", "post office", "market"],
                    "'La boulangerie' is where you buy bread and pastries.",
                    1,
                ),
                (
                    "fill_blank",
                    "La _____ ferme à dix-huit heures. (library)",
                    "bibliothèque",
                    ["boulangerie", "mairie", "poste"],
                    "'La bibliothèque' means the library.",
                    1,
                ),
                (
                    "mcq",
                    "What is 'le carrefour'?",
                    "intersection / crossroads",
                    ["bridge", "sidewalk", "neighborhood"],
                    "'Le carrefour' is where two or more roads cross.",
                    1,
                ),
                (
                    "translate",
                    "Translate: 'Cross the bridge to reach the park.'",
                    "Traversez le pont pour arriver au parc.",
                    [],
                    "'Traverser' means to cross. Imperative vous form.",
                    2,
                ),
            ],
        )

        self._bulk_questions(
            l_gram,
            [
                (
                    "fill_blank",
                    "J'habite _____ Lyon. (preposition)",
                    "à",
                    ["en", "au", "chez"],
                    "For cities, use 'à': à Paris, à Lyon, à Marseille.",
                    1,
                ),
                (
                    "mcq",
                    "Which preposition is used with feminine countries?",
                    "en",
                    ["à", "au", "chez"],
                    "Feminine countries use 'en': en France, en Espagne, en Italie.",
                    1,
                ),
                (
                    "fill_blank",
                    "Il travaille _____ Canada. (preposition)",
                    "au",
                    ["en", "à", "aux"],
                    "Canada is masculine singular: au Canada.",
                    2,
                ),
                (
                    "fill_blank",
                    "Je vais _____ le dentiste. (preposition)",
                    "chez",
                    ["à", "en", "au"],
                    "'Chez' is used for people and professionals: chez le dentiste.",
                    2,
                ),
            ],
        )

        self.stdout.write(self.style.SUCCESS(f"  Created topic '{name_fr}'"))

    # ------------------------------------------------------------------ #
    #  TOPIC 8 — Les achats
    # ------------------------------------------------------------------ #

    def _seed_topic_8(self):
        name_fr = "Les achats"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)")
            return

        t = Topic.objects.create(
            name_fr=name_fr,
            name_en="Shopping",
            description="Clothing, prices, colors, and shopping in France.",
            icon="🛍️",
            order=8,
            difficulty_level=1,
        )

        # -- Vocab --------------------------------------------------------
        l_vocab = Lesson.objects.create(
            topic=t,
            type="vocab",
            title="Clothing, Colors & Prices",
            content={"intro": "Everything you need for a shopping trip in France."},
            order=1,
            difficulty=1,
        )

        self._bulk_vocab(
            l_vocab,
            [
                ("la robe", "dress", "la ʁɔb", "Cette robe rouge est très élégante.", "f", "noun"),
                (
                    "le pantalon",
                    "trousers / pants",
                    "lə pɑ̃.ta.lɔ̃",
                    "Ce pantalon est trop long.",
                    "m",
                    "noun",
                ),
                ("la chemise", "shirt", "la ʃə.miz", "Il porte une chemise blanche.", "f", "noun"),
                (
                    "les chaussures",
                    "shoes",
                    "le ʃo.syʁ",
                    "Ces chaussures sont en solde.",
                    "f",
                    "noun",
                ),
                ("le manteau", "coat", "lə mɑ̃.to", "Mets ton manteau, il fait froid.", "m", "noun"),
                ("la taille", "size", "la taj", "Quelle est votre taille ?", "f", "noun"),
                ("le prix", "price", "lə pʁi", "Quel est le prix de cette jupe ?", "m", "noun"),
                ("cher / chère", "expensive", "ʃɛʁ", "Ce magasin est trop cher.", "a", "adjective"),
                (
                    "bon marché",
                    "cheap / inexpensive",
                    "bɔ̃ maʁ.ʃe",
                    "Les fruits sont bon marché au marché.",
                    "a",
                    "adjective",
                ),
                ("rouge", "red", "ʁuʒ", "Je préfère la robe rouge.", "a", "adjective"),
                ("bleu(e)", "blue", "blø", "Le ciel est bleu aujourd'hui.", "a", "adjective"),
                ("noir(e)", "black", "nwaʁ", "Elle porte un manteau noir.", "a", "adjective"),
            ],
        )

        # -- Grammar ------------------------------------------------------
        l_gram = Lesson.objects.create(
            topic=t,
            type="grammar",
            title="Les adjectifs démonstratifs",
            content={"intro": "Point things out with ce, cet, cette, and ces."},
            order=2,
            difficulty=1,
        )

        GrammarRule.objects.create(
            lesson=l_gram,
            title="Adjectifs démonstratifs — ce, cet, cette, ces",
            explanation=(
                "Demonstrative adjectives mean 'this', 'that', 'these', or 'those'. "
                "They agree in gender and number with the noun:\n\n"
                "| Form | Usage | Example |\n"
                "|------|-------|---------|\n"
                "| **ce** | masculine singular (consonant) | ce livre (this book) |\n"
                "| **cet** | masculine singular (vowel/h) | cet homme (this man) |\n"
                "| **cette** | feminine singular | cette robe (this dress) |\n"
                "| **ces** | plural (m & f) | ces chaussures (these shoes) |\n\n"
                "To distinguish 'this' from 'that', add **-ci** (here) or **-là** (there) "
                "after the noun: ce livre-ci (this book) vs ce livre-là (that book)."
            ),
            formula="ce (m.sg.) / cet (m.sg. vowel) / cette (f.sg.) / ces (pl.)",
            examples=[
                "Ce pantalon est trop grand. (These pants are too big.)",
                "Cet article est en solde. (This item is on sale.)",
                "Cette chemise est belle. (This shirt is beautiful.)",
                "Ces chaussures coûtent cinquante euros. (These shoes cost fifty euros.)",
                "Je préfère cette robe-ci, pas cette robe-là. (I prefer this dress, not that one.)",
            ],
            exceptions=[
                "'Cet' is only used before masculine nouns starting with a vowel or silent h: cet ami, cet hôtel.",
            ],
        )

        # -- Reading text -------------------------------------------------
        l_text = Lesson.objects.create(
            topic=t,
            type="text",
            title="Au marché du dimanche",
            content={"intro": "Read about a Sunday morning at a French market."},
            order=3,
            difficulty=1,
        )

        ReadingText.objects.create(
            lesson=l_text,
            title="Au marché du dimanche",
            content_fr=(
                "Chaque dimanche, Camille va au marché de son quartier avec sa mère. "
                "Elles adorent ce rituel du weekend. Le marché est installé sur "
                "la grande place, et il y a toujours beaucoup de monde.\n\n"
                "D'abord, elles s'arrêtent chez le maraîcher. Camille choisit des "
                "tomates bien rouges et des courgettes. « Combien coûtent ces "
                "pommes ? » demande sa mère. « Deux euros le kilo, madame. "
                "Elles sont excellentes cette semaine ! »\n\n"
                "Ensuite, elles passent devant un stand de vêtements. Camille "
                "remarque une jolie écharpe bleue. « Regarde cette écharpe, maman ! "
                "Elle n'est pas chère — seulement huit euros. » Sa mère lui dit : "
                "« D'accord, mais essaie-la d'abord. »\n\n"
                "Avant de partir, elles achètent du fromage de chèvre et un bouquet "
                "de fleurs. Le dimanche au marché, c'est toujours un moment de bonheur."
            ),
            content_en=(
                "Every Sunday, Camille goes to the market in her neighborhood with her mother. "
                "They love this weekend ritual. The market is set up on "
                "the main square, and it's always very busy.\n\n"
                "First, they stop at the produce vendor's. Camille picks some "
                "nice red tomatoes and zucchini. 'How much are these "
                "apples?' asks her mother. 'Two euros per kilo, ma'am. "
                "They're excellent this week!'\n\n"
                "Then, they pass a clothing stand. Camille "
                "notices a pretty blue scarf. 'Look at this scarf, Mom! "
                "It's not expensive — only eight euros.' Her mother tells her: "
                "'Okay, but try it on first.'\n\n"
                "Before leaving, they buy goat cheese and a bunch "
                "of flowers. Sunday at the market is always a moment of happiness."
            ),
            vocabulary_highlights=[
                "marché",
                "maraîcher",
                "tomates",
                "courgettes",
                "écharpe",
                "fromage de chèvre",
                "bouquet de fleurs",
            ],
            comprehension_questions=[
                {
                    "question": "How often do Camille and her mother go to the market?",
                    "answer": "Every Sunday",
                },
                {"question": "How much do the apples cost?", "answer": "Two euros per kilo"},
                {
                    "question": "What does Camille want to buy at the clothing stand?",
                    "answer": "A blue scarf for eight euros",
                },
                {
                    "question": "What do they buy before leaving?",
                    "answer": "Goat cheese and a bunch of flowers",
                },
            ],
        )

        # -- Questions ----------------------------------------------------
        self._bulk_questions(
            l_vocab,
            [
                (
                    "mcq",
                    "What does 'la robe' mean?",
                    "dress",
                    ["shirt", "coat", "shoes"],
                    "'La robe' is feminine — a dress.",
                    1,
                ),
                (
                    "fill_blank",
                    "Quelle est votre _____ ? (size)",
                    "taille",
                    ["prix", "couleur", "robe"],
                    "'La taille' means size.",
                    1,
                ),
                (
                    "mcq",
                    "What does 'bon marché' mean?",
                    "cheap / inexpensive",
                    ["expensive", "on sale", "free"],
                    "'Bon marché' is invariable — it never changes form.",
                    1,
                ),
                (
                    "translate",
                    "Translate: 'These shoes are on sale.'",
                    "Ces chaussures sont en solde.",
                    [],
                    "'En solde' means on sale.",
                    1,
                ),
            ],
        )

        self._bulk_questions(
            l_gram,
            [
                (
                    "fill_blank",
                    "_____ homme est grand. (demonstrative, masc. vowel)",
                    "Cet",
                    ["Ce", "Cette", "Ces"],
                    "'Homme' starts with a silent h, so use 'cet'.",
                    1,
                ),
                (
                    "mcq",
                    "Which demonstrative adjective is used with feminine singular nouns?",
                    "cette",
                    ["ce", "cet", "ces"],
                    "'Cette' for feminine singular: cette robe, cette maison.",
                    1,
                ),
                (
                    "fill_blank",
                    "_____ chaussures coûtent cinquante euros. (demonstrative, pl.)",
                    "Ces",
                    ["Ce", "Cet", "Cette"],
                    "'Ces' is used for all plural nouns.",
                    1,
                ),
                (
                    "translate",
                    "Translate: 'I prefer this dress, not that one.'",
                    "Je préfère cette robe-ci, pas cette robe-là.",
                    [],
                    "Add -ci (this) and -là (that) to distinguish proximity.",
                    2,
                ),
            ],
        )

        self.stdout.write(self.style.SUCCESS(f"  Created topic '{name_fr}'"))

    # ------------------------------------------------------------------ #
    #  DISCOVER CARDS
    # ------------------------------------------------------------------ #

    def _seed_discover_cards(self):
        now = timezone.now()
        expires = now + timedelta(hours=720)  # 30 days

        cards = [
            # -- word cards -----------------------------------------------
            {
                "type": "word",
                "title": "dépaysement",
                "summary": "dépaysement — the disorientation felt in a foreign country",
                "content_json": {
                    "french": "le dépaysement",
                    "english": "the feeling of disorientation when in a foreign place",
                    "pronunciation": "de.pɛ.iz.mɑ̃",
                    "example": "Après deux semaines au Japon, le dépaysement était total.",
                    "gender": "m",
                    "part_of_speech": "noun",
                },
            },
            {
                "type": "word",
                "title": "flâner",
                "summary": "flâner — to stroll aimlessly, enjoying the surroundings",
                "content_json": {
                    "french": "flâner",
                    "english": "to stroll aimlessly, to wander for pleasure",
                    "pronunciation": "flɑ.ne",
                    "example": "J'adore flâner dans les rues de Montmartre.",
                    "gender": "a",
                    "part_of_speech": "verb",
                },
            },
            {
                "type": "word",
                "title": "retrouvailles",
                "summary": "retrouvailles — the joy of reuniting after a long time",
                "content_json": {
                    "french": "les retrouvailles",
                    "english": "the happiness of reuniting with someone after a long time apart",
                    "pronunciation": "ʁə.tʁu.vaj",
                    "example": "Les retrouvailles avec ma famille m'ont beaucoup ému.",
                    "gender": "f",
                    "part_of_speech": "noun",
                },
            },
            # -- grammar cards --------------------------------------------
            {
                "type": "grammar",
                "title": "Y replaces places",
                "summary": "The pronoun 'y' replaces a place introduced by à, en, dans, sur, chez...",
                "content_json": {
                    "explanation": "Use 'y' to replace a place you've already mentioned. "
                    "Tu vas à Paris ? — Oui, j'y vais demain.",
                    "formula": "y = à / en / dans / sur / chez + place",
                    "examples": [
                        "Tu habites en France ? — Oui, j'y habite depuis trois ans.",
                        "Vous allez au cinéma ? — Non, nous n'y allons pas.",
                    ],
                    "exceptions": [
                        "With people, use lui/leur instead: Je pense à Marie → Je pense à elle (not *j'y pense)."
                    ],
                },
            },
            {
                "type": "grammar",
                "title": "En replaces quantities",
                "summary": "The pronoun 'en' replaces nouns with de, du, des, or a quantity.",
                "content_json": {
                    "explanation": "'En' replaces a noun introduced by 'de' or a quantity expression. "
                    "Tu veux du café ? — Oui, j'en veux.",
                    "formula": "en = de + noun / quantity expression",
                    "examples": [
                        "Tu as des enfants ? — Oui, j'en ai deux.",
                        "Il mange du chocolat ? — Non, il n'en mange pas.",
                    ],
                    "exceptions": [],
                },
            },
            {
                "type": "grammar",
                "title": "Negation beyond ne...pas",
                "summary": "French has many negation patterns: ne...jamais, ne...rien, ne...plus, ne...personne.",
                "content_json": {
                    "explanation": "Beyond ne...pas, French uses several negation pairs that wrap the verb.",
                    "formula": "ne...jamais (never) / ne...rien (nothing) / ne...plus (no longer) / ne...personne (nobody)",
                    "examples": [
                        "Je ne mange jamais de viande. (I never eat meat.)",
                        "Il ne dit rien. (He says nothing.)",
                        "Nous n'habitons plus à Paris. (We no longer live in Paris.)",
                        "Elle ne connaît personne ici. (She knows nobody here.)",
                    ],
                    "exceptions": [
                        "Personne and rien can be subjects: Personne n'est venu. Rien n'est impossible."
                    ],
                },
            },
            # -- trivia cards ---------------------------------------------
            {
                "type": "trivia",
                "title": "French is spoken on 5 continents",
                "summary": "French is an official language in 29 countries across five continents.",
                "content_json": {
                    "fact_fr": "Le français est la langue officielle de 29 pays répartis sur les cinq continents.",
                    "fact_en": "French is the official language of 29 countries spread across five continents, "
                    "making it one of the most geographically widespread languages in the world.",
                },
            },
            {
                "type": "trivia",
                "title": "The longest French word",
                "summary": "The longest word commonly cited in French dictionaries has 25 letters.",
                "content_json": {
                    "fact_fr": "Le mot 'anticonstitutionnellement' (25 lettres) est souvent cité comme le plus long mot français.",
                    "fact_en": "'Anticonstitutionnellement' (meaning 'unconstitutionally') with 25 letters "
                    "is often cited as the longest French word in standard dictionaries.",
                },
            },
            {
                "type": "trivia",
                "title": "The Académie française",
                "summary": "Founded in 1635, the Académie française guards the French language.",
                "content_json": {
                    "fact_fr": "L'Académie française, fondée en 1635, est chargée de veiller sur la langue française et de publier le dictionnaire officiel.",
                    "fact_en": "The Académie française, founded in 1635 by Cardinal Richelieu, is the official authority "
                    "on the French language. Its 40 members are called 'les Immortels'.",
                },
            },
            # -- news cards -----------------------------------------------
            {
                "type": "news",
                "title": "Les Jeux olympiques de Paris",
                "summary": "Paris a accueilli les Jeux olympiques d'été en 2024.",
                "content_json": {
                    "article_fr": (
                        "Paris a accueilli les Jeux olympiques d'été en 2024, cent ans après "
                        "les derniers Jeux organisés dans la capitale française. Les épreuves "
                        "se sont déroulées dans des lieux emblématiques comme le Stade de France, "
                        "le Grand Palais et même au pied de la tour Eiffel. La cérémonie "
                        "d'ouverture a eu lieu sur la Seine, une première dans l'histoire olympique."
                    ),
                    "article_en": (
                        "Paris hosted the Summer Olympic Games in 2024, one hundred years after "
                        "the last Games held in the French capital. Events took place in iconic "
                        "venues such as the Stade de France, the Grand Palais, and even at the "
                        "foot of the Eiffel Tower. The opening ceremony took place on the Seine, "
                        "a first in Olympic history."
                    ),
                    "key_vocabulary": [
                        {"fr": "les Jeux olympiques", "en": "the Olympic Games"},
                        {"fr": "les épreuves", "en": "the events / competitions"},
                        {"fr": "la cérémonie d'ouverture", "en": "the opening ceremony"},
                    ],
                },
            },
            {
                "type": "news",
                "title": "Le tourisme en France bat des records",
                "summary": "La France reste la destination touristique numéro un au monde.",
                "content_json": {
                    "article_fr": (
                        "La France reste la première destination touristique mondiale. "
                        "En 2024, le pays a accueilli plus de 100 millions de visiteurs "
                        "internationaux. Paris, la Côte d'Azur et les châteaux de la Loire "
                        "sont toujours les destinations les plus populaires. Le gouvernement "
                        "investit dans le tourisme durable pour protéger les sites naturels "
                        "tout en accueillant les voyageurs."
                    ),
                    "article_en": (
                        "France remains the world's top tourist destination. "
                        "In 2024, the country welcomed over 100 million international visitors. "
                        "Paris, the French Riviera, and the Loire Valley castles "
                        "remain the most popular destinations. The government "
                        "is investing in sustainable tourism to protect natural sites "
                        "while welcoming travelers."
                    ),
                    "key_vocabulary": [
                        {"fr": "destination touristique", "en": "tourist destination"},
                        {"fr": "les châteaux de la Loire", "en": "the Loire Valley castles"},
                        {"fr": "le tourisme durable", "en": "sustainable tourism"},
                    ],
                },
            },
            {
                "type": "news",
                "title": "La gastronomie française au patrimoine de l'UNESCO",
                "summary": "Le repas gastronomique français est inscrit au patrimoine immatériel de l'UNESCO.",
                "content_json": {
                    "article_fr": (
                        "Depuis 2010, le repas gastronomique des Français est inscrit au "
                        "patrimoine culturel immatériel de l'UNESCO. Cette reconnaissance "
                        "célèbre l'art de bien manger à la française : l'apéritif, l'entrée, "
                        "le plat principal, le fromage et le dessert. Plus qu'une simple "
                        "alimentation, c'est un rituel social qui rassemble famille et amis "
                        "autour de la table."
                    ),
                    "article_en": (
                        "Since 2010, the French gastronomic meal has been listed as UNESCO "
                        "Intangible Cultural Heritage. This recognition celebrates the French "
                        "art of fine dining: the aperitif, starter, main course, cheese, "
                        "and dessert. More than just food, it is a social ritual that brings "
                        "family and friends together around the table."
                    ),
                    "key_vocabulary": [
                        {"fr": "le patrimoine immatériel", "en": "intangible heritage"},
                        {"fr": "le repas gastronomique", "en": "the gastronomic meal"},
                        {"fr": "l'apéritif", "en": "the aperitif / pre-dinner drink"},
                    ],
                },
            },
        ]

        created_count = 0
        for card_data in cards:
            if DiscoverCard.objects.filter(title=card_data["title"]).exists():
                continue
            DiscoverCard.objects.create(
                **card_data,
                generated_at=now,
                expires_at=expires,
            )
            created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"  Created {created_count} discover cards (skipped {len(cards) - created_count})"
            )
        )

    # ------------------------------------------------------------------ #
    #  main handle
    # ------------------------------------------------------------------ #

    def handle(self, *args, **options):
        self.stdout.write("Seeding demo data...\n")

        self._seed_topic_3()
        self._seed_topic_4()
        self._seed_topic_5()
        self._seed_topic_6()
        self._seed_topic_7()
        self._seed_topic_8()
        self._seed_discover_cards()

        self.stdout.write(
            "\n"
            + self.style.SUCCESS(
                f"Done! Totals: "
                f"{Topic.objects.count()} topics, "
                f"{Lesson.objects.count()} lessons, "
                f"{Vocabulary.objects.count()} vocab items, "
                f"{GrammarRule.objects.count()} grammar rules, "
                f"{ReadingText.objects.count()} reading texts, "
                f"{Question.objects.count()} questions, "
                f"{DiscoverCard.objects.count()} discover cards."
            )
        )
