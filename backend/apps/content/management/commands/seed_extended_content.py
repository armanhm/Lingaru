"""Seed extended French learning content — Topics 9-20.

12 new topics covering family, nature, technology, emotions, education,
sports, weather, home, arts, politics, environment, and relationships.
Each topic has 3-4 lessons with rich vocab, grammar, reading texts, and questions.
Idempotent: skips any topic whose name_fr already exists.
"""

from django.core.management.base import BaseCommand

from apps.content.models import (
    GrammarRule,
    Lesson,
    Question,
    ReadingText,
    Topic,
    Vocabulary,
)


class Command(BaseCommand):
    help = "Seed 12 extended French topics (9-20) with rich content"

    def _topic_exists(self, name_fr):
        return Topic.objects.filter(name_fr=name_fr).exists()

    def _bulk_vocab(self, lesson, rows):
        for fr, en, pron, ex, gender, pos in rows:
            Vocabulary.objects.create(
                lesson=lesson, french=fr, english=en, pronunciation=pron,
                example_sentence=ex, gender=gender, part_of_speech=pos,
            )

    def _bulk_questions(self, lesson, rows):
        for qtype, prompt, correct, wrong, expl, diff in rows:
            Question.objects.create(
                lesson=lesson, type=qtype, prompt=prompt, correct_answer=correct,
                wrong_answers=wrong, explanation=expl, difficulty=diff,
            )

    # ─────────────────────────────────────────────────────────────────
    # TOPIC 9 — La famille
    # ─────────────────────────────────────────────────────────────────
    def _seed_topic_9(self):
        name_fr = "La famille"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)"); return
        t = Topic.objects.create(
            name_fr=name_fr, name_en="Family & Relationships",
            description="Talk about your family, relatives, and relationships in French.",
            icon="👨‍👩‍👧‍👦", order=9, difficulty_level=1,
        )
        l1 = Lesson.objects.create(topic=t, type="vocab", title="Family Members", order=1, difficulty=1, content={"intro": "Learn the words for family members in French."})
        self._bulk_vocab(l1, [
            ("la famille", "family", "la fa.mij", "Ma famille est grande.", "f", "noun"),
            ("les parents", "parents", "le pa.ʁɑ̃", "Mes parents habitent à Lyon.", "m", "noun"),
            ("le père", "father", "lə pɛʁ", "Mon père travaille dans une banque.", "m", "noun"),
            ("la mère", "mother", "la mɛʁ", "Ma mère est médecin.", "f", "noun"),
            ("le frère", "brother", "lə fʁɛʁ", "Mon frère s'appelle Thomas.", "m", "noun"),
            ("la sœur", "sister", "la sœʁ", "Ma sœur étudie la musique.", "f", "noun"),
            ("le fils", "son", "lə fis", "Leur fils a dix ans.", "m", "noun"),
            ("la fille", "daughter", "la fij", "Leur fille est très intelligente.", "f", "noun"),
            ("le mari", "husband", "lə ma.ʁi", "Son mari est architecte.", "m", "noun"),
            ("la femme", "wife/woman", "la fam", "Sa femme est avocate.", "f", "noun"),
            ("le grand-père", "grandfather", "lə ɡʁɑ̃.pɛʁ", "Mon grand-père a quatre-vingts ans.", "m", "noun"),
            ("la grand-mère", "grandmother", "la ɡʁɑ̃.mɛʁ", "Ma grand-mère fait de la bonne cuisine.", "f", "noun"),
            ("l'oncle", "uncle", "lɔ̃.klə", "Mon oncle habite en Belgique.", "m", "noun"),
            ("la tante", "aunt", "la tɑ̃t", "Ma tante est très gentille.", "f", "noun"),
            ("le cousin / la cousine", "cousin (m/f)", "lə ku.zɛ̃ / la ku.zin", "Mon cousin joue au foot.", "m", "noun"),
        ])
        l2 = Lesson.objects.create(topic=t, type="grammar", title="Possessive Adjectives", order=2, difficulty=1, content={})
        GrammarRule.objects.create(
            lesson=l2, title="Possessive Adjectives (mon, ma, mes…)",
            explanation="French possessive adjectives agree with the gender and number of the **noun they describe**, not the owner.\n\n| Owner | Masculine | Feminine | Plural |\n|-------|-----------|----------|--------|\n| je | **mon** | **ma** | **mes** |\n| tu | **ton** | **ta** | **tes** |\n| il/elle | **son** | **sa** | **ses** |\n| nous | **notre** | **notre** | **nos** |\n| vous | **votre** | **votre** | **vos** |\n| ils/elles | **leur** | **leur** | **leurs** |\n\n⚠️ Before a feminine noun starting with a vowel, use **mon/ton/son**: *mon amie* (not ~~ma amie~~).",
            formula="[possessive adj.] + [noun]",
            examples=["Mon père est médecin.", "Ma sœur habite à Paris.", "Mes enfants jouent dans le jardin.", "Notre maison est grande.", "Leurs parents sont professeurs."],
            exceptions=["Use mon/ton/son before feminine nouns starting with a vowel sound: mon école, ton amie, son histoire."],
        )
        l3 = Lesson.objects.create(topic=t, type="text", title="Une famille française", order=3, difficulty=1, content={})
        ReadingText.objects.create(
            lesson=l3, title="Présentation de famille",
            content_fr="Bonjour ! Je m'appelle Sophie. J'ai une grande famille. Mon père s'appelle Jean-Pierre et ma mère s'appelle Marie. J'ai deux frères : Léo et Hugo. Ma sœur s'appelle Camille. Mes grands-parents habitent à la campagne. Mon grand-père a un jardin magnifique et ma grand-mère fait les meilleurs gâteaux du monde. Je les adore !",
            content_en="Hello! My name is Sophie. I have a big family. My father's name is Jean-Pierre and my mother's name is Marie. I have two brothers: Léo and Hugo. My sister's name is Camille. My grandparents live in the countryside. My grandfather has a beautiful garden and my grandmother makes the best cakes in the world. I love them!",
            vocabulary_highlights=["grand famille", "grands-parents", "la campagne"],
            comprehension_questions=[
                {"question": "How many siblings does Sophie have?", "answer": "Three — two brothers (Léo and Hugo) and one sister (Camille)."},
                {"question": "Where do the grandparents live?", "answer": "In the countryside (à la campagne)."},
            ],
        )
        self._bulk_questions(l1, [
            ("mcq", "How do you say 'grandmother' in French?", "la grand-mère", ["le grand-père", "la mère", "la tante"], "Grand-mère means grandmother.", 1),
            ("translate", "Translate: 'My sister studies music.'", "Ma sœur étudie la musique.", [], "Use 'Ma' for feminine noun sœur.", 1),
            ("fill_blank", "Mon ___ s'appelle Thomas. (brother)", "frère", ["père", "oncle", "fils"], "Frère = brother.", 1),
            ("mcq", "Which possessive adjective is used for 'my' before a feminine noun?", "ma", ["mon", "mes", "sa"], "Ma is used before feminine singular nouns.", 1),
        ])
        self.stdout.write(f"  Created '{name_fr}'")

    # ─────────────────────────────────────────────────────────────────
    # TOPIC 10 — La nature et l'environnement
    # ─────────────────────────────────────────────────────────────────
    def _seed_topic_10(self):
        name_fr = "La nature et l'environnement"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)"); return
        t = Topic.objects.create(
            name_fr=name_fr, name_en="Nature & Environment",
            description="Discover vocabulary about nature, animals, and environmental issues.",
            icon="🌿", order=10, difficulty_level=2,
        )
        l1 = Lesson.objects.create(topic=t, type="vocab", title="Nature Vocabulary", order=1, difficulty=2, content={"intro": "Learn words about nature and the environment."})
        self._bulk_vocab(l1, [
            ("la forêt", "forest", "la fɔ.ʁɛ", "La forêt amazonienne est immense.", "f", "noun"),
            ("la montagne", "mountain", "la mɔ̃.taɲ", "J'adore faire de la randonnée en montagne.", "f", "noun"),
            ("la rivière", "river", "la ʁi.vjɛʁ", "Les enfants jouent au bord de la rivière.", "f", "noun"),
            ("l'océan", "ocean", "lɔ.se.ɑ̃", "L'océan Atlantique est très profond.", "m", "noun"),
            ("le désert", "desert", "lə de.zɛʁ", "Le Sahara est le plus grand désert du monde.", "m", "noun"),
            ("la plage", "beach", "la plaʒ", "Nous passons nos vacances à la plage.", "f", "noun"),
            ("l'arbre", "tree", "laʁbʁ", "Cet arbre a cent ans.", "m", "noun"),
            ("la fleur", "flower", "la flœʁ", "Les fleurs du jardin sont magnifiques.", "f", "noun"),
            ("l'animal", "animal", "la.ni.mal", "Quel est ton animal préféré ?", "m", "noun"),
            ("l'oiseau", "bird", "lwa.zo", "Les oiseaux chantent le matin.", "m", "noun"),
            ("le réchauffement climatique", "global warming", "lə ʁe.ʃof.mɑ̃ kli.ma.tik", "Le réchauffement climatique est un problème mondial.", "m", "noun"),
            ("recycler", "to recycle", "ʁe.si.kle", "Il faut recycler le papier et le verre.", "a", "verb"),
            ("la pollution", "pollution", "la pɔ.ly.sjɔ̃", "La pollution de l'air est dangereuse.", "f", "noun"),
            ("la biodiversité", "biodiversity", "la bio.di.vɛʁ.si.te", "Il faut protéger la biodiversité.", "f", "noun"),
            ("durable", "sustainable", "dy.ʁabl", "Le développement durable est essentiel.", "a", "adjective"),
        ])
        l2 = Lesson.objects.create(topic=t, type="grammar", title="The Present Participle", order=2, difficulty=2, content={})
        GrammarRule.objects.create(
            lesson=l2, title="Present Participle (le gérondif)",
            explanation="The present participle is formed by taking the **nous** form of the present tense, removing **-ons**, and adding **-ant**.\n\nIt is used with **en** to express simultaneous actions or manner:\n- *En marchant*, j'écoute de la musique. (While walking, I listen to music.)\n- Elle chante **en cuisinant**. (She sings while cooking.)\n\nIt can also express cause:\n- *En travaillant dur*, il a réussi. (By working hard, he succeeded.)",
            formula="en + [verb stem (nous-ons)] + ant",
            examples=["En regardant par la fenêtre, il a vu un cerf.", "Elle apprend le français en écoutant des podcasts.", "En recyclant, on protège la planète.", "Je me suis blessé en courant."],
            exceptions=["Irregular: être → étant, avoir → ayant, savoir → sachant"],
        )
        l3 = Lesson.objects.create(topic=t, type="text", title="Protéger la nature", order=3, difficulty=2, content={})
        ReadingText.objects.create(
            lesson=l3, title="Un monde plus vert",
            content_fr="Aujourd'hui, protéger l'environnement est plus important que jamais. Le réchauffement climatique menace les forêts, les océans et des milliers d'espèces animales. En France, de nombreuses associations sensibilisent les citoyens aux problèmes écologiques. On peut agir au quotidien : recycler ses déchets, utiliser les transports en commun, manger moins de viande et planter des arbres. Chaque geste compte pour préserver notre planète.",
            content_en="Today, protecting the environment is more important than ever. Global warming threatens forests, oceans, and thousands of animal species. In France, many associations raise citizen awareness about ecological issues. We can act daily: recycling waste, using public transport, eating less meat, and planting trees. Every action counts to preserve our planet.",
            vocabulary_highlights=["réchauffement climatique", "espèces animales", "transports en commun"],
            comprehension_questions=[
                {"question": "Name three everyday actions mentioned to help the environment.", "answer": "Recycling, using public transport, eating less meat (or planting trees)."},
                {"question": "What does global warming threaten?", "answer": "Forests, oceans, and thousands of animal species."},
            ],
        )
        self._bulk_questions(l1, [
            ("mcq", "What is 'la forêt' in English?", "forest", ["mountain", "beach", "desert"], "La forêt = forest.", 1),
            ("translate", "Translate: 'Global warming is a worldwide problem.'", "Le réchauffement climatique est un problème mondial.", [], "Use le réchauffement climatique.", 2),
            ("fill_blank", "Il faut ___ le papier et le verre. (recycle)", "recycler", ["polluer", "acheter", "oublier"], "Recycler = to recycle.", 2),
            ("mcq", "How is the present participle formed?", "nous form minus -ons + -ant", ["infinitive + -ant", "past participle + -ant", "vous form + -ant"], "Remove -ons from nous form and add -ant.", 2),
        ])
        self.stdout.write(f"  Created '{name_fr}'")

    # ─────────────────────────────────────────────────────────────────
    # TOPIC 11 — La technologie
    # ─────────────────────────────────────────────────────────────────
    def _seed_topic_11(self):
        name_fr = "La technologie"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)"); return
        t = Topic.objects.create(
            name_fr=name_fr, name_en="Technology & Digital Life",
            description="Vocabulary for talking about computers, the internet, and modern technology.",
            icon="💻", order=11, difficulty_level=2,
        )
        l1 = Lesson.objects.create(topic=t, type="vocab", title="Technology Vocabulary", order=1, difficulty=2, content={"intro": "Essential tech vocab in French."})
        self._bulk_vocab(l1, [
            ("l'ordinateur", "computer", "lɔʁ.di.na.tœʁ", "Mon ordinateur est lent aujourd'hui.", "m", "noun"),
            ("le téléphone portable", "mobile phone", "lə te.le.fɔn pɔʁ.tabl", "J'ai oublié mon téléphone portable à la maison.", "m", "noun"),
            ("internet", "internet", "ɛ̃.tɛʁ.nɛt", "Je fais mes recherches sur internet.", "m", "noun"),
            ("le mot de passe", "password", "lə mo də pas", "N'oublie pas ton mot de passe.", "m", "noun"),
            ("télécharger", "to download", "te.le.ʃaʁ.ʒe", "J'ai téléchargé l'application.", "a", "verb"),
            ("envoyer un e-mail", "to send an email", "ɑ̃.vwa.je œ̃ i.mɛl", "Je t'ai envoyé un e-mail ce matin.", "a", "verb"),
            ("les réseaux sociaux", "social networks", "le ʁe.zo sɔ.sjo", "Les réseaux sociaux sont très populaires.", "m", "noun"),
            ("l'intelligence artificielle", "artificial intelligence", "lɛ̃.tɛ.li.ʒɑ̃s aʁ.ti.fi.sjɛl", "L'intelligence artificielle transforme notre société.", "f", "noun"),
            ("la batterie", "battery", "la ba.tʁi", "La batterie de mon téléphone est déchargée.", "f", "noun"),
            ("le nuage (cloud)", "cloud", "lə nɥaʒ", "Je sauvegarde mes fichiers dans le nuage.", "m", "noun"),
            ("pirater", "to hack", "pi.ʁa.te", "Des hackers ont piraté le site.", "a", "verb"),
            ("l'application", "app", "la.pli.ka.sjɔ̃", "Cette application est très utile.", "f", "noun"),
            ("le réseau", "network", "lə ʁe.zo", "Le réseau wifi est lent.", "m", "noun"),
            ("brancher", "to plug in", "bʁɑ̃.ʃe", "Branche le chargeur, s'il te plaît.", "a", "verb"),
            ("la cybersécurité", "cybersecurity", "la si.bɛʁ.se.ky.ʁi.te", "La cybersécurité est cruciale pour les entreprises.", "f", "noun"),
        ])
        l2 = Lesson.objects.create(topic=t, type="grammar", title="The Future Tense", order=2, difficulty=2, content={})
        GrammarRule.objects.create(
            lesson=l2, title="Futur Simple — The Simple Future",
            explanation="The **futur simple** expresses future actions. It is formed by adding future endings to the infinitive (for -ER and -IR verbs) or a special stem (for -RE verbs, drop the final -e).\n\n**Endings:** -ai, -as, -a, -ons, -ez, -ont\n\n| Pronoun | parler | finir | prendre |\n|---------|--------|-------|---------|\n| je | parler**ai** | finir**ai** | prendr**ai** |\n| tu | parler**as** | finir**as** | prendr**as** |\n| il/elle | parler**a** | finir**a** | prendr**a** |\n| nous | parler**ons** | finir**ons** | prendr**ons** |\n| vous | parler**ez** | finir**ez** | prendr**ez** |\n| ils/elles | parler**ont** | finir**ont** | prendr**ont** |",
            formula="infinitive (or irregular stem) + future ending",
            examples=["Demain, je travaillerai de chez moi.", "La technologie changera notre façon de vivre.", "Ils achèteront un nouvel ordinateur.", "Nous parlerons au directeur vendredi."],
            exceptions=["Common irregular stems: être→ser-, avoir→aur-, aller→ir-, faire→fer-, pouvoir→pourr-, vouloir→voudr-, venir→viendr-"],
        )
        l3 = Lesson.objects.create(topic=t, type="text", title="La vie numérique", order=3, difficulty=2, content={})
        ReadingText.objects.create(
            lesson=l3, title="Notre quotidien connecté",
            content_fr="La technologie fait partie de notre vie quotidienne. Le matin, nous consultons nos téléphones pour vérifier les nouvelles et les réseaux sociaux. Au travail, nous envoyons des e-mails et participons à des réunions en visioconférence. Les applications nous aident à nous organiser, à apprendre et même à faire nos achats. Cependant, il est important de déconnecter parfois pour protéger notre santé mentale. L'avenir sera encore plus connecté avec l'intelligence artificielle.",
            content_en="Technology is part of our daily lives. In the morning, we check our phones for news and social media. At work, we send emails and participate in video conference meetings. Apps help us organise ourselves, learn, and even shop. However, it's important to disconnect sometimes to protect our mental health. The future will be even more connected with artificial intelligence.",
            vocabulary_highlights=["visioconférence", "déconnecter", "santé mentale"],
            comprehension_questions=[
                {"question": "What do people check first thing in the morning?", "answer": "Their phones for news and social media."},
                {"question": "Why is it important to disconnect sometimes?", "answer": "To protect mental health."},
            ],
        )
        self._bulk_questions(l1, [
            ("mcq", "How do you say 'to download' in French?", "télécharger", ["brancher", "pirater", "envoyer"], "Télécharger = to download.", 1),
            ("translate", "Translate: 'My phone battery is dead.'", "La batterie de mon téléphone est déchargée.", [], "Use batterie and déchargée.", 2),
            ("mcq", "Which future stem is used for 'être'?", "ser-", ["êtr-", "est-", "ét-"], "Être has the irregular future stem ser-.", 2),
            ("fill_blank", "Demain, je ___ de chez moi. (travailler, futur)", "travaillerai", ["travaille", "travaillais", "travaillé"], "Future of travailler = travaillerai.", 2),
        ])
        self.stdout.write(f"  Created '{name_fr}'")

    # ─────────────────────────────────────────────────────────────────
    # TOPIC 12 — Les émotions et les sentiments
    # ─────────────────────────────────────────────────────────────────
    def _seed_topic_12(self):
        name_fr = "Les émotions et les sentiments"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)"); return
        t = Topic.objects.create(
            name_fr=name_fr, name_en="Emotions & Feelings",
            description="Express how you feel in French with rich emotional vocabulary.",
            icon="❤️", order=12, difficulty_level=1,
        )
        l1 = Lesson.objects.create(topic=t, type="vocab", title="Emotions Vocabulary", order=1, difficulty=1, content={"intro": "Words to express your feelings in French."})
        self._bulk_vocab(l1, [
            ("heureux / heureuse", "happy", "ø.ʁø / ø.ʁøz", "Je suis très heureuse aujourd'hui.", "a", "adjective"),
            ("triste", "sad", "tʁist", "Elle est triste depuis hier.", "a", "adjective"),
            ("en colère", "angry", "ɑ̃ kɔ.lɛʁ", "Il est en colère contre son frère.", "a", "adjective"),
            ("fatigué(e)", "tired", "fa.ti.ɡe", "Je suis fatigué après cette longue journée.", "a", "adjective"),
            ("inquiet / inquiète", "worried", "ɛ̃.kjɛ / ɛ̃.kjɛt", "Ma mère est inquiète pour moi.", "a", "adjective"),
            ("surpris(e)", "surprised", "syʁ.pʁi / syʁ.pʁiz", "J'étais très surpris de te voir ici.", "a", "adjective"),
            ("amoureux / amoureuse", "in love", "a.mu.ʁø / a.mu.ʁøz", "Il est amoureux de Marie.", "a", "adjective"),
            ("jaloux / jalouse", "jealous", "ʒa.lu / ʒa.luz", "Elle est jalouse de sa sœur.", "a", "adjective"),
            ("fier / fière", "proud", "fjɛʁ / fjɛʁ", "Je suis fier de toi.", "a", "adjective"),
            ("soulagé(e)", "relieved", "su.la.ʒe", "Je suis soulagé que tout aille bien.", "a", "adjective"),
            ("avoir peur", "to be scared", "a.vwaʁ pœʁ", "J'ai peur des araignées.", "a", "verb phrase"),
            ("s'ennuyer", "to be bored", "sɑ̃.nɥi.je", "Je m'ennuie pendant ce cours.", "a", "verb"),
            ("se sentir bien", "to feel good", "sə sɑ̃.tiʁ bjɛ̃", "Je me sens très bien ce matin.", "a", "verb phrase"),
            ("pleurer", "to cry", "plø.ʁe", "Elle a pleuré pendant le film.", "a", "verb"),
            ("rire", "to laugh", "ʁiʁ", "Nous avons beaucoup ri.", "a", "verb"),
        ])
        l2 = Lesson.objects.create(topic=t, type="grammar", title="Adjective Agreement", order=2, difficulty=1, content={})
        GrammarRule.objects.create(
            lesson=l2, title="Adjective Agreement in Gender and Number",
            explanation="In French, adjectives must agree in **gender** (masculine/feminine) and **number** (singular/plural) with the noun they describe.\n\n**Rules:**\n- Add **-e** for feminine: *heureux → heureuse*, *fatigué → fatiguée*\n- Add **-s** for masculine plural: *heureux → heureux* (already ends in -x), *fatigué → fatigués*\n- Add **-es** for feminine plural: *heureuse → heureuses*\n\n**Irregular patterns:**\n- **-eux → -euse**: heureux/heureuse, jaloux/jalouse\n- **-er → -ère**: fier/fière, léger/légère\n- **-et → -ète**: inquiet/inquiète\n- Some adjectives are invariable: *sympa, marron, orange*",
            formula="[noun] + [adjective matching gender and number]",
            examples=["Il est heureux. Elle est heureuse.", "Ils sont fatigués. Elles sont fatiguées.", "Mon frère est fier. Ma sœur est fière.", "Les enfants sont contents."],
            exceptions=["Invariable adjectives (no change): sympa, marron, orange, chic, super"],
        )
        l3 = Lesson.objects.create(topic=t, type="text", title="Journal intime", order=3, difficulty=1, content={})
        ReadingText.objects.create(
            lesson=l3, title="Les émotions d'une journée",
            content_fr="Cher journal, aujourd'hui a été une journée de montagnes russes émotionnelles. Ce matin, j'étais heureuse parce que j'ai reçu de bonnes nouvelles au travail. Mais ensuite, j'ai appris que mon meilleur ami déménage à l'étranger. J'étais très triste et inquiète. L'après-midi, ma famille m'a fait une surprise d'anniversaire ! J'étais tellement surprise et émue que j'ai pleuré de joie. Ce soir, je me sens soulagée et reconnaissante. Les émotions font partie de la vie.",
            content_en="Dear diary, today was an emotional rollercoaster. This morning, I was happy because I received good news at work. But then I learned that my best friend is moving abroad. I was very sad and worried. In the afternoon, my family threw me a surprise birthday party! I was so surprised and moved that I cried with joy. Tonight, I feel relieved and grateful. Emotions are part of life.",
            vocabulary_highlights=["montagnes russes", "déménager", "émue", "reconnaissante"],
            comprehension_questions=[
                {"question": "Why was the writer happy in the morning?", "answer": "She received good news at work."},
                {"question": "What made her cry?", "answer": "The surprise birthday party — she cried with joy."},
            ],
        )
        self._bulk_questions(l1, [
            ("mcq", "How do you say 'I am worried' in French?", "Je suis inquiet/inquiète", ["Je suis triste", "J'ai peur", "Je suis fier"], "Inquiet(e) = worried.", 1),
            ("translate", "Translate: 'She is proud of her son.'", "Elle est fière de son fils.", [], "Fier becomes fière for feminine.", 1),
            ("fill_blank", "Il est très ___ après la longue journée. (tired)", "fatigué", ["heureux", "triste", "jaloux"], "Fatigué = tired (masculine form).", 1),
            ("mcq", "What is the feminine form of 'jaloux'?", "jalouse", ["jalouxe", "jalouse", "jalousse"], "Jaloux → jalouse follows -eux/-euse pattern.", 1),
        ])
        self.stdout.write(f"  Created '{name_fr}'")

    # ─────────────────────────────────────────────────────────────────
    # TOPIC 13 — L'éducation et les études
    # ─────────────────────────────────────────────────────────────────
    def _seed_topic_13(self):
        name_fr = "L'éducation et les études"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)"); return
        t = Topic.objects.create(
            name_fr=name_fr, name_en="Education & Studies",
            description="Vocabulary and grammar for talking about school, university, and learning.",
            icon="📚", order=13, difficulty_level=2,
        )
        l1 = Lesson.objects.create(topic=t, type="vocab", title="Education Vocabulary", order=1, difficulty=1, content={"intro": "Essential vocabulary for school and university life."})
        self._bulk_vocab(l1, [
            ("l'école", "school", "le.kɔl", "Les enfants vont à l'école le lundi.", "f", "noun"),
            ("le lycée", "high school", "lə li.se", "Elle est en terminale au lycée.", "m", "noun"),
            ("l'université", "university", "ly.ni.vɛʁ.si.te", "Il étudie à l'université de Paris.", "f", "noun"),
            ("le cours", "class/lesson", "lə kuʁ", "Le cours de maths commence à 8h.", "m", "noun"),
            ("l'examen", "exam", "lɛɡ.za.mɛ̃", "J'ai passé mon examen hier.", "m", "noun"),
            ("les devoirs", "homework", "le də.vwaʁ", "Je dois faire mes devoirs ce soir.", "m", "noun"),
            ("la note", "grade/mark", "la nɔt", "J'ai eu une bonne note en français.", "f", "noun"),
            ("le professeur", "teacher/professor", "lə pʁɔ.fɛ.sœʁ", "Notre professeur est très pédagogue.", "m", "noun"),
            ("étudier", "to study", "e.ty.dje", "J'étudie le français depuis deux ans.", "a", "verb"),
            ("apprendre", "to learn", "a.pʁɑ̃dʁ", "J'apprends quelque chose de nouveau chaque jour.", "a", "verb"),
            ("le diplôme", "degree/diploma", "lə di.plom", "Elle a obtenu son diplôme en juin.", "m", "noun"),
            ("la bourse", "scholarship", "la buʁs", "Il a reçu une bourse d'études.", "f", "noun"),
            ("la bibliothèque", "library", "la bi.bljɔ.tɛk", "Je travaille à la bibliothèque tous les matins.", "f", "noun"),
            ("l'amphithéâtre", "lecture hall", "lɑ̃.fi.te.ɑtʁ", "Le cours a lieu dans un amphithéâtre.", "m", "noun"),
            ("réussir", "to succeed/pass", "ʁe.y.siʁ", "J'espère réussir à mon examen.", "a", "verb"),
        ])
        l2 = Lesson.objects.create(topic=t, type="grammar", title="The Conditional Tense", order=2, difficulty=2, content={})
        GrammarRule.objects.create(
            lesson=l2, title="Le Conditionnel Présent",
            explanation="The **conditional** expresses what would happen under certain conditions, polite requests, or hypothetical situations.\n\n**Formation:** same stems as the future tense + imperfect endings (-ais, -ais, -ait, -ions, -iez, -aient)\n\n| Pronoun | parler | finir | être |\n|---------|--------|-------|------|\n| je | parler**ais** | finir**ais** | ser**ais** |\n| tu | parler**ais** | finir**ais** | ser**ais** |\n| il/elle | parler**ait** | finir**ait** | ser**ait** |\n| nous | parler**ions** | finir**ions** | ser**ions** |\n| vous | parler**iez** | finir**iez** | ser**iez** |\n| ils | parler**aient** | finir**aient** | ser**aient** |\n\n**Uses:**\n1. Polite requests: *Je voudrais un café.*\n2. Hypothetical: *Si j'avais le temps, j'étudierais plus.*\n3. Reported speech: *Il a dit qu'il viendrait.*",
            formula="future stem + imperfect ending (-ais, -ais, -ait, -ions, -iez, -aient)",
            examples=["Je voudrais étudier la médecine.", "Si j'étais riche, je voyagerais partout.", "Elle a dit qu'elle passerait l'examen.", "Nous aimerions apprendre le mandarin."],
            exceptions=["Same irregular stems as futur simple: être→ser-, avoir→aur-, aller→ir-, faire→fer-"],
        )
        l3 = Lesson.objects.create(topic=t, type="text", title="La vie étudiante", order=3, difficulty=2, content={})
        ReadingText.objects.create(
            lesson=l3, title="Un étudiant à Paris",
            content_fr="Mathieu est étudiant en première année de droit à l'Université Paris I. Sa journée commence tôt : il assiste à des cours en amphithéâtre le matin, puis il travaille à la bibliothèque l'après-midi. Les examens approchent et il est un peu stressé. Sa professeure lui a conseillé de faire des fiches de révision. Le soir, il se détend avec ses amis à la cafétéria. Il voudrait obtenir son diplôme dans trois ans et devenir avocat.",
            content_en="Mathieu is a first-year law student at Paris I University. His day starts early: he attends lectures in the morning, then works at the library in the afternoon. Exams are approaching and he is a bit stressed. His professor advised him to make revision cards. In the evening, he relaxes with friends at the cafeteria. He would like to get his degree in three years and become a lawyer.",
            vocabulary_highlights=["première année de droit", "fiches de révision", "se détendre"],
            comprehension_questions=[
                {"question": "What subject does Mathieu study?", "answer": "Law (droit)."},
                {"question": "What does his professor advise him to do?", "answer": "Make revision cards (fiches de révision)."},
            ],
        )
        self._bulk_questions(l1, [
            ("mcq", "What is 'la bibliothèque' in English?", "library", ["bookstore", "classroom", "office"], "Bibliothèque = library.", 1),
            ("translate", "Translate: 'I would like to study medicine.'", "Je voudrais étudier la médecine.", [], "Use the conditional voudrais.", 2),
            ("fill_blank", "Si j'avais le temps, j'___ plus. (étudier, conditional)", "étudierais", ["étudie", "étudiai", "étudierai"], "Conditional of étudier = étudierais.", 2),
            ("mcq", "What is the conditional used for?", "All of the above", ["Polite requests", "Hypothetical situations", "Reported speech"], "The conditional has multiple uses.", 2),
        ])
        self.stdout.write(f"  Created '{name_fr}'")

    # ─────────────────────────────────────────────────────────────────
    # TOPIC 14 — Le sport et le corps
    # ─────────────────────────────────────────────────────────────────
    def _seed_topic_14(self):
        name_fr = "Le sport et le corps"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)"); return
        t = Topic.objects.create(
            name_fr=name_fr, name_en="Sports & Body",
            description="Learn vocabulary for sports, physical activities, and parts of the body.",
            icon="⚽", order=14, difficulty_level=1,
        )
        l1 = Lesson.objects.create(topic=t, type="vocab", title="Sports & Body Vocabulary", order=1, difficulty=1, content={"intro": "Sports and body vocabulary in French."})
        self._bulk_vocab(l1, [
            ("jouer au foot", "to play football", "ʒwe o fut", "Il joue au foot tous les dimanches.", "a", "verb phrase"),
            ("nager", "to swim", "na.ʒe", "Elle nage très bien.", "a", "verb"),
            ("courir", "to run", "ku.ʁiʁ", "Je cours cinq kilomètres chaque matin.", "a", "verb"),
            ("faire du vélo", "to cycle", "fɛʁ dy ve.lo", "Nous faisons du vélo le week-end.", "a", "verb phrase"),
            ("la salle de sport", "gym", "la sal də spɔʁ", "Je vais à la salle de sport trois fois par semaine.", "f", "noun"),
            ("le match", "match/game", "lə matʃ", "Le match de tennis a duré trois heures.", "m", "noun"),
            ("gagner", "to win", "ɡa.ɲe", "Notre équipe a gagné le tournoi.", "a", "verb"),
            ("perdre", "to lose", "pɛʁdʁ", "Nous avons perdu le match hier.", "a", "verb"),
            ("la tête", "head", "la tɛt", "Il a mal à la tête.", "f", "noun"),
            ("le bras", "arm", "lə bʁa", "Je me suis blessé le bras.", "m", "noun"),
            ("la jambe", "leg", "la ʒɑ̃b", "Elle a mal à la jambe gauche.", "f", "noun"),
            ("le dos", "back", "lə do", "J'ai mal au dos après le sport.", "m", "noun"),
            ("blessé(e)", "injured", "ble.se", "Le joueur est blessé et ne peut pas jouer.", "a", "adjective"),
            ("s'entraîner", "to train/practise", "sɑ̃.tʁɛ.ne", "L'équipe s'entraîne deux fois par semaine.", "a", "verb"),
            ("le championnat", "championship", "lə ʃɑ̃.pjɔ.na", "La France a gagné le championnat du monde.", "m", "noun"),
        ])
        l2 = Lesson.objects.create(topic=t, type="grammar", title="Reflexive Verbs", order=2, difficulty=2, content={})
        GrammarRule.objects.create(
            lesson=l2, title="Reflexive Verbs (les verbes pronominaux)",
            explanation="Reflexive verbs use a **reflexive pronoun** (me, te, se, nous, vous, se) that refers back to the subject. They are very common in French for daily routines and physical actions.\n\n**Conjugation of se lever (to get up):**\n- Je **me** lève\n- Tu **te** lèves\n- Il/Elle **se** lève\n- Nous **nous** levons\n- Vous **vous** levez\n- Ils/Elles **se** lèvent\n\n**In the negative:** Je **ne me** lève **pas** tôt.\n**In the passé composé:** always use **être** as auxiliary, and the past participle agrees with the subject:\n- Elle **s'est blessée** au genou.",
            formula="[subject] + [reflexive pronoun] + [verb]",
            examples=["Je me lève à sept heures.", "Elle se douche après le sport.", "Nous nous entraînons le samedi.", "Il s'est blessé pendant le match.", "Tu te couches à quelle heure ?"],
            exceptions=["In compound tenses, the past participle agrees with the subject: Elles se sont levées tôt."],
        )
        l3 = Lesson.objects.create(topic=t, type="text", title="Le sport en France", order=3, difficulty=1, content={})
        ReadingText.objects.create(
            lesson=l3, title="Les Français et le sport",
            content_fr="Le sport occupe une place importante dans la vie des Français. Le football est le sport le plus populaire : des millions de personnes regardent les matchs à la télévision et des centaines de milliers jouent dans des clubs amateurs. Le cyclisme est aussi très apprécié, notamment grâce au Tour de France, la course la plus célèbre du monde. La pétanque reste un jeu traditionnel pratiqué dans tout le pays. Aujourd'hui, de plus en plus de Français vont à la salle de sport ou font du yoga pour rester en forme.",
            content_en="Sport plays an important role in French life. Football is the most popular sport: millions of people watch matches on TV and hundreds of thousands play in amateur clubs. Cycling is also very popular, especially thanks to the Tour de France, the most famous race in the world. Pétanque remains a traditional game played throughout the country. Today, more and more French people go to the gym or do yoga to stay fit.",
            vocabulary_highlights=["Tour de France", "la pétanque", "rester en forme"],
            comprehension_questions=[
                {"question": "What is the most popular sport in France?", "answer": "Football."},
                {"question": "What is the Tour de France?", "answer": "The most famous cycling race in the world."},
            ],
        )
        self._bulk_questions(l1, [
            ("mcq", "How do you say 'to win' in French?", "gagner", ["perdre", "jouer", "courir"], "Gagner = to win.", 1),
            ("translate", "Translate: 'She injured her leg during the match.'", "Elle s'est blessée à la jambe pendant le match.", [], "Use reflexive se blesser in passé composé.", 2),
            ("fill_blank", "Je ___ à sept heures chaque matin. (se lever)", "me lève", ["me levais", "se lève", "nous levons"], "Je me lève = I get up.", 1),
            ("mcq", "What auxiliary verb is used with reflexive verbs in compound tenses?", "être", ["avoir", "faire", "aller"], "Reflexive verbs always use être in compound tenses.", 2),
        ])
        self.stdout.write(f"  Created '{name_fr}'")

    # ─────────────────────────────────────────────────────────────────
    # TOPIC 15 — La météo et les saisons
    # ─────────────────────────────────────────────────────────────────
    def _seed_topic_15(self):
        name_fr = "La météo et les saisons"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)"); return
        t = Topic.objects.create(
            name_fr=name_fr, name_en="Weather & Seasons",
            description="Talk about weather conditions and the four seasons in French.",
            icon="🌤️", order=15, difficulty_level=1,
        )
        l1 = Lesson.objects.create(topic=t, type="vocab", title="Weather Vocabulary", order=1, difficulty=1, content={"intro": "Describe the weather in French."})
        self._bulk_vocab(l1, [
            ("il fait beau", "the weather is nice", "il fɛ bo", "Il fait beau aujourd'hui, allons au parc !", "a", "expression"),
            ("il pleut", "it is raining", "il plø", "Il pleut depuis ce matin.", "a", "expression"),
            ("il neige", "it is snowing", "il nɛʒ", "Il neige en montagne en décembre.", "a", "expression"),
            ("il fait chaud", "it is hot", "il fɛ ʃo", "Il fait très chaud en été.", "a", "expression"),
            ("il fait froid", "it is cold", "il fɛ fʁwa", "Il fait froid ce soir, mets un manteau.", "a", "expression"),
            ("le soleil", "sun", "lə sɔ.lɛj", "Le soleil se lève à l'est.", "m", "noun"),
            ("le nuage", "cloud", "lə nɥaʒ", "Le ciel est couvert de nuages.", "m", "noun"),
            ("le vent", "wind", "lə vɑ̃", "Il y a beaucoup de vent aujourd'hui.", "m", "noun"),
            ("l'orage", "thunderstorm", "lɔ.ʁaʒ", "Un orage violent a éclaté hier soir.", "m", "noun"),
            ("la neige", "snow", "la nɛʒ", "Les enfants jouent dans la neige.", "f", "noun"),
            ("le printemps", "spring", "lə pʁɛ̃.tɑ̃", "Les fleurs poussent au printemps.", "m", "noun"),
            ("l'été", "summer", "le.te", "Je pars en vacances en été.", "m", "noun"),
            ("l'automne", "autumn", "lo.tɔn", "Les feuilles tombent en automne.", "m", "noun"),
            ("l'hiver", "winter", "li.vɛʁ", "L'hiver est froid dans le nord de la France.", "m", "noun"),
            ("la température", "temperature", "la tɑ̃.pe.ʁa.tyʁ", "La température monte à 35 degrés en juillet.", "f", "noun"),
        ])
        l2 = Lesson.objects.create(topic=t, type="grammar", title="Impersonal Expressions", order=2, difficulty=1, content={})
        GrammarRule.objects.create(
            lesson=l2, title="Impersonal Expressions with 'il'",
            explanation="Weather and many other expressions in French use **il** as an impersonal subject (equivalent to 'it' in English). The verb does not change based on a real subject.\n\n**Common weather expressions:**\n- *Il fait* + adjective: Il fait beau, chaud, froid, mauvais\n- *Il y a* + noun: Il y a du vent, du soleil, un orage, de la neige\n- *Il* + weather verb: Il pleut, il neige, il gèle, il grêle\n\n**Other impersonal expressions:**\n- *Il faut* + infinitive: Il faut étudier. (One must study.)\n- *Il est* + adjective + de + infinitive: Il est important de recycler.\n- *Il s'agit de*: Il s'agit d'un problème sérieux.",
            formula="il + [weather verb/expression]",
            examples=["Il fait beau ce weekend.", "Il y a du vent sur la côte.", "Il pleut tous les jours en novembre.", "Il faut prendre un parapluie.", "Il neige depuis hier matin."],
            exceptions=["Il y a is used for nouns (du soleil, du vent), while il fait is used with adjectives (beau, chaud)."],
        )
        l3 = Lesson.objects.create(topic=t, type="text", title="Les saisons en France", order=3, difficulty=1, content={})
        ReadingText.objects.create(
            lesson=l3, title="Mon saison préférée",
            content_fr="La France a quatre saisons bien distinctes. Au printemps, il fait doux et les fleurs éclosent partout. C'est la saison idéale pour les promenades. En été, il fait chaud et ensoleillé, surtout dans le sud. Les plages sont bondées de touristes. En automne, les feuilles deviennent rouges et dorées, et il commence à pleuvoir plus souvent. L'hiver peut être rigoureux dans les Alpes et les Pyrénées, avec beaucoup de neige — parfait pour le ski. Personnellement, je préfère le printemps : pas trop chaud, pas trop froid !",
            content_en="France has four very distinct seasons. In spring, it is mild and flowers bloom everywhere. It is the ideal season for walks. In summer, it is hot and sunny, especially in the south. The beaches are crowded with tourists. In autumn, the leaves turn red and golden, and it starts to rain more often. Winter can be harsh in the Alps and Pyrenees, with lots of snow — perfect for skiing. Personally, I prefer spring: not too hot, not too cold!",
            vocabulary_highlights=["doux", "ensoleillé", "bondées", "rigoureux"],
            comprehension_questions=[
                {"question": "Which season does the writer prefer and why?", "answer": "Spring — not too hot, not too cold."},
                {"question": "What happens in the Alps in winter?", "answer": "There is lots of snow, perfect for skiing."},
            ],
        )
        self._bulk_questions(l1, [
            ("mcq", "How do you say 'it is snowing' in French?", "il neige", ["il pleut", "il fait froid", "il y a du vent"], "Il neige = it is snowing.", 1),
            ("translate", "Translate: 'It is very hot in summer.'", "Il fait très chaud en été.", [], "Use il fait chaud and en été.", 1),
            ("fill_blank", "Il ___ beaucoup de vent aujourd'hui.", "y a", ["fait", "pleut", "neige"], "Il y a du vent = there is wind.", 1),
            ("mcq", "Which season comes after autumn in French?", "l'hiver", ["le printemps", "l'été", "l'automne"], "Automne → Hiver (winter).", 1),
        ])
        self.stdout.write(f"  Created '{name_fr}'")

    # ─────────────────────────────────────────────────────────────────
    # TOPIC 16 — La maison et le logement
    # ─────────────────────────────────────────────────────────────────
    def _seed_topic_16(self):
        name_fr = "La maison et le logement"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)"); return
        t = Topic.objects.create(
            name_fr=name_fr, name_en="Home & Housing",
            description="Describe your home, furniture, and rooms in French.",
            icon="🏠", order=16, difficulty_level=1,
        )
        l1 = Lesson.objects.create(topic=t, type="vocab", title="Rooms & Furniture", order=1, difficulty=1, content={"intro": "Vocabulary for rooms, furniture, and household items."})
        self._bulk_vocab(l1, [
            ("le salon", "living room", "lə sa.lɔ̃", "Nous regardons la télé dans le salon.", "m", "noun"),
            ("la cuisine", "kitchen", "la kɥi.zin", "Ma mère prépare le dîner dans la cuisine.", "f", "noun"),
            ("la chambre", "bedroom", "la ʃɑ̃bʁ", "Ma chambre est au premier étage.", "f", "noun"),
            ("la salle de bains", "bathroom", "la sal də bɛ̃", "Il y a deux salles de bains dans notre maison.", "f", "noun"),
            ("le canapé", "sofa", "lə ka.na.pe", "Je me repose sur le canapé.", "m", "noun"),
            ("la table", "table", "la tabl", "Mets la table pour le dîner, s'il te plaît.", "f", "noun"),
            ("le lit", "bed", "lə li", "Mon lit est très confortable.", "m", "noun"),
            ("l'armoire", "wardrobe", "laʁ.mwaʁ", "Mes vêtements sont dans l'armoire.", "f", "noun"),
            ("la fenêtre", "window", "la fə.nɛtʁ", "Ouvre la fenêtre, il fait chaud !", "f", "noun"),
            ("le loyer", "rent", "lə lwa.je", "Le loyer de cet appartement est élevé.", "m", "noun"),
            ("déménager", "to move house", "de.me.na.ʒe", "Nous déménageons le mois prochain.", "a", "verb"),
            ("emménager", "to move in", "ɑ̃.me.na.ʒe", "Ils ont emménagé dans leur nouvel appartement.", "a", "verb"),
            ("le propriétaire", "landlord/owner", "lə pʁɔ.pʁje.tɛʁ", "Le propriétaire a réparé le chauffage.", "m", "noun"),
            ("le rez-de-chaussée", "ground floor", "lə ʁe.də.ʃo.se", "L'appartement est au rez-de-chaussée.", "m", "noun"),
            ("l'ascenseur", "elevator/lift", "la.sɑ̃.sœʁ", "L'ascenseur est en panne.", "m", "noun"),
        ])
        l2 = Lesson.objects.create(topic=t, type="grammar", title="Prepositions of Place", order=2, difficulty=1, content={})
        GrammarRule.objects.create(
            lesson=l2, title="Prepositions of Place",
            explanation="Prepositions of place describe where things are located.\n\n| French | English |\n|--------|----------|\n| **dans** | in, inside |\n| **sur** | on |\n| **sous** | under |\n| **devant** | in front of |\n| **derrière** | behind |\n| **entre** | between |\n| **à côté de** | next to |\n| **en face de** | opposite, facing |\n| **près de** | near |\n| **loin de** | far from |\n| **au-dessus de** | above |\n| **au-dessous de** | below |\n\n⚠️ Note: **de + le = du**, **de + les = des**\n- *près du parc*, *à côté des magasins*",
            formula="[noun] + [preposition] + [location]",
            examples=["Le chat est sous la table.", "La bibliothèque est en face de la mairie.", "Ma chambre est à côté de la salle de bains.", "Le supermarché est près du métro.", "Les clés sont sur le canapé."],
            exceptions=["de + le → du: à côté du salon | de + les → des: près des fenêtres"],
        )
        l3 = Lesson.objects.create(topic=t, type="text", title="Chercher un appartement", order=3, difficulty=1, content={})
        ReadingText.objects.create(
            lesson=l3, title="Une petite annonce",
            content_fr="À louer : bel appartement au troisième étage, situé dans le 6e arrondissement de Paris. L'appartement comprend un salon lumineux, une cuisine équipée, deux chambres et une salle de bains. Il y a également un balcon avec vue sur le jardin. Le loyer est de 1 200 euros par mois, charges comprises. L'appartement est proche du métro Saint-Germain-des-Prés et de nombreux commerces. Idéal pour un couple ou une petite famille. Disponible à partir du 1er septembre. Contacter M. Dubois au 06 12 34 56 78.",
            content_en="For rent: beautiful apartment on the third floor, located in the 6th arrondissement of Paris. The apartment includes a bright living room, a fully equipped kitchen, two bedrooms, and a bathroom. There is also a balcony with a view of the garden. Rent is 1,200 euros per month, charges included. The apartment is close to Saint-Germain-des-Prés metro station and many shops. Ideal for a couple or small family. Available from 1 September. Contact Mr Dubois on 06 12 34 56 78.",
            vocabulary_highlights=["charges comprises", "vue sur le jardin", "arrondissement"],
            comprehension_questions=[
                {"question": "How many bedrooms does the apartment have?", "answer": "Two bedrooms."},
                {"question": "What is included in the monthly rent?", "answer": "Charges (charges comprises)."},
            ],
        )
        self._bulk_questions(l1, [
            ("mcq", "What is 'la chambre' in English?", "bedroom", ["kitchen", "bathroom", "living room"], "La chambre = bedroom.", 1),
            ("translate", "Translate: 'The keys are on the sofa.'", "Les clés sont sur le canapé.", [], "Sur = on.", 1),
            ("fill_blank", "Le supermarché est ___ du métro. (near)", "près", ["loin", "devant", "sous"], "Près de = near.", 1),
            ("mcq", "Which contraction is correct: 'near the shops'?", "près des magasins", ["près de les magasins", "près du magasins", "près de magasins"], "de + les = des.", 1),
        ])
        self.stdout.write(f"  Created '{name_fr}'")

    # ─────────────────────────────────────────────────────────────────
    # TOPIC 17 — Les arts et la culture
    # ─────────────────────────────────────────────────────────────────
    def _seed_topic_17(self):
        name_fr = "Les arts et la culture"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)"); return
        t = Topic.objects.create(
            name_fr=name_fr, name_en="Arts & Culture",
            description="Explore vocabulary for music, cinema, literature, and French cultural life.",
            icon="🎨", order=17, difficulty_level=2,
        )
        l1 = Lesson.objects.create(topic=t, type="vocab", title="Arts Vocabulary", order=1, difficulty=2, content={"intro": "Vocabulary for the arts and cultural activities."})
        self._bulk_vocab(l1, [
            ("le tableau", "painting", "lə ta.blo", "Ce tableau est exposé au Louvre.", "m", "noun"),
            ("le musée", "museum", "lə my.ze", "Le musée d'Orsay est magnifique.", "m", "noun"),
            ("le cinéma", "cinema", "lə si.ne.ma", "Nous allons au cinéma ce soir.", "m", "noun"),
            ("le théâtre", "theatre", "lə te.ɑtʁ", "Il joue dans une pièce de théâtre.", "m", "noun"),
            ("la peinture", "painting/paint", "la pɛ̃.tyʁ", "Elle fait de la peinture le week-end.", "f", "noun"),
            ("la sculpture", "sculpture", "la skyl.tyʁ", "La sculpture de Rodin est célèbre.", "f", "noun"),
            ("la littérature", "literature", "la li.te.ʁa.tyʁ", "J'étudie la littérature française au lycée.", "f", "noun"),
            ("le roman", "novel", "lə ʁɔ.mɑ̃", "J'ai lu un roman policier ce week-end.", "m", "noun"),
            ("la musique classique", "classical music", "la my.zik kla.sik", "Ma grand-mère écoute de la musique classique.", "f", "noun"),
            ("l'exposition", "exhibition", "lɛks.po.zi.sjɔ̃", "Il y a une belle exposition au Centre Pompidou.", "f", "noun"),
            ("chef-d'œuvre", "masterpiece", "ʃɛ dœvʁ", "La Joconde est un chef-d'œuvre de Léonard de Vinci.", "m", "noun"),
            ("jouer d'un instrument", "to play an instrument", "ʒwe dœ̃n ɛ̃s.tʁy.mɑ̃", "Elle joue du violon depuis l'âge de cinq ans.", "a", "verb phrase"),
            ("critiquer", "to criticise", "kʁi.ti.ke", "Les journalistes ont critiqué le film.", "a", "verb"),
            ("l'acteur / l'actrice", "actor / actress", "lak.tœʁ / lak.tʁis", "Cet acteur est très talentueux.", "m", "noun"),
            ("le patrimoine", "heritage", "lə pa.tʁi.mwan", "Le patrimoine culturel français est immense.", "m", "noun"),
        ])
        l2 = Lesson.objects.create(topic=t, type="grammar", title="Relative Pronouns", order=2, difficulty=3, content={})
        GrammarRule.objects.create(
            lesson=l2, title="Relative Pronouns: qui, que, dont, où",
            explanation="Relative pronouns link clauses and replace a noun.\n\n| Pronoun | Role | Example |\n|---------|------|---------|\n| **qui** | subject | L'artiste **qui** a peint ce tableau est célèbre. |\n| **que/qu'** | direct object | Le film **que** j'ai vu était excellent. |\n| **dont** | replaces de + noun | Le musée **dont** je te parle est à Paris. |\n| **où** | place or time | La salle **où** nous sommes est magnifique. |\n\n**Qui** is always followed by a verb.\n**Que/qu'** is followed by a subject + verb.\n**Dont** replaces *de + [noun]* — use with verbs like *parler de, avoir besoin de, se souvenir de*.",
            formula="[main clause] + [qui/que/dont/où] + [subordinate clause]",
            examples=["Le roman que je lis est passionnant.", "L'artiste qui expose ici est très connu.", "C'est le film dont tout le monde parle.", "Voici le théâtre où nous avons vu Molière.", "La peinture dont j'ai besoin est très chère."],
            exceptions=["Que becomes qu' before a vowel or silent h: le film qu'il a réalisé."],
        )
        l3 = Lesson.objects.create(topic=t, type="text", title="La culture française", order=3, difficulty=2, content={})
        ReadingText.objects.create(
            lesson=l3, title="Paris, capitale culturelle",
            content_fr="Paris est considérée comme la capitale culturelle du monde. Chaque année, des millions de touristes viennent visiter le Louvre, qui abrite la Joconde de Léonard de Vinci. Le Centre Pompidou présente des expositions d'art moderne. Le théâtre est aussi très populaire : la Comédie-Française, fondée en 1680, est la plus ancienne compagnie théâtrale nationale du monde. La France a donné au monde de grands écrivains comme Molière, Victor Hugo et Albert Camus, dont les œuvres sont étudiées dans le monde entier.",
            content_en="Paris is considered the cultural capital of the world. Every year, millions of tourists come to visit the Louvre, which houses the Mona Lisa by Leonardo da Vinci. The Centre Pompidou presents modern art exhibitions. Theatre is also very popular: the Comédie-Française, founded in 1680, is the oldest national theatre company in the world. France has given the world great writers such as Molière, Victor Hugo, and Albert Camus, whose works are studied worldwide.",
            vocabulary_highlights=["abrite", "Comédie-Française", "œuvres"],
            comprehension_questions=[
                {"question": "When was the Comédie-Française founded?", "answer": "In 1680."},
                {"question": "Name two famous French writers mentioned in the text.", "answer": "Any two from: Molière, Victor Hugo, Albert Camus."},
            ],
        )
        self._bulk_questions(l1, [
            ("mcq", "What is 'un chef-d'œuvre' in English?", "a masterpiece", ["a painting", "an exhibition", "an actor"], "Chef-d'œuvre = masterpiece.", 2),
            ("translate", "Translate: 'The film that I watched was excellent.'", "Le film que j'ai regardé était excellent.", [], "Use que as direct object relative pronoun.", 3),
            ("fill_blank", "C'est l'artiste ___ a peint ce tableau. (who)", "qui", ["que", "dont", "où"], "Qui = who (subject).", 2),
            ("mcq", "Which relative pronoun replaces 'de + noun'?", "dont", ["qui", "que", "où"], "Dont replaces de + noun.", 3),
        ])
        self.stdout.write(f"  Created '{name_fr}'")

    # ─────────────────────────────────────────────────────────────────
    # TOPIC 18 — Les transports et la ville
    # ─────────────────────────────────────────────────────────────────
    def _seed_topic_18(self):
        name_fr = "Les transports et la ville"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)"); return
        t = Topic.objects.create(
            name_fr=name_fr, name_en="Transport & The City",
            description="Navigate cities, use public transport, and ask for directions in French.",
            icon="🚇", order=18, difficulty_level=2,
        )
        l1 = Lesson.objects.create(topic=t, type="vocab", title="Transport Vocabulary", order=1, difficulty=1, content={"intro": "Getting around the city in French."})
        self._bulk_vocab(l1, [
            ("le métro", "metro/subway", "lə me.tʁo", "Je prends le métro pour aller au travail.", "m", "noun"),
            ("le bus", "bus", "lə bys", "Le bus numéro 12 va à la gare.", "m", "noun"),
            ("le taxi", "taxi", "lə tak.si", "Appelle un taxi, nous sommes en retard.", "m", "noun"),
            ("la gare", "train station", "la ɡaʁ", "Le train part de la gare Montparnasse.", "f", "noun"),
            ("l'aéroport", "airport", "la.e.ʁo.pɔʁ", "L'aéroport Charles-de-Gaulle est le plus grand de France.", "m", "noun"),
            ("le billet", "ticket", "lə bi.jɛ", "Je voudrais un billet aller-retour pour Lyon.", "m", "noun"),
            ("le quai", "platform/quay", "lə kɛ", "Le train est au quai numéro 5.", "m", "noun"),
            ("tourner à gauche", "turn left", "tuʁ.ne a ɡoʃ", "Tournez à gauche au feu rouge.", "a", "expression"),
            ("tourner à droite", "turn right", "tuʁ.ne a dʁwat", "Tournez à droite après le carrefour.", "a", "expression"),
            ("continuer tout droit", "go straight ahead", "kɔ̃.ti.nɥe tu dʁwa", "Continuez tout droit pendant 500 mètres.", "a", "expression"),
            ("le carrefour", "crossroads/intersection", "lə kaʁ.fœʁ", "Traversez le carrefour et prenez la première rue.", "m", "noun"),
            ("le feu rouge", "traffic light", "lə fø ʁuʒ", "Attendez au feu rouge.", "m", "noun"),
            ("valider son titre de transport", "to validate your ticket", "va.li.de sɔ̃ titʁ də tʁɑ̃s.pɔʁ", "N'oubliez pas de valider votre ticket.", "a", "expression"),
            ("la correspondance", "transfer/connection", "la kɔ.ʁɛs.pɔ̃.dɑ̃s", "Prenez la correspondance à Châtelet.", "f", "noun"),
            ("embouteillage", "traffic jam", "ɑ̃.bu.tɛ.jaʒ", "Il y a un embouteillage sur le périphérique.", "m", "noun"),
        ])
        l2 = Lesson.objects.create(topic=t, type="grammar", title="The Imperative Mood", order=2, difficulty=2, content={})
        GrammarRule.objects.create(
            lesson=l2, title="L'impératif — Giving Directions and Commands",
            explanation="The **imperative** is used for commands, instructions, and directions. It has three forms: **tu**, **nous**, **vous**.\n\n**Formation:** Use the present tense form but **drop the subject pronoun**. For -ER verbs, also drop the -s in the **tu** form.\n\n| Verb | tu | nous | vous |\n|------|----|------|------|\n| parler | Parle ! | Parlons ! | Parlez ! |\n| finir | Finis ! | Finissons ! | Finissez ! |\n| aller | Va ! | Allons ! | Allez ! |\n| prendre | Prends ! | Prenons ! | Prenez ! |\n\n**Negative imperative:** Ne + verb + pas\n- *Ne tournez pas à gauche !*\n\n**With reflexive verbs:** pronoun comes after in affirmative:\n- *Lève-toi !* (Get up!) / *Ne te lève pas !* (Don't get up!)",
            formula="[verb in present tense, no pronoun] (+ object)",
            examples=["Tournez à gauche au carrefour.", "Prenez la ligne 4 direction Montrouge.", "Ne traversez pas au feu rouge !", "Allons au musée ce weekend !", "Continuez tout droit pendant 200 mètres."],
            exceptions=["Être: sois/soyons/soyez | Avoir: aie/ayons/ayez | Savoir: sache/sachons/sachez"],
        )
        l3 = Lesson.objects.create(topic=t, type="text", title="Se déplacer à Paris", order=3, difficulty=2, content={})
        ReadingText.objects.create(
            lesson=l3, title="Dans le métro parisien",
            content_fr="Le métro de Paris est l'un des plus anciens et des plus fréquentés du monde. Il a été inauguré en 1900 et compte aujourd'hui 16 lignes et plus de 300 stations. Pour prendre le métro, achetez un ticket ou un carnet, puis validez-le avant de monter dans la rame. Attention aux pickpockets dans les stations bondées ! Si vous ne savez pas quelle ligne prendre, consultez le plan du métro ou demandez à un agent RATP. Pour les transports de surface, le bus et le tramway sont également pratiques. Pensez à composter votre ticket !",
            content_en="The Paris metro is one of the oldest and busiest in the world. It was inaugurated in 1900 and now has 16 lines and more than 300 stations. To take the metro, buy a ticket or a carnet, then validate it before boarding the train. Beware of pickpockets in busy stations! If you don't know which line to take, consult the metro map or ask a RATP agent. For surface transport, the bus and tram are also practical. Remember to stamp your ticket!",
            vocabulary_highlights=["carnet", "rame", "composter", "RATP"],
            comprehension_questions=[
                {"question": "When was the Paris metro inaugurated?", "answer": "In 1900."},
                {"question": "How many lines does the Paris metro have?", "answer": "16 lines."},
            ],
        )
        self._bulk_questions(l1, [
            ("mcq", "How do you say 'turn left' in French?", "Tournez à gauche", ["Tournez à droite", "Continuez tout droit", "Traversez le carrefour"], "À gauche = left.", 1),
            ("translate", "Translate: 'Take line 4 towards Montrouge.'", "Prenez la ligne 4 direction Montrouge.", [], "Use the imperative prenez.", 2),
            ("fill_blank", "Ne ___ pas au feu rouge ! (traverser, imperative)", "traversez", ["traverse", "traversons", "traverser"], "Negative imperative vous form = traversez.", 2),
            ("mcq", "What happens to -ER verbs in the tu imperative?", "Drop the -s ending", ["Add an accent", "Keep the -s", "Add -ez"], "Parle! not Parles! for -ER verbs.", 2),
        ])
        self.stdout.write(f"  Created '{name_fr}'")

    # ─────────────────────────────────────────────────────────────────
    # TOPIC 19 — La cuisine française
    # ─────────────────────────────────────────────────────────────────
    def _seed_topic_19(self):
        name_fr = "La cuisine française"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)"); return
        t = Topic.objects.create(
            name_fr=name_fr, name_en="French Cuisine",
            description="Discover the vocabulary of French cooking, recipes, and gastronomy.",
            icon="🥐", order=19, difficulty_level=2,
        )
        l1 = Lesson.objects.create(topic=t, type="vocab", title="Cooking Vocabulary", order=1, difficulty=1, content={"intro": "French cooking and gastronomy vocabulary."})
        self._bulk_vocab(l1, [
            ("la recette", "recipe", "la ʁə.sɛt", "As-tu la recette de la quiche lorraine ?", "f", "noun"),
            ("les ingrédients", "ingredients", "le.z ɛ̃.ɡʁe.djɑ̃", "Vérifie que tu as tous les ingrédients.", "m", "noun"),
            ("faire cuire", "to cook (heat)", "fɛʁ kɥiʁ", "Faites cuire le poulet pendant une heure.", "a", "verb phrase"),
            ("mélanger", "to mix", "me.lɑ̃.ʒe", "Mélangez la farine et les œufs.", "a", "verb"),
            ("hacher", "to chop", "a.ʃe", "Hachez finement les oignons.", "a", "verb"),
            ("la casserole", "saucepan", "la kas.ʁɔl", "Mettez le lait dans la casserole.", "f", "noun"),
            ("le four", "oven", "lə fuʁ", "Préchauffez le four à 180 degrés.", "m", "noun"),
            ("la farine", "flour", "la fa.ʁin", "J'ai besoin d'un kilo de farine.", "f", "noun"),
            ("le beurre", "butter", "lə bœʁ", "Ajoutez du beurre dans la poêle.", "m", "noun"),
            ("le fromage", "cheese", "lə fʁɔ.maʒ", "La France produit plus de 300 fromages.", "m", "noun"),
            ("la poêle", "frying pan", "la pwal", "Faites revenir les légumes dans la poêle.", "f", "noun"),
            ("éplucher", "to peel", "e.ply.ʃe", "Épluchez les pommes de terre.", "a", "verb"),
            ("goûter", "to taste", "ɡu.te", "Goûtez la sauce et ajoutez du sel si nécessaire.", "a", "verb"),
            ("la gastronomie", "gastronomy", "la ɡas.tʁɔ.nɔ.mi", "La gastronomie française est reconnue dans le monde entier.", "f", "noun"),
            ("savoureux / savoureuse", "tasty/flavourful", "sa.vu.ʁø / sa.vu.ʁøz", "Ce plat est vraiment savoureux.", "a", "adjective"),
        ])
        l2 = Lesson.objects.create(topic=t, type="grammar", title="The Passive Voice", order=2, difficulty=3, content={})
        GrammarRule.objects.create(
            lesson=l2, title="La voix passive — The Passive Voice",
            explanation="The passive voice shifts focus from the doer to the receiver of the action.\n\n**Formation:** être (conjugated) + past participle (agrees with subject)\n\nActive: *Le chef prépare le plat.* (The chef prepares the dish.)\nPassive: *Le plat est préparé par le chef.* (The dish is prepared by the chef.)\n\n**Tenses:**\n- Present: *Le pain est fabriqué chaque matin.*\n- Past (passé composé): *Le gâteau a été préparé hier.*\n- Future: *Le repas sera servi à 20h.*\n\n**The agent** (doer) is introduced by **par** (by) or occasionally **de** (with verbs of feeling/description):\n- *La cuisine française est aimée de tous.*",
            formula="être (conjugated) + past participle (+ par + agent)",
            examples=["Le coq au vin est préparé avec du vin rouge.", "La baguette a été inventée en France.", "Ce fromage est fabriqué en Normandie.", "Le repas sera servi dans dix minutes.", "La France est connue pour sa gastronomie."],
            exceptions=["With on: 'On cuisine beaucoup en France' avoids the passive naturally in spoken French."],
        )
        l3 = Lesson.objects.create(topic=t, type="text", title="Une recette française", order=3, difficulty=2, content={})
        ReadingText.objects.create(
            lesson=l3, title="La recette du croque-monsieur",
            content_fr="Le croque-monsieur est un sandwich chaud très populaire en France. Pour préparer deux croque-monsieurs, il vous faut : quatre tranches de pain de mie, deux tranches de jambon, 100g de gruyère râpé et du beurre. Beurrez les tranches de pain. Disposez une tranche de jambon sur deux tranches de pain, puis recouvrez de fromage râpé. Fermez les sandwichs. Faites-les griller au four ou dans une poêle jusqu'à ce que le fromage soit fondu et doré. Servez chaud avec une salade verte. Bon appétit !",
            content_en="The croque-monsieur is a very popular hot sandwich in France. To make two croque-monsieurs, you need: four slices of white bread, two slices of ham, 100g of grated Gruyère, and butter. Butter the bread slices. Place a slice of ham on two slices of bread, then cover with grated cheese. Close the sandwiches. Grill them in the oven or in a frying pan until the cheese is melted and golden. Serve hot with a green salad. Enjoy!",
            vocabulary_highlights=["pain de mie", "gruyère râpé", "jusqu'à ce que"],
            comprehension_questions=[
                {"question": "What type of cheese is used in a croque-monsieur?", "answer": "Gruyère (râpé — grated)."},
                {"question": "How should the croque-monsieur be served?", "answer": "Hot, with a green salad."},
            ],
        )
        self._bulk_questions(l1, [
            ("mcq", "What is 'la farine' in English?", "flour", ["butter", "cheese", "sugar"], "La farine = flour.", 1),
            ("translate", "Translate: 'Preheat the oven to 180 degrees.'", "Préchauffez le four à 180 degrés.", [], "Use imperative préchauffez.", 2),
            ("fill_blank", "Le pain ___ fabriqué chaque matin. (passive, present)", "est", ["a été", "sera", "était"], "Present passive uses est + past participle.", 2),
            ("mcq", "How do you express the agent in a passive sentence?", "par", ["de", "avec", "pour"], "The agent is introduced by par (by).", 2),
        ])
        self.stdout.write(f"  Created '{name_fr}'")

    # ─────────────────────────────────────────────────────────────────
    # TOPIC 20 — Les médias et l'actualité
    # ─────────────────────────────────────────────────────────────────
    def _seed_topic_20(self):
        name_fr = "Les médias et l'actualité"
        if self._topic_exists(name_fr):
            self.stdout.write(f"  Skipping '{name_fr}' (exists)"); return
        t = Topic.objects.create(
            name_fr=name_fr, name_en="Media & Current Affairs",
            description="Discuss news, media, and current affairs in French.",
            icon="📰", order=20, difficulty_level=3,
        )
        l1 = Lesson.objects.create(topic=t, type="vocab", title="Media Vocabulary", order=1, difficulty=2, content={"intro": "Vocabulary for discussing news and media."})
        self._bulk_vocab(l1, [
            ("le journal", "newspaper", "lə ʒuʁ.nal", "Je lis le journal tous les matins.", "m", "noun"),
            ("les informations / les infos", "the news", "le.z ɛ̃.fɔʁ.ma.sjɔ̃", "Je regarde les informations à 20h.", "f", "noun"),
            ("le journaliste", "journalist", "lə ʒuʁ.na.list", "Elle est journaliste pour Le Monde.", "m", "noun"),
            ("un article", "article", "œ̃.n aʁ.tikl", "J'ai lu un article intéressant sur ce sujet.", "m", "noun"),
            ("la une", "front page", "la yn", "Cette affaire est à la une de tous les journaux.", "f", "noun"),
            ("diffuser", "to broadcast", "di.fy.ze", "La chaîne a diffusé un reportage sur l'environnement.", "a", "verb"),
            ("un reportage", "report/documentary", "œ̃ ʁə.pɔʁ.taʒ", "J'ai regardé un reportage sur la guerre.", "m", "noun"),
            ("les réseaux sociaux", "social media", "le ʁe.zo sɔ.sjo", "Les fausses nouvelles se répandent vite sur les réseaux sociaux.", "m", "noun"),
            ("les fake news", "fake news", "le fɛk njuz", "Il faut vérifier les sources pour éviter les fake news.", "f", "noun"),
            ("la liberté de la presse", "freedom of the press", "la li.bɛʁ.te də la pʁɛs", "La liberté de la presse est essentielle en démocratie.", "f", "noun"),
            ("le débat", "debate", "lə de.ba", "Il y a eu un débat politique à la télévision.", "m", "noun"),
            ("l'opinion publique", "public opinion", "lɔ.pi.njɔ̃ py.blik", "L'opinion publique a changé sur ce sujet.", "f", "noun"),
            ("censurer", "to censor", "sɑ̃.sy.ʁe", "Ce gouvernement a censuré certains journalistes.", "a", "verb"),
            ("le podcast", "podcast", "lə pɔd.kast", "J'écoute un podcast de français chaque matin.", "m", "noun"),
            ("objectif / objective", "objective", "ɔb.ʒɛk.tif / ɔb.ʒɛk.tiv", "Un bon journaliste doit être objectif.", "a", "adjective"),
        ])
        l2 = Lesson.objects.create(topic=t, type="grammar", title="The Subjunctive", order=2, difficulty=3, content={})
        GrammarRule.objects.create(
            lesson=l2, title="Le Subjonctif Présent",
            explanation="The **subjunctive** expresses doubt, emotion, necessity, or subjectivity. It is almost always used in a subordinate clause introduced by **que**.\n\n**Formation:** Take the **ils/elles** form of the present tense, remove **-ent**, add subjunctive endings: **-e, -es, -e, -ions, -iez, -ent**.\n\n**Common triggers:**\n- Necessity: *Il faut que, il est nécessaire que*\n- Emotion: *Je suis content que, j'ai peur que*\n- Doubt: *Je ne pense pas que, je doute que*\n- Desire: *Je veux que, je souhaite que*\n- Concession: *bien que, quoique*\n\n**Irregular subjunctives:**\n| Verb | Subjunctive |\n|------|-------------|\n| être | sois, sois, soit, soyons, soyez, soient |\n| avoir | aie, aies, ait, ayons, ayez, aient |\n| aller | aille, ailles, aille, allions, alliez, aillent |\n| faire | fasse, fasses, fasse, fassions, fassiez, fassent |\n| pouvoir | puisse, puisses, puisse, puissions, puissiez, puissent |",
            formula="[trigger expression] + que + [subject] + [verb in subjunctive]",
            examples=["Il faut que tu lises les informations.", "Je suis content qu'il soit journaliste.", "Bien que la presse soit libre, certains pays censurent.", "Je doute que cette information soit vraie.", "Il est important que vous vérifiiez vos sources."],
            exceptions=["No subjunctive needed when subjects are the same: Je veux partir (not Je veux que je parte)."],
        )
        l3 = Lesson.objects.create(topic=t, type="text", title="Les médias en France", order=3, difficulty=3, content={})
        ReadingText.objects.create(
            lesson=l3, title="L'ère de l'information",
            content_fr="À l'ère du numérique, nous sommes bombardés d'informations venant de toutes parts. Les journaux traditionnels comme Le Monde et Le Figaro ont développé leurs éditions en ligne pour s'adapter aux nouvelles habitudes des lecteurs. Les réseaux sociaux sont devenus une source d'information majeure, mais ils favorisent aussi la propagation des fake news. Il est donc essentiel que les citoyens apprennent à vérifier les sources et à développer leur esprit critique. En France, la liberté de la presse est garantie par la Constitution, bien qu'elle reste menacée dans certains pays du monde.",
            content_en="In the digital age, we are bombarded with information from all sides. Traditional newspapers like Le Monde and Le Figaro have developed their online editions to adapt to readers' new habits. Social networks have become a major source of information, but they also encourage the spread of fake news. It is therefore essential that citizens learn to verify sources and develop critical thinking. In France, freedom of the press is guaranteed by the Constitution, although it remains threatened in some countries of the world.",
            vocabulary_highlights=["esprit critique", "propagation", "garantie par la Constitution"],
            comprehension_questions=[
                {"question": "Name two traditional French newspapers mentioned.", "answer": "Le Monde and Le Figaro."},
                {"question": "What problem does social media create according to the text?", "answer": "The spread of fake news (propagation des fake news)."},
            ],
        )
        self._bulk_questions(l1, [
            ("mcq", "What is 'les informations' in English?", "the news", ["the articles", "the debates", "the podcasts"], "Les informations / les infos = the news.", 1),
            ("translate", "Translate: 'It is important that you check your sources.'", "Il est important que vous vérifiiez vos sources.", [], "Use subjunctive after il est important que.", 3),
            ("fill_blank", "Il faut que tu ___ les informations. (lire, subjunctive)", "lises", ["lis", "lisais", "lira"], "Subjunctive of lire for tu = lises.", 3),
            ("mcq", "Which expression triggers the subjunctive?", "Il faut que", ["Je pense que", "Il dit que", "Je sais que"], "Il faut que always requires the subjunctive.", 2),
        ])
        self.stdout.write(f"  Created '{name_fr}'")

    # ─────────────────────────────────────────────────────────────────
    # handle
    # ─────────────────────────────────────────────────────────────────
    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("Seeding extended French content (Topics 9-20)..."))
        self._seed_topic_9()
        self._seed_topic_10()
        self._seed_topic_11()
        self._seed_topic_12()
        self._seed_topic_13()
        self._seed_topic_14()
        self._seed_topic_15()
        self._seed_topic_16()
        self._seed_topic_17()
        self._seed_topic_18()
        self._seed_topic_19()
        self._seed_topic_20()
        self.stdout.write(self.style.SUCCESS("Done! Extended content seeded successfully."))
