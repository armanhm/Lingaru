"""Seed grammar categories, topics, and drill items for the Grammar Booster."""
from django.core.management.base import BaseCommand
from apps.grammar.models import GrammarCategory, GrammarTopic, GrammarDrillItem


CATEGORIES = [
    {"slug": "tenses",        "name": "Tenses",            "icon": "⏳", "order": 1, "description": "Master French verb tenses — past, present, future, and beyond."},
    {"slug": "pronouns",      "name": "Pronouns",          "icon": "👤", "order": 2, "description": "Subject, object, reflexive, and relative pronouns."},
    {"slug": "articles",      "name": "Articles",          "icon": "📰", "order": 3, "description": "Definite, indefinite, and partitive articles."},
    {"slug": "negation",      "name": "Negation",          "icon": "🚫", "order": 4, "description": "Saying no — ne…pas, ne…jamais, ne…rien, and more."},
    {"slug": "moods",         "name": "Moods",             "icon": "🎭", "order": 5, "description": "Subjunctive, conditional, and imperative."},
    {"slug": "structure",     "name": "Sentence Structure","icon": "🏗️", "order": 6, "description": "Word order, questions, and complex sentences."},
]


TOPICS = [
    # ── TENSES ─────────────────────────────────────────────────────
    {
        "category": "tenses", "slug": "passe-compose-avoir",
        "title": "Passé composé with avoir", "cefr_level": "A2",
        "summary": "The most common past tense — use avoir + past participle for most verbs.",
        "explanation": (
            "The **passé composé** describes completed past actions. For most verbs, it's formed with "
            "**avoir** (to have) conjugated in the present + the past participle of the main verb.\n\n"
            "**Past participle endings:**\n"
            "- -er verbs → -é (parler → parlé)\n"
            "- -ir verbs → -i (finir → fini)\n"
            "- -re verbs → -u (vendre → vendu)\n\n"
            "Many irregular verbs have unique past participles you must memorise."
        ),
        "formula": "avoir (present) + past participle",
        "examples": [
            {"fr": "J'ai mangé une pomme.", "en": "I ate an apple."},
            {"fr": "Tu as fini ton travail.", "en": "You finished your work."},
            {"fr": "Elle a vu le film hier.", "en": "She saw the film yesterday."},
        ],
        "exceptions": [
            "Some verbs use **être** instead of avoir (see Passé composé with être).",
            "Past participle agrees with a preceding direct object: « la pomme que j'ai mangée »."
        ],
        "common_mistakes": [
            {"wrong": "J'ai allé au cinéma.", "right": "Je suis allé au cinéma.", "note": "Aller uses être, not avoir."},
        ],
        "drills": [
            {"type": "fill_blank", "prompt": "Hier, je _____ (manger) une pizza.", "correct_answer": "ai mangé"},
            {"type": "fill_blank", "prompt": "Tu _____ (finir) tes devoirs ?", "correct_answer": "as fini"},
            {"type": "fill_blank", "prompt": "Elle _____ (voir) ce film deux fois.", "correct_answer": "a vu"},
            {"type": "mcq", "prompt": "Choose: « Nous _____ acheté du pain. »", "options": ["avons", "sommes", "ont", "est"], "correct_answer": "avons"},
            {"type": "mcq", "prompt": "What is the past participle of « prendre »?", "options": ["pris", "prendu", "prené", "prit"], "correct_answer": "pris"},
            {"type": "mcq", "prompt": "What is the past participle of « écrire »?", "options": ["écrit", "écriu", "écrivé", "écrivi"], "correct_answer": "écrit"},
            {"type": "transform", "prompt": "Put in passé composé: « Je mange du chocolat. »", "correct_answer": "J'ai mangé du chocolat."},
            {"type": "transform", "prompt": "Put in passé composé: « Tu finis le livre. »", "correct_answer": "Tu as fini le livre."},
            {"type": "error_detect", "prompt": "Find the error: « Hier, j'ai allé au marché. »", "correct_answer": "ai allé", "explanation": "Aller takes être: je suis allé."},
            {"type": "fill_blank", "prompt": "Ils _____ (faire) leurs devoirs ce matin.", "correct_answer": "ont fait"},
        ],
    },
    {
        "category": "tenses", "slug": "passe-compose-etre",
        "title": "Passé composé with être", "cefr_level": "A2",
        "summary": "Movement and reflexive verbs use être — and the participle agrees with the subject.",
        "explanation": (
            "Some verbs use **être** instead of avoir to form the passé composé. These are mostly "
            "verbs of movement and state change: **aller, venir, partir, arriver, monter, descendre, "
            "entrer, sortir, naître, mourir, rester, tomber, devenir**, plus all reflexive verbs.\n\n"
            "**Crucial rule:** with être, the past participle **agrees** with the subject in gender "
            "and number — add -e for feminine, -s for plural, -es for feminine plural."
        ),
        "formula": "être (present) + past participle (agrees with subject)",
        "examples": [
            {"fr": "Il est allé au parc.", "en": "He went to the park."},
            {"fr": "Elle est allée au parc.", "en": "She went to the park."},
            {"fr": "Nous sommes arrivés hier.", "en": "We arrived yesterday."},
            {"fr": "Elles sont venues ensemble.", "en": "They (f.) came together."},
        ],
        "exceptions": [
            "Reflexive verbs always use être: « Elle s'est levée tôt. »",
        ],
        "common_mistakes": [
            {"wrong": "Elle est allé.", "right": "Elle est allée.", "note": "Past participle agrees with feminine subject."},
        ],
        "drills": [
            {"type": "fill_blank", "prompt": "Marie _____ (aller) au cinéma hier.", "correct_answer": "est allée"},
            {"type": "fill_blank", "prompt": "Les enfants _____ (rester) à la maison.", "correct_answer": "sont restés"},
            {"type": "fill_blank", "prompt": "Nous _____ (partir) à 8 heures.", "correct_answer": "sommes partis"},
            {"type": "mcq", "prompt": "Choose: « Sophie est _____ (arriver) à l'heure. »", "options": ["arrivée", "arrivé", "arrivés", "arrivant"], "correct_answer": "arrivée"},
            {"type": "mcq", "prompt": "Which verb takes être?", "options": ["aller", "manger", "regarder", "écouter"], "correct_answer": "aller"},
            {"type": "transform", "prompt": "Put in passé composé: « Elle vient avec nous. »", "correct_answer": "Elle est venue avec nous."},
            {"type": "error_detect", "prompt": "Find the error: « Elles sont arrivés tard. »", "correct_answer": "arrivés", "explanation": "Feminine plural — should be « arrivées »."},
            {"type": "fill_blank", "prompt": "Mes amis _____ (venir) me voir.", "correct_answer": "sont venus"},
        ],
    },
    {
        "category": "tenses", "slug": "imparfait",
        "title": "Imparfait", "cefr_level": "A2",
        "summary": "The past tense for descriptions, habits, and ongoing actions.",
        "explanation": (
            "The **imparfait** describes:\n"
            "- Habitual past actions (« je mangeais souvent ici »)\n"
            "- Ongoing past states (« il faisait beau »)\n"
            "- Background descriptions (« j'avais 10 ans »)\n\n"
            "**Formation:** take the « nous » form of the present, drop -ons, add the imparfait endings: "
            "**-ais, -ais, -ait, -ions, -iez, -aient**.\n\n"
            "Example: parler → nous **parl**ons → je parl**ais**, tu parl**ais**, il parl**ait**…"
        ),
        "formula": "(nous form of present − ons) + ais/ais/ait/ions/iez/aient",
        "examples": [
            {"fr": "Quand j'étais petit, je jouais au foot.", "en": "When I was little, I played football."},
            {"fr": "Il pleuvait toute la journée.", "en": "It was raining all day."},
            {"fr": "Nous habitions à Paris.", "en": "We used to live in Paris."},
        ],
        "exceptions": [
            "**Être** is the only true exception: j'étais, tu étais, il était, nous étions, vous étiez, ils étaient.",
        ],
        "common_mistakes": [
            {"wrong": "Je étais.", "right": "J'étais.", "note": "Always elide « je » before a vowel."},
        ],
        "drills": [
            {"type": "fill_blank", "prompt": "Quand j'_____ (être) jeune, je jouais au tennis.", "correct_answer": "étais"},
            {"type": "fill_blank", "prompt": "Il _____ (faire) très chaud cet été-là.", "correct_answer": "faisait"},
            {"type": "fill_blank", "prompt": "Nous _____ (manger) toujours à 19h.", "correct_answer": "mangions"},
            {"type": "mcq", "prompt": "Choose the imparfait: « Elle _____ une belle robe. »", "options": ["portait", "porte", "a porté", "portera"], "correct_answer": "portait"},
            {"type": "mcq", "prompt": "When do you typically use the imparfait?", "options": ["For habitual past actions", "For finished single events", "For future plans", "For commands"], "correct_answer": "For habitual past actions"},
            {"type": "transform", "prompt": "Put in imparfait: « Je mange du chocolat. »", "correct_answer": "Je mangeais du chocolat."},
            {"type": "error_detect", "prompt": "Find the error: « Quand j'avais 10 ans, j'ai habité à Lyon. »", "correct_answer": "ai habité", "explanation": "Past habit needs imparfait: « j'habitais »."},
            {"type": "fill_blank", "prompt": "Tu _____ (avoir) raison.", "correct_answer": "avais"},
        ],
    },
    {
        "category": "tenses", "slug": "futur-simple",
        "title": "Futur simple", "cefr_level": "B1",
        "summary": "The future tense — for plans, predictions, and promises.",
        "explanation": (
            "The **futur simple** expresses what will happen. Form it by taking the **infinitive** and "
            "adding the endings: **-ai, -as, -a, -ons, -ez, -ont** (these are the present of avoir).\n\n"
            "For -re verbs, drop the final -e first: **prendre → prendr-**.\n\n"
            "Many common verbs have irregular stems but use the same endings:\n"
            "- aller → ir-, avoir → aur-, être → ser-, faire → fer-, voir → verr-, pouvoir → pourr-, vouloir → voudr-"
        ),
        "formula": "infinitive (drop final -e for -re verbs) + ai/as/a/ons/ez/ont",
        "examples": [
            {"fr": "Demain, je travaillerai à la maison.", "en": "Tomorrow I'll work from home."},
            {"fr": "Nous serons là à midi.", "en": "We'll be there at noon."},
            {"fr": "Il aura 30 ans l'année prochaine.", "en": "He'll be 30 next year."},
        ],
        "exceptions": [
            "Irregular stems must be memorised — but endings are always -ai, -as, -a, -ons, -ez, -ont.",
        ],
        "common_mistakes": [],
        "drills": [
            {"type": "fill_blank", "prompt": "Demain, je _____ (parler) avec lui.", "correct_answer": "parlerai"},
            {"type": "fill_blank", "prompt": "Nous _____ (être) à Paris la semaine prochaine.", "correct_answer": "serons"},
            {"type": "fill_blank", "prompt": "Tu _____ (avoir) ton diplôme bientôt.", "correct_answer": "auras"},
            {"type": "mcq", "prompt": "Choose the futur simple: « Elle _____ chez nous. »", "options": ["viendra", "vient", "venait", "venir"], "correct_answer": "viendra"},
            {"type": "mcq", "prompt": "What's the futur simple stem of « faire »?", "options": ["fer-", "fais-", "faisi-", "faiss-"], "correct_answer": "fer-"},
            {"type": "transform", "prompt": "Put in futur simple: « Je vais au marché. »", "correct_answer": "J'irai au marché."},
            {"type": "fill_blank", "prompt": "Ils _____ (pouvoir) le faire demain.", "correct_answer": "pourront"},
            {"type": "fill_blank", "prompt": "Vous _____ (voir) la différence.", "correct_answer": "verrez"},
        ],
    },

    # ── PRONOUNS ───────────────────────────────────────────────────
    {
        "category": "pronouns", "slug": "direct-object-pronouns",
        "title": "Direct object pronouns (le, la, les)", "cefr_level": "A2",
        "summary": "Replace direct objects with le, la, l', les — placed before the verb.",
        "explanation": (
            "Direct object pronouns replace nouns that receive the action of the verb directly "
            "(without a preposition):\n\n"
            "- **le** = him/it (m.)\n"
            "- **la** = her/it (f.)\n"
            "- **l'** = before a vowel\n"
            "- **les** = them\n\n"
            "Place them **before the verb**: « Je le vois » (I see him).\n"
            "In passé composé, the past participle agrees with a preceding direct object pronoun."
        ),
        "formula": "Subject + [me/te/le/la/nous/vous/les] + verb",
        "examples": [
            {"fr": "Tu vois le chat ? Oui, je le vois.", "en": "Do you see the cat? Yes, I see it."},
            {"fr": "J'aime cette chanson. Je l'adore.", "en": "I like this song. I love it."},
            {"fr": "Les enfants ? Je les attends.", "en": "The kids? I'm waiting for them."},
        ],
        "exceptions": [
            "In affirmative imperative, the pronoun goes **after** with a hyphen: « Regarde-le ! »",
        ],
        "common_mistakes": [
            {"wrong": "Je vois le.", "right": "Je le vois.", "note": "Object pronoun goes BEFORE the verb."},
        ],
        "drills": [
            {"type": "mcq", "prompt": "Replace: « Je regarde **le film**. »", "options": ["Je le regarde.", "Je la regarde.", "Je les regarde.", "Je lui regarde."], "correct_answer": "Je le regarde."},
            {"type": "mcq", "prompt": "Replace: « Tu connais **Marie** ? »", "options": ["Tu la connais ?", "Tu le connais ?", "Tu lui connais ?", "Tu les connais ?"], "correct_answer": "Tu la connais ?"},
            {"type": "fill_blank", "prompt": "Tu aimes les pommes ? Oui, je _____ aime.", "correct_answer": "les"},
            {"type": "fill_blank", "prompt": "Tu vois Paul ? Oui, je _____ vois.", "correct_answer": "le"},
            {"type": "transform", "prompt": "Use a pronoun: « J'écoute la radio. »", "correct_answer": "Je l'écoute."},
            {"type": "error_detect", "prompt": "Find the error: « Je vois lui chaque jour. »", "correct_answer": "vois lui", "explanation": "Direct object: « Je le vois chaque jour. »"},
            {"type": "fill_blank", "prompt": "Tu prépares le dîner ? Oui, je _____ prépare.", "correct_answer": "le"},
            {"type": "mcq", "prompt": "Replace: « J'achète **les livres**. »", "options": ["Je les achète.", "Je l'achète.", "Je leur achète.", "J'en achète."], "correct_answer": "Je les achète."},
        ],
    },
    {
        "category": "pronouns", "slug": "indirect-object-pronouns",
        "title": "Indirect object pronouns (lui, leur)", "cefr_level": "B1",
        "summary": "Replace « à + person » with lui (singular) or leur (plural).",
        "explanation": (
            "When a verb takes **à + person** (like « parler à », « donner à », « téléphoner à »), "
            "use indirect object pronouns:\n\n"
            "- **me, te, lui, nous, vous, leur**\n\n"
            "**lui** = to him / to her (no gender distinction)\n"
            "**leur** = to them (NO -s, never « leurs » as a pronoun)\n\n"
            "Place before the verb, just like direct object pronouns."
        ),
        "formula": "Subject + [me/te/lui/nous/vous/leur] + verb",
        "examples": [
            {"fr": "Je parle à Marie. → Je lui parle.", "en": "I talk to Marie. → I talk to her."},
            {"fr": "Tu donnes le livre aux enfants ? → Tu leur donnes le livre ?", "en": "Are you giving the book to the kids? → Are you giving them the book?"},
        ],
        "exceptions": [],
        "common_mistakes": [
            {"wrong": "Je leurs parle.", "right": "Je leur parle.", "note": "« Leur » as a pronoun never takes -s."},
            {"wrong": "Je le parle.", "right": "Je lui parle.", "note": "« Parler à » takes an indirect pronoun."},
        ],
        "drills": [
            {"type": "mcq", "prompt": "Replace: « Je parle **à Paul**. »", "options": ["Je lui parle.", "Je le parle.", "Je leur parle.", "Je la parle."], "correct_answer": "Je lui parle."},
            {"type": "mcq", "prompt": "Replace: « Elle écrit **à ses parents**. »", "options": ["Elle leur écrit.", "Elle leurs écrit.", "Elle les écrit.", "Elle lui écrit."], "correct_answer": "Elle leur écrit."},
            {"type": "fill_blank", "prompt": "Je _____ téléphone tous les soirs (à ma mère).", "correct_answer": "lui"},
            {"type": "fill_blank", "prompt": "Tu _____ as donné le cadeau ? (aux enfants)", "correct_answer": "leur"},
            {"type": "error_detect", "prompt": "Find the error: « Je leurs ai parlé hier. »", "correct_answer": "leurs", "explanation": "Pronoun « leur » never takes an -s."},
            {"type": "transform", "prompt": "Use a pronoun: « Il offre des fleurs à sa femme. »", "correct_answer": "Il lui offre des fleurs."},
            {"type": "mcq", "prompt": "« Téléphoner » takes…", "options": ["a direct object", "an indirect object (à)", "no object", "either"], "correct_answer": "an indirect object (à)"},
            {"type": "fill_blank", "prompt": "Nous _____ avons écrit une lettre. (à nos amis)", "correct_answer": "leur"},
        ],
    },

    # ── ARTICLES ──────────────────────────────────────────────────
    {
        "category": "articles", "slug": "definite-articles",
        "title": "Definite articles (le, la, les, l')", "cefr_level": "A1",
        "summary": "« The » in French — agrees with gender and number.",
        "explanation": (
            "Definite articles refer to **specific** things or general concepts:\n\n"
            "- **le** + masculine singular: le chien\n"
            "- **la** + feminine singular: la maison\n"
            "- **l'** + any singular before a vowel/silent h: l'ami, l'eau, l'hôtel\n"
            "- **les** + plural (any gender): les chiens, les maisons\n\n"
            "Used for general statements: « J'aime **le** café » (I like coffee in general)."
        ),
        "formula": "le / la / l' / les + noun",
        "examples": [
            {"fr": "Le chat dort sur la table.", "en": "The cat is sleeping on the table."},
            {"fr": "L'enfant joue avec les jouets.", "en": "The child plays with the toys."},
            {"fr": "J'aime la musique.", "en": "I like music."},
        ],
        "exceptions": [
            "« L' » is used before a silent h: l'homme, l'hôpital. But not before aspirated h: le héros, la honte.",
        ],
        "common_mistakes": [
            {"wrong": "Le école", "right": "L'école", "note": "Elide before vowels."},
        ],
        "drills": [
            {"type": "mcq", "prompt": "Choose: « ___ chat est noir. »", "options": ["Le", "La", "L'", "Les"], "correct_answer": "Le"},
            {"type": "mcq", "prompt": "Choose: « ___ étudiante travaille. »", "options": ["L'", "La", "Le", "Les"], "correct_answer": "L'"},
            {"type": "fill_blank", "prompt": "_____ enfants jouent au parc.", "correct_answer": "Les"},
            {"type": "fill_blank", "prompt": "J'aime _____ musique classique.", "correct_answer": "la"},
            {"type": "fill_blank", "prompt": "_____ amour est important.", "correct_answer": "L'"},
            {"type": "mcq", "prompt": "Which uses l'?", "options": ["l'hôtel", "le hibou", "la heure", "les amis"], "correct_answer": "l'hôtel"},
            {"type": "transform", "prompt": "Make plural: « le livre »", "correct_answer": "les livres"},
            {"type": "error_detect", "prompt": "Find the error: « Le école est grande. »", "correct_answer": "Le école", "explanation": "Should elide: « L'école »."},
        ],
    },
    {
        "category": "articles", "slug": "partitive-articles",
        "title": "Partitive articles (du, de la, des)", "cefr_level": "A2",
        "summary": "« Some » — for unspecified quantities of food, drink, abstract things.",
        "explanation": (
            "Partitive articles express an unspecified quantity (« some »):\n\n"
            "- **du** + masculine: du pain, du café\n"
            "- **de la** + feminine: de la confiture, de la patience\n"
            "- **de l'** + vowel: de l'eau, de l'argent\n"
            "- **des** + plural: des pommes, des amis\n\n"
            "**After negation**, all become **de** (or d'): « Je ne mange pas **de** pain. »\n"
            "**After expressions of quantity**, also use **de**: « beaucoup **de** pain », « un kilo **de** pommes »."
        ),
        "formula": "du / de la / de l' / des — but « de » after negation or quantity",
        "examples": [
            {"fr": "Je voudrais du café, s'il vous plaît.", "en": "I'd like some coffee, please."},
            {"fr": "Elle boit de l'eau.", "en": "She drinks water."},
            {"fr": "Il n'y a pas de pain.", "en": "There's no bread."},
            {"fr": "J'ai beaucoup d'amis.", "en": "I have a lot of friends."},
        ],
        "exceptions": [],
        "common_mistakes": [
            {"wrong": "Je ne mange pas du pain.", "right": "Je ne mange pas de pain.", "note": "After negation, « du/de la/des » → « de »."},
        ],
        "drills": [
            {"type": "mcq", "prompt": "Choose: « Je voudrais ___ pain. »", "options": ["du", "de la", "des", "le"], "correct_answer": "du"},
            {"type": "mcq", "prompt": "Choose: « Tu bois ___ eau ? »", "options": ["de l'", "de la", "du", "des"], "correct_answer": "de l'"},
            {"type": "fill_blank", "prompt": "Elle achète _____ pommes.", "correct_answer": "des"},
            {"type": "fill_blank", "prompt": "Il y a _____ confiture sur la table.", "correct_answer": "de la"},
            {"type": "transform", "prompt": "Make negative: « Je mange du fromage. »", "correct_answer": "Je ne mange pas de fromage."},
            {"type": "error_detect", "prompt": "Find the error: « J'ai beaucoup du temps. »", "correct_answer": "du", "explanation": "After « beaucoup », use « de »: beaucoup de temps."},
            {"type": "fill_blank", "prompt": "Nous n'avons pas _____ argent.", "correct_answer": "d'"},
            {"type": "mcq", "prompt": "Choose: « Un kilo ___ pommes. »", "options": ["de", "des", "du", "le"], "correct_answer": "de"},
        ],
    },

    # ── NEGATION ──────────────────────────────────────────────────
    {
        "category": "negation", "slug": "ne-pas",
        "title": "Negation: ne…pas", "cefr_level": "A1",
        "summary": "The basic French negation — wraps around the verb.",
        "explanation": (
            "To make a sentence negative, place **ne** (or **n'** before a vowel) before the verb "
            "and **pas** after it.\n\n"
            "In compound tenses (passé composé etc.), **ne…pas** wraps the auxiliary verb only: "
            "« Je n'ai pas mangé. »\n\n"
            "In casual speech, the « ne » is often dropped: « J'sais pas. » — but always write it."
        ),
        "formula": "ne (n') + verb + pas",
        "examples": [
            {"fr": "Je ne parle pas anglais.", "en": "I don't speak English."},
            {"fr": "Il n'aime pas le café.", "en": "He doesn't like coffee."},
            {"fr": "Nous n'avons pas fini.", "en": "We haven't finished."},
        ],
        "exceptions": [
            "After negation, indefinite/partitive articles become « de »: « Je n'ai pas **de** voiture. »",
        ],
        "common_mistakes": [
            {"wrong": "Je pas mange.", "right": "Je ne mange pas.", "note": "Need both ne AND pas, around the verb."},
        ],
        "drills": [
            {"type": "transform", "prompt": "Negate: « Je parle français. »", "correct_answer": "Je ne parle pas français."},
            {"type": "transform", "prompt": "Negate: « Il aime le thé. »", "correct_answer": "Il n'aime pas le thé."},
            {"type": "fill_blank", "prompt": "Je _____ comprends _____ .", "correct_answer": "ne, pas"},
            {"type": "mcq", "prompt": "Negate: « Nous mangeons. »", "options": ["Nous ne mangeons pas.", "Nous pas mangeons.", "Nous mangeons pas.", "Ne nous mangeons pas."], "correct_answer": "Nous ne mangeons pas."},
            {"type": "transform", "prompt": "Negate: « J'ai mangé. »", "correct_answer": "Je n'ai pas mangé."},
            {"type": "error_detect", "prompt": "Find the error: « Je ne mange. »", "correct_answer": "ne mange", "explanation": "Need « pas » after the verb: « Je ne mange pas. »"},
            {"type": "transform", "prompt": "Negate: « Elle a une voiture. »", "correct_answer": "Elle n'a pas de voiture."},
            {"type": "mcq", "prompt": "After negation, « du » becomes…", "options": ["de", "des", "le", "stays du"], "correct_answer": "de"},
        ],
    },

    # ── MOODS ─────────────────────────────────────────────────────
    {
        "category": "moods", "slug": "subjunctive-present",
        "title": "Subjunctive (present)", "cefr_level": "B2",
        "summary": "The mood of doubt, emotion, and obligation — triggered by specific phrases.",
        "explanation": (
            "The **subjunctive** is used after expressions of:\n"
            "- **Necessity**: il faut que, il est important que…\n"
            "- **Emotion**: je suis content que, j'ai peur que…\n"
            "- **Doubt**: je doute que, il est possible que…\n"
            "- **Wish**: je veux que, je souhaite que…\n\n"
            "**Formation:** take the « ils » form of the present, drop -ent, add: **-e, -es, -e, -ions, -iez, -ent**.\n\n"
            "Example: parler → ils parlent → que je parle, que tu parles, qu'il parle, que nous parlions, que vous parliez, qu'ils parlent."
        ),
        "formula": "que + (ils form − ent) + e/es/e/ions/iez/ent",
        "examples": [
            {"fr": "Il faut que tu fasses tes devoirs.", "en": "You need to do your homework."},
            {"fr": "Je veux qu'il vienne avec nous.", "en": "I want him to come with us."},
            {"fr": "Je suis content que tu sois là.", "en": "I'm glad you're here."},
        ],
        "exceptions": [
            "Irregulars: être (sois, sois, soit, soyons, soyez, soient), avoir (aie, aies, ait, ayons, ayez, aient), "
            "aller (aille, ailles, aille, allions, alliez, aillent), faire (fasse), pouvoir (puisse), savoir (sache), vouloir (veuille).",
        ],
        "common_mistakes": [
            {"wrong": "Il faut que tu fais.", "right": "Il faut que tu fasses.", "note": "« Il faut que » triggers subjunctive."},
        ],
        "drills": [
            {"type": "fill_blank", "prompt": "Il faut que tu _____ (être) à l'heure.", "correct_answer": "sois"},
            {"type": "fill_blank", "prompt": "Je veux qu'il _____ (venir).", "correct_answer": "vienne"},
            {"type": "fill_blank", "prompt": "Il est important que nous _____ (faire) attention.", "correct_answer": "fassions"},
            {"type": "mcq", "prompt": "Choose: « Je doute qu'elle _____ raison. »", "options": ["ait", "a", "aura", "avait"], "correct_answer": "ait"},
            {"type": "mcq", "prompt": "Which expression triggers subjunctive?", "options": ["il faut que", "je sais que", "je pense que (affirmative)", "il est vrai que"], "correct_answer": "il faut que"},
            {"type": "transform", "prompt": "Combine: « Il faut + tu pars maintenant. »", "correct_answer": "Il faut que tu partes maintenant."},
            {"type": "error_detect", "prompt": "Find the error: « Je veux que tu vas au marché. »", "correct_answer": "vas", "explanation": "After « je veux que », subjunctive: « ailles »."},
            {"type": "fill_blank", "prompt": "Je suis content que vous _____ (être) là.", "correct_answer": "soyez"},
        ],
    },

    # ── STRUCTURE ─────────────────────────────────────────────────
    {
        "category": "structure", "slug": "questions",
        "title": "Forming questions", "cefr_level": "A2",
        "summary": "Three ways to ask: intonation, est-ce que, and inversion.",
        "explanation": (
            "French has **three main ways** to ask yes/no questions:\n\n"
            "1. **Rising intonation** (informal): « Tu viens ? »\n"
            "2. **Est-ce que** (neutral, very common): « Est-ce que tu viens ? »\n"
            "3. **Inversion** (formal): « Viens-tu ? »\n\n"
            "For information questions, add a question word (où, quand, comment, pourquoi, qui, que…) "
            "before « est-ce que » or before the inverted verb.\n\n"
            "Examples:\n"
            "- « **Où est-ce que** tu vas ? »\n"
            "- « **Pourquoi** as-tu fait ça ? »"
        ),
        "formula": "Subject + verb? / Est-ce que + S + V? / V-S?",
        "examples": [
            {"fr": "Tu veux du café ?", "en": "Do you want some coffee?"},
            {"fr": "Est-ce que vous êtes prêts ?", "en": "Are you ready?"},
            {"fr": "Parlez-vous français ?", "en": "Do you speak French?"},
            {"fr": "Quand est-ce qu'il arrive ?", "en": "When does he arrive?"},
        ],
        "exceptions": [
            "When inverting with il/elle, add -t- if the verb ends in a vowel: « A-t-il fini ? » « Va-t-elle ? »",
        ],
        "common_mistakes": [
            {"wrong": "A il fini ?", "right": "A-t-il fini ?", "note": "Add -t- between verb-vowel and il/elle."},
        ],
        "drills": [
            {"type": "transform", "prompt": "Make a question with est-ce que: « Tu parles français. »", "correct_answer": "Est-ce que tu parles français ?"},
            {"type": "transform", "prompt": "Make a question with inversion: « Vous êtes français. »", "correct_answer": "Êtes-vous français ?"},
            {"type": "mcq", "prompt": "Which is correct?", "options": ["A-t-il mangé ?", "A il mangé ?", "A-il mangé ?", "Mangé-il a ?"], "correct_answer": "A-t-il mangé ?"},
            {"type": "fill_blank", "prompt": "_____ tu viens avec nous ?", "correct_answer": "Est-ce que"},
            {"type": "transform", "prompt": "Ask « when » formally: « Il arrive. »", "correct_answer": "Quand arrive-t-il ?"},
            {"type": "error_detect", "prompt": "Find the error: « Va il à Paris ? »", "correct_answer": "Va il", "explanation": "Need -t- and hyphens: « Va-t-il à Paris ? »"},
            {"type": "mcq", "prompt": "Most neutral way to ask?", "options": ["Est-ce que", "Inversion", "Intonation", "Question word alone"], "correct_answer": "Est-ce que"},
            {"type": "fill_blank", "prompt": "_____ -tu (vouloir) un café ?", "correct_answer": "Veux"},
        ],
    },
]


