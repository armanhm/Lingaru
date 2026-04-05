from django.core.management.base import BaseCommand
from apps.content.models import (
    Topic,
    Lesson,
    Vocabulary,
    GrammarRule,
    ReadingText,
    Question,
)


class Command(BaseCommand):
    help = "Seed the database with sample French learning content"

    def handle(self, *args, **options):
        if Topic.objects.exists():
            self.stdout.write(self.style.WARNING("Content already exists. Skipping seed."))
            return

        self.stdout.write("Seeding content...")

        # ── Topic 1: Greetings & Introductions ──────────────────────
        t1 = Topic.objects.create(
            name_fr="Salutations et presentations",
            name_en="Greetings & Introductions",
            description="Learn to greet people and introduce yourself in French.",
            icon="hand-wave",
            order=1,
            difficulty_level=1,
        )

        # Lesson 1.1: Basic Greetings (vocab)
        l1_1 = Lesson.objects.create(
            topic=t1, type="vocab", title="Basic Greetings",
            content={"intro": "Master the essential French greetings used every day."},
            order=1, difficulty=1,
        )

        greetings_vocab = [
            ("bonjour", "hello / good morning", "bɔ̃ʒuʁ", "Bonjour, comment allez-vous?", "n", "interjection"),
            ("bonsoir", "good evening", "bɔ̃swaʁ", "Bonsoir, madame.", "n", "interjection"),
            ("salut", "hi / bye (informal)", "saly", "Salut, ca va?", "n", "interjection"),
            ("au revoir", "goodbye", "o ʁəvwaʁ", "Au revoir et bonne journee!", "n", "interjection"),
            ("merci", "thank you", "mɛʁsi", "Merci beaucoup!", "n", "interjection"),
            ("s'il vous plait", "please (formal)", "sil vu plɛ", "Un cafe, s'il vous plait.", "n", "phrase"),
            ("excusez-moi", "excuse me", "ɛkskyze mwa", "Excusez-moi, ou est la gare?", "n", "phrase"),
            ("comment allez-vous?", "how are you? (formal)", "kɔmɑ̃ tale vu", "Bonjour, comment allez-vous?", "n", "phrase"),
        ]

        for fr, en, pron, ex, gender, pos in greetings_vocab:
            Vocabulary.objects.create(
                lesson=l1_1, french=fr, english=en, pronunciation=pron,
                example_sentence=ex, gender=gender, part_of_speech=pos,
            )

        greetings_questions = [
            ("mcq", "What does 'bonjour' mean?", "hello / good morning",
             ["goodbye", "thank you", "please"],
             "'Bonjour' is the standard French greeting used during the day.", 1),
            ("mcq", "Which greeting is informal?", "salut",
             ["bonjour", "bonsoir", "comment allez-vous"],
             "'Salut' is the informal way to say hi or bye among friends.", 1),
            ("translate", "Translate: 'Good evening, madam.'", "Bonsoir, madame.",
             [], "'Bonsoir' is used in the evening. 'Madame' means madam.", 1),
            ("fill_blank", "_____, comment allez-vous? (greeting)", "Bonjour",
             ["Merci", "Au revoir", "Salut"],
             "The formal greeting to start a conversation is 'Bonjour'.", 1),
        ]

        for qtype, prompt, correct, wrong, expl, diff in greetings_questions:
            Question.objects.create(
                lesson=l1_1, type=qtype, prompt=prompt, correct_answer=correct,
                wrong_answers=wrong, explanation=expl, difficulty=diff,
            )

        # Lesson 1.2: Introducing Yourself (grammar)
        l1_2 = Lesson.objects.create(
            topic=t1, type="grammar", title="Introducing Yourself",
            content={"intro": "Learn the key phrases and grammar for self-introduction."},
            order=2, difficulty=1,
        )

        GrammarRule.objects.create(
            lesson=l1_2,
            title="Subject Pronouns",
            explanation=(
                "French subject pronouns are essential for conjugation. "
                "**je** (I), **tu** (you informal), **il/elle/on** (he/she/one), "
                "**nous** (we), **vous** (you formal/plural), **ils/elles** (they).\n\n"
                "Use **tu** with friends and family. Use **vous** with strangers, "
                "elders, and in professional settings."
            ),
            formula="je / tu / il, elle, on / nous / vous / ils, elles",
            examples=[
                "Je suis etudiant. (I am a student.)",
                "Tu es francais? (Are you French?)",
                "Elle est professeur. (She is a teacher.)",
                "Nous sommes amis. (We are friends.)",
            ],
            exceptions=[
                "On can mean 'we' in informal speech: On y va! (Let's go!)",
            ],
        )

        GrammarRule.objects.create(
            lesson=l1_2,
            title="Etre (to be) — Present Tense",
            explanation=(
                "**Etre** is one of the most important French verbs. "
                "It is irregular and must be memorized.\n\n"
                "| Pronoun | Conjugation |\n"
                "|---------|-------------|\n"
                "| je | suis |\n"
                "| tu | es |\n"
                "| il/elle/on | est |\n"
                "| nous | sommes |\n"
                "| vous | etes |\n"
                "| ils/elles | sont |"
            ),
            formula="je suis / tu es / il est / nous sommes / vous etes / ils sont",
            examples=[
                "Je suis Marie. (I am Marie.)",
                "Vous etes americain? (Are you American?)",
                "Ils sont contents. (They are happy.)",
            ],
            exceptions=[
                "C'est vs Il est: 'C'est un professeur' (It's a teacher) vs 'Il est professeur' (He is a teacher).",
            ],
        )

        intro_questions = [
            ("fill_blank", "Je _____ etudiant. (etre, present)", "suis",
             ["es", "est", "sommes"],
             "Je suis — first person singular of etre.", 1),
            ("mcq", "Which pronoun is formal 'you'?", "vous",
             ["tu", "il", "nous"],
             "'Vous' is the formal/plural form of 'you'.", 1),
            ("conjugation", "Conjugate 'etre' for 'nous':", "sommes",
             ["sont", "etes", "suis"],
             "Nous sommes — first person plural of etre.", 2),
        ]

        for qtype, prompt, correct, wrong, expl, diff in intro_questions:
            Question.objects.create(
                lesson=l1_2, type=qtype, prompt=prompt, correct_answer=correct,
                wrong_answers=wrong, explanation=expl, difficulty=diff,
            )

        # Lesson 1.3: At the Hotel (reading text)
        l1_3 = Lesson.objects.create(
            topic=t1, type="text", title="At the Hotel — Checking In",
            content={"intro": "Read a dialogue and practice comprehension."},
            order=3, difficulty=1,
        )

        ReadingText.objects.create(
            lesson=l1_3,
            title="A l'hotel",
            content_fr=(
                "Receptionniste: Bonsoir, bienvenue a l'Hotel du Lac. "
                "Comment puis-je vous aider?\n\n"
                "Marie: Bonsoir. J'ai une reservation au nom de Dupont.\n\n"
                "Receptionniste: Oui, madame Dupont. Vous avez une chambre double "
                "pour trois nuits. Voici votre cle. C'est la chambre 24, au deuxieme etage.\n\n"
                "Marie: Merci beaucoup. A quelle heure est le petit-dejeuner?\n\n"
                "Receptionniste: Le petit-dejeuner est servi de sept heures a dix heures "
                "dans la salle a manger. Bonne soiree, madame!\n\n"
                "Marie: Merci, bonne soiree!"
            ),
            content_en=(
                "Receptionist: Good evening, welcome to Hotel du Lac. "
                "How can I help you?\n\n"
                "Marie: Good evening. I have a reservation under the name Dupont.\n\n"
                "Receptionist: Yes, Mrs. Dupont. You have a double room "
                "for three nights. Here is your key. It's room 24, on the second floor.\n\n"
                "Marie: Thank you very much. What time is breakfast?\n\n"
                "Receptionist: Breakfast is served from seven to ten "
                "in the dining room. Have a good evening, madam!\n\n"
                "Marie: Thank you, good evening!"
            ),
            vocabulary_highlights=[
                "reservation", "chambre", "cle", "petit-dejeuner",
                "deuxieme etage", "salle a manger",
            ],
            comprehension_questions=[
                {"question": "What is the name on the reservation?", "answer": "Dupont"},
                {"question": "What type of room does Marie have?", "answer": "A double room (chambre double)"},
                {"question": "How many nights is the stay?", "answer": "Three nights (trois nuits)"},
                {"question": "What time is breakfast served?", "answer": "From 7:00 to 10:00"},
                {"question": "On which floor is room 24?", "answer": "The second floor (deuxieme etage)"},
            ],
        )

        hotel_questions = [
            ("mcq", "What does 'chambre' mean?", "room",
             ["key", "floor", "breakfast"],
             "'Chambre' means room in French.", 1),
            ("mcq", "What does 'petit-dejeuner' mean?", "breakfast",
             ["lunch", "dinner", "snack"],
             "'Petit-dejeuner' literally means 'small lunch' but refers to breakfast.", 1),
        ]

        for qtype, prompt, correct, wrong, expl, diff in hotel_questions:
            Question.objects.create(
                lesson=l1_3, type=qtype, prompt=prompt, correct_answer=correct,
                wrong_answers=wrong, explanation=expl, difficulty=diff,
            )

        # ── Topic 2: Food & Dining ─────────────────────────────────
        t2 = Topic.objects.create(
            name_fr="Nourriture et restaurant",
            name_en="Food & Dining",
            description="Learn vocabulary and phrases for ordering food and dining out.",
            icon="utensils",
            order=2,
            difficulty_level=1,
        )

        # Lesson 2.1: Food Vocabulary
        l2_1 = Lesson.objects.create(
            topic=t2, type="vocab", title="Common Foods",
            content={"intro": "Essential food vocabulary for everyday life."},
            order=1, difficulty=1,
        )

        food_vocab = [
            ("le pain", "bread", "lə pɛ̃", "Je voudrais du pain, s'il vous plait.", "m", "noun"),
            ("le fromage", "cheese", "lə fʁɔmaʒ", "La France est celebre pour son fromage.", "m", "noun"),
            ("la viande", "meat", "la vjɑ̃d", "Je ne mange pas de viande.", "f", "noun"),
            ("le poisson", "fish", "lə pwasɔ̃", "Le poisson est frais aujourd'hui.", "m", "noun"),
            ("les legumes", "vegetables", "le legym", "Il faut manger des legumes.", "m", "noun"),
            ("les fruits", "fruit", "le fʁɥi", "J'adore les fruits de saison.", "m", "noun"),
            ("l'eau", "water", "lo", "Une carafe d'eau, s'il vous plait.", "f", "noun"),
            ("le vin", "wine", "lə vɛ̃", "Un verre de vin rouge, s'il vous plait.", "m", "noun"),
            ("le cafe", "coffee", "lə kafe", "Un cafe creme, s'il vous plait.", "m", "noun"),
            ("le dessert", "dessert", "lə desɛʁ", "Qu'est-ce que vous avez comme dessert?", "m", "noun"),
        ]

        for fr, en, pron, ex, gender, pos in food_vocab:
            Vocabulary.objects.create(
                lesson=l2_1, french=fr, english=en, pronunciation=pron,
                example_sentence=ex, gender=gender, part_of_speech=pos,
            )

        food_questions = [
            ("mcq", "What does 'le pain' mean?", "bread",
             ["cheese", "meat", "fish"],
             "'Le pain' means bread. It is masculine.", 1),
            ("mcq", "Which word means 'cheese'?", "le fromage",
             ["le poisson", "la viande", "le dessert"],
             "'Le fromage' means cheese — France has over 400 varieties!", 1),
            ("fill_blank", "Je voudrais du _____, s'il vous plait. (bread)", "pain",
             ["fromage", "poisson", "vin"],
             "'Du pain' — some bread. 'Du' is the partitive article for masculine nouns.", 1),
            ("translate", "Translate: 'I don't eat meat.'", "Je ne mange pas de viande.",
             [], "Negation: ne...pas. After negation, 'de la' becomes 'de'.", 2),
            ("mcq", "What gender is 'la viande'?", "feminine",
             ["masculine", "neutral", "plural"],
             "'La' indicates feminine gender. La viande = the meat.", 1),
        ]

        for qtype, prompt, correct, wrong, expl, diff in food_questions:
            Question.objects.create(
                lesson=l2_1, type=qtype, prompt=prompt, correct_answer=correct,
                wrong_answers=wrong, explanation=expl, difficulty=diff,
            )

        # Lesson 2.2: Partitive Articles (grammar)
        l2_2 = Lesson.objects.create(
            topic=t2, type="grammar", title="Partitive Articles",
            content={"intro": "Learn when and how to use du, de la, de l', and des."},
            order=2, difficulty=2,
        )

        GrammarRule.objects.create(
            lesson=l2_2,
            title="Partitive Articles: du, de la, de l', des",
            explanation=(
                "Partitive articles express an unspecified quantity — 'some' or 'any'. "
                "They are required in French where English often uses no article.\n\n"
                "| Gender | Article | Example |\n"
                "|--------|---------|----------|\n"
                "| Masculine | du | du pain (some bread) |\n"
                "| Feminine | de la | de la viande (some meat) |\n"
                "| Before vowel | de l' | de l'eau (some water) |\n"
                "| Plural | des | des fruits (some fruit) |\n\n"
                "After negation, all partitive articles become **de** (or **d'** before a vowel)."
            ),
            formula="du (m) / de la (f) / de l' (vowel) / des (pl) → de (after negation)",
            examples=[
                "Je mange du fromage. (I eat some cheese.)",
                "Elle boit de la biere. (She drinks some beer.)",
                "Nous buvons de l'eau. (We drink some water.)",
                "Vous voulez des legumes? (Do you want some vegetables?)",
                "Je ne mange pas de viande. (I don't eat meat.)",
            ],
            exceptions=[
                "After expressions of quantity (beaucoup, peu, assez), use 'de': beaucoup de pain.",
                "With aimer, adorer, detester, preferer, use definite articles: J'adore le chocolat.",
            ],
        )

        partitive_questions = [
            ("fill_blank", "Je mange _____ fromage. (some)", "du",
             ["de la", "des", "de"],
             "'Fromage' is masculine, so the partitive article is 'du'.", 2),
            ("fill_blank", "Elle ne boit pas _____ vin. (negation)", "de",
             ["du", "de la", "des"],
             "After negation (ne...pas), partitive articles become 'de'.", 2),
            ("mcq", "Which partitive article is used before a vowel?", "de l'",
             ["du", "de la", "des"],
             "Before a vowel or silent h, use 'de l'': de l'eau, de l'huile.", 2),
        ]

        for qtype, prompt, correct, wrong, expl, diff in partitive_questions:
            Question.objects.create(
                lesson=l2_2, type=qtype, prompt=prompt, correct_answer=correct,
                wrong_answers=wrong, explanation=expl, difficulty=diff,
            )

        # Lesson 2.3: At the Restaurant (reading text)
        l2_3 = Lesson.objects.create(
            topic=t2, type="text", title="At the Restaurant",
            content={"intro": "Read a restaurant dialogue and test your comprehension."},
            order=3, difficulty=2,
        )

        ReadingText.objects.create(
            lesson=l2_3,
            title="Au restaurant",
            content_fr=(
                "Serveur: Bonjour! Voici le menu. Vous avez choisi?\n\n"
                "Pierre: Pas encore. Qu'est-ce que vous recommandez?\n\n"
                "Serveur: Notre plat du jour est le saumon grille avec des legumes "
                "de saison. C'est excellent.\n\n"
                "Pierre: Tres bien, je vais prendre le plat du jour. "
                "Et une carafe d'eau, s'il vous plait.\n\n"
                "Sophie: Pour moi, la salade nicoise et un verre de vin blanc.\n\n"
                "Serveur: Parfait. Et comme dessert?\n\n"
                "Pierre: On verra plus tard, merci.\n\n"
                "Serveur: Tres bien. Je reviens tout de suite avec vos boissons."
            ),
            content_en=(
                "Waiter: Hello! Here is the menu. Have you decided?\n\n"
                "Pierre: Not yet. What do you recommend?\n\n"
                "Waiter: Our dish of the day is grilled salmon with seasonal "
                "vegetables. It's excellent.\n\n"
                "Pierre: Very good, I'll have the dish of the day. "
                "And a carafe of water, please.\n\n"
                "Sophie: For me, the nicoise salad and a glass of white wine.\n\n"
                "Waiter: Perfect. And for dessert?\n\n"
                "Pierre: We'll see later, thank you.\n\n"
                "Waiter: Very well. I'll be right back with your drinks."
            ),
            vocabulary_highlights=[
                "menu", "plat du jour", "saumon grille", "legumes de saison",
                "carafe d'eau", "salade nicoise", "vin blanc", "boissons",
            ],
            comprehension_questions=[
                {"question": "What is the dish of the day?", "answer": "Grilled salmon with seasonal vegetables"},
                {"question": "What does Sophie order?", "answer": "Nicoise salad and a glass of white wine"},
                {"question": "What does Pierre order to drink?", "answer": "A carafe of water"},
                {"question": "Do they order dessert immediately?", "answer": "No, Pierre says they'll decide later"},
            ],
        )

        restaurant_questions = [
            ("mcq", "What does 'plat du jour' mean?", "dish of the day",
             ["dessert menu", "drink special", "appetizer"],
             "'Plat du jour' literally means 'dish of the day' — the daily special.", 1),
            ("mcq", "What does 'vin blanc' mean?", "white wine",
             ["red wine", "rose wine", "sparkling wine"],
             "'Vin blanc' = white wine. 'Vin rouge' = red wine.", 1),
            ("translate", "Translate: 'A carafe of water, please.'",
             "Une carafe d'eau, s'il vous plait.",
             [], "A very useful phrase when dining in France — water is free!", 2),
        ]

        for qtype, prompt, correct, wrong, expl, diff in restaurant_questions:
            Question.objects.create(
                lesson=l2_3, type=qtype, prompt=prompt, correct_answer=correct,
                wrong_answers=wrong, explanation=expl, difficulty=diff,
            )

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {Topic.objects.count()} topics, "
            f"{Lesson.objects.count()} lessons, "
            f"{Vocabulary.objects.count()} vocabulary items, "
            f"{GrammarRule.objects.count()} grammar rules, "
            f"{ReadingText.objects.count()} reading texts, "
            f"{Question.objects.count()} questions."
        ))