class Command(BaseCommand):
    help = "Seed grammar categories, topics, and drill items."

    def handle(self, *args, **options):
        # Categories
        cat_map = {}
        for c in CATEGORIES:
            cat, _ = GrammarCategory.objects.update_or_create(
                slug=c["slug"],
                defaults={"name": c["name"], "icon": c["icon"], "order": c["order"], "description": c["description"]},
            )
            cat_map[c["slug"]] = cat

        # Topics + drills
        created_topics = 0
        created_drills = 0
        for i, t in enumerate(TOPICS):
            topic, created = GrammarTopic.objects.update_or_create(
                slug=t["slug"],
                defaults={
                    "category": cat_map[t["category"]],
                    "title": t["title"],
                    "cefr_level": t["cefr_level"],
                    "summary": t["summary"],
                    "explanation": t["explanation"],
                    "formula": t["formula"],
                    "examples": t["examples"],
                    "exceptions": t["exceptions"],
                    "common_mistakes": t["common_mistakes"],
                    "order": i,
                },
            )
            if created: created_topics += 1
            # Replace existing drills for this topic
            topic.drills.all().delete()
            for d in t["drills"]:
                GrammarDrillItem.objects.create(
                    topic=topic,
                    type=d["type"],
                    prompt=d["prompt"],
                    correct_answer=d["correct_answer"],
                    options=d.get("options", []),
                    explanation=d.get("explanation", ""),
                    difficulty=d.get("difficulty", 1),
                )
                created_drills += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {len(CATEGORIES)} categories, {len(TOPICS)} topics ({created_topics} new), {created_drills} drill items."
        ))
