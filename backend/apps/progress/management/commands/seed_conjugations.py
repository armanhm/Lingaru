"""Seed conjugation questions for common French verbs."""

from django.core.management.base import BaseCommand
from apps.content.models import Lesson, Question, Topic


CONJUGATIONS = {
    # ── être & avoir (auxiliaries) ──────────────────────────────────────────
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
        "futur_simple": {
            "j'": "aurai", "tu": "auras", "il/elle": "aura",
            "nous": "aurons", "vous": "aurez", "ils/elles": "auront",
        },
        "conditionnel": {
            "j'": "aurais", "tu": "aurais", "il/elle": "aurait",
            "nous": "aurions", "vous": "auriez", "ils/elles": "auraient",
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
        "futur_simple": {
            "je": "serai", "tu": "seras", "il/elle": "sera",
            "nous": "serons", "vous": "serez", "ils/elles": "seront",
        },
        "conditionnel": {
            "je": "serais", "tu": "serais", "il/elle": "serait",
            "nous": "serions", "vous": "seriez", "ils/elles": "seraient",
        },
    },

    # ── regular -ER verbs ───────────────────────────────────────────────────
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
        "futur_simple": {
            "je": "mangerai", "tu": "mangeras", "il/elle": "mangera",
            "nous": "mangerons", "vous": "mangerez", "ils/elles": "mangeront",
        },
    },
    "parler": {
        "present": {
            "je": "parle", "tu": "parles", "il/elle": "parle",
            "nous": "parlons", "vous": "parlez", "ils/elles": "parlent",
        },
        "passe_compose": {
            "j'": "ai parle", "tu": "as parle", "il/elle": "a parle",
            "nous": "avons parle", "vous": "avez parle", "ils/elles": "ont parle",
        },
        "imparfait": {
            "je": "parlais", "tu": "parlais", "il/elle": "parlait",
            "nous": "parlions", "vous": "parliez", "ils/elles": "parlaient",
        },
        "futur_simple": {
            "je": "parlerai", "tu": "parleras", "il/elle": "parlera",
            "nous": "parlerons", "vous": "parlerez", "ils/elles": "parleront",
        },
        "conditionnel": {
            "je": "parlerais", "tu": "parlerais", "il/elle": "parlerait",
            "nous": "parlerions", "vous": "parleriez", "ils/elles": "parleraient",
        },
    },
    "aimer": {
        "present": {
            "j'": "aime", "tu": "aimes", "il/elle": "aime",
            "nous": "aimons", "vous": "aimez", "ils/elles": "aiment",
        },
        "passe_compose": {
            "j'": "ai aime", "tu": "as aime", "il/elle": "a aime",
            "nous": "avons aime", "vous": "avez aime", "ils/elles": "ont aime",
        },
        "imparfait": {
            "j'": "aimais", "tu": "aimais", "il/elle": "aimait",
            "nous": "aimions", "vous": "aimiez", "ils/elles": "aimaient",
        },
        "futur_simple": {
            "j'": "aimerai", "tu": "aimeras", "il/elle": "aimera",
            "nous": "aimerons", "vous": "aimerez", "ils/elles": "aimeront",
        },
    },
    "travailler": {
        "present": {
            "je": "travaille", "tu": "travailles", "il/elle": "travaille",
            "nous": "travaillons", "vous": "travaillez", "ils/elles": "travaillent",
        },
        "passe_compose": {
            "j'": "ai travaille", "tu": "as travaille", "il/elle": "a travaille",
            "nous": "avons travaille", "vous": "avez travaille", "ils/elles": "ont travaille",
        },
        "imparfait": {
            "je": "travaillais", "tu": "travaillais", "il/elle": "travaillait",
            "nous": "travaillions", "vous": "travailliez", "ils/elles": "travaillaient",
        },
        "futur_simple": {
            "je": "travaillerai", "tu": "travailleras", "il/elle": "travaillera",
            "nous": "travaillerons", "vous": "travaillerez", "ils/elles": "travailleront",
        },
    },
    "habiter": {
        "present": {
            "j'": "habite", "tu": "habites", "il/elle": "habite",
            "nous": "habitons", "vous": "habitez", "ils/elles": "habitent",
        },
        "passe_compose": {
            "j'": "ai habite", "tu": "as habite", "il/elle": "a habite",
            "nous": "avons habite", "vous": "avez habite", "ils/elles": "ont habite",
        },
        "imparfait": {
            "j'": "habitais", "tu": "habitais", "il/elle": "habitait",
            "nous": "habitions", "vous": "habitiez", "ils/elles": "habitaient",
        },
        "futur_simple": {
            "j'": "habiterai", "tu": "habiteras", "il/elle": "habitera",
            "nous": "habiterons", "vous": "habiterez", "ils/elles": "habiteront",
        },
    },
    "acheter": {
        "present": {
            "j'": "achete", "tu": "achetes", "il/elle": "achete",
            "nous": "achetons", "vous": "achetez", "ils/elles": "achetent",
        },
        "passe_compose": {
            "j'": "ai achete", "tu": "as achete", "il/elle": "a achete",
            "nous": "avons achete", "vous": "avez achete", "ils/elles": "ont achete",
        },
        "imparfait": {
            "j'": "achetais", "tu": "achetais", "il/elle": "achetait",
            "nous": "achetions", "vous": "achetiez", "ils/elles": "achetaient",
        },
        "futur_simple": {
            "j'": "acheterai", "tu": "acheteras", "il/elle": "achetera",
            "nous": "acheterons", "vous": "acheterez", "ils/elles": "acheteront",
        },
    },

    # ── regular -IR verbs ───────────────────────────────────────────────────
    "finir": {
        "present": {
            "je": "finis", "tu": "finis", "il/elle": "finit",
            "nous": "finissons", "vous": "finissez", "ils/elles": "finissent",
        },
        "passe_compose": {
            "j'": "ai fini", "tu": "as fini", "il/elle": "a fini",
            "nous": "avons fini", "vous": "avez fini", "ils/elles": "ont fini",
        },
        "imparfait": {
            "je": "finissais", "tu": "finissais", "il/elle": "finissait",
            "nous": "finissions", "vous": "finissiez", "ils/elles": "finissaient",
        },
        "futur_simple": {
            "je": "finirai", "tu": "finiras", "il/elle": "finira",
            "nous": "finirons", "vous": "finirez", "ils/elles": "finiront",
        },
        "conditionnel": {
            "je": "finirais", "tu": "finirais", "il/elle": "finirait",
            "nous": "finirions", "vous": "finiriez", "ils/elles": "finiraient",
        },
    },
    "choisir": {
        "present": {
            "je": "choisis", "tu": "choisis", "il/elle": "choisit",
            "nous": "choisissons", "vous": "choisissez", "ils/elles": "choisissent",
        },
        "passe_compose": {
            "j'": "ai choisi", "tu": "as choisi", "il/elle": "a choisi",
            "nous": "avons choisi", "vous": "avez choisi", "ils/elles": "ont choisi",
        },
        "imparfait": {
            "je": "choisissais", "tu": "choisissais", "il/elle": "choisissait",
            "nous": "choisissions", "vous": "choisissiez", "ils/elles": "choisissaient",
        },
        "futur_simple": {
            "je": "choisirai", "tu": "choisiras", "il/elle": "choisira",
            "nous": "choisirons", "vous": "choisirez", "ils/elles": "choisiront",
        },
    },

    # ── irregular verbs ─────────────────────────────────────────────────────
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
        "futur_simple": {
            "j'": "irai", "tu": "iras", "il/elle": "ira",
            "nous": "irons", "vous": "irez", "ils/elles": "iront",
        },
        "conditionnel": {
            "j'": "irais", "tu": "irais", "il/elle": "irait",
            "nous": "irions", "vous": "iriez", "ils/elles": "iraient",
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
        "futur_simple": {
            "je": "ferai", "tu": "feras", "il/elle": "fera",
            "nous": "ferons", "vous": "ferez", "ils/elles": "feront",
        },
        "conditionnel": {
            "je": "ferais", "tu": "ferais", "il/elle": "ferait",
            "nous": "ferions", "vous": "feriez", "ils/elles": "feraient",
        },
    },
    "vouloir": {
        "present": {
            "je": "veux", "tu": "veux", "il/elle": "veut",
            "nous": "voulons", "vous": "voulez", "ils/elles": "veulent",
        },
        "passe_compose": {
            "j'": "ai voulu", "tu": "as voulu", "il/elle": "a voulu",
            "nous": "avons voulu", "vous": "avez voulu", "ils/elles": "ont voulu",
        },
        "imparfait": {
            "je": "voulais", "tu": "voulais", "il/elle": "voulait",
            "nous": "voulions", "vous": "vouliez", "ils/elles": "voulaient",
        },
        "futur_simple": {
            "je": "voudrai", "tu": "voudras", "il/elle": "voudra",
            "nous": "voudrons", "vous": "voudrez", "ils/elles": "voudront",
        },
        "conditionnel": {
            "je": "voudrais", "tu": "voudrais", "il/elle": "voudrait",
            "nous": "voudrions", "vous": "voudriez", "ils/elles": "voudraient",
        },
    },
    "pouvoir": {
        "present": {
            "je": "peux", "tu": "peux", "il/elle": "peut",
            "nous": "pouvons", "vous": "pouvez", "ils/elles": "peuvent",
        },
        "passe_compose": {
            "j'": "ai pu", "tu": "as pu", "il/elle": "a pu",
            "nous": "avons pu", "vous": "avez pu", "ils/elles": "ont pu",
        },
        "imparfait": {
            "je": "pouvais", "tu": "pouvais", "il/elle": "pouvait",
            "nous": "pouvions", "vous": "pouviez", "ils/elles": "pouvaient",
        },
        "futur_simple": {
            "je": "pourrai", "tu": "pourras", "il/elle": "pourra",
            "nous": "pourrons", "vous": "pourrez", "ils/elles": "pourront",
        },
        "conditionnel": {
            "je": "pourrais", "tu": "pourrais", "il/elle": "pourrait",
            "nous": "pourrions", "vous": "pourriez", "ils/elles": "pourraient",
        },
    },
    "devoir": {
        "present": {
            "je": "dois", "tu": "dois", "il/elle": "doit",
            "nous": "devons", "vous": "devez", "ils/elles": "doivent",
        },
        "passe_compose": {
            "j'": "ai du", "tu": "as du", "il/elle": "a du",
            "nous": "avons du", "vous": "avez du", "ils/elles": "ont du",
        },
        "imparfait": {
            "je": "devais", "tu": "devais", "il/elle": "devait",
            "nous": "devions", "vous": "deviez", "ils/elles": "devaient",
        },
        "futur_simple": {
            "je": "devrai", "tu": "devras", "il/elle": "devra",
            "nous": "devrons", "vous": "devrez", "ils/elles": "devront",
        },
        "conditionnel": {
            "je": "devrais", "tu": "devrais", "il/elle": "devrait",
            "nous": "devrions", "vous": "devriez", "ils/elles": "devraient",
        },
    },
    "savoir": {
        "present": {
            "je": "sais", "tu": "sais", "il/elle": "sait",
            "nous": "savons", "vous": "savez", "ils/elles": "savent",
        },
        "passe_compose": {
            "j'": "ai su", "tu": "as su", "il/elle": "a su",
            "nous": "avons su", "vous": "avez su", "ils/elles": "ont su",
        },
        "imparfait": {
            "je": "savais", "tu": "savais", "il/elle": "savait",
            "nous": "savions", "vous": "saviez", "ils/elles": "savaient",
        },
        "futur_simple": {
            "je": "saurai", "tu": "sauras", "il/elle": "saura",
            "nous": "saurons", "vous": "saurez", "ils/elles": "sauront",
        },
        "conditionnel": {
            "je": "saurais", "tu": "saurais", "il/elle": "saurait",
            "nous": "saurions", "vous": "sauriez", "ils/elles": "sauraient",
        },
    },
    "venir": {
        "present": {
            "je": "viens", "tu": "viens", "il/elle": "vient",
            "nous": "venons", "vous": "venez", "ils/elles": "viennent",
        },
        "passe_compose": {
            "je": "suis venu", "tu": "es venu", "il/elle": "est venu",
            "nous": "sommes venus", "vous": "etes venus", "ils/elles": "sont venus",
        },
        "imparfait": {
            "je": "venais", "tu": "venais", "il/elle": "venait",
            "nous": "venions", "vous": "veniez", "ils/elles": "venaient",
        },
        "futur_simple": {
            "je": "viendrai", "tu": "viendras", "il/elle": "viendra",
            "nous": "viendrons", "vous": "viendrez", "ils/elles": "viendront",
        },
        "conditionnel": {
            "je": "viendrais", "tu": "viendrais", "il/elle": "viendrait",
            "nous": "viendrions", "vous": "viendriez", "ils/elles": "viendraient",
        },
    },
    "partir": {
        "present": {
            "je": "pars", "tu": "pars", "il/elle": "part",
            "nous": "partons", "vous": "partez", "ils/elles": "partent",
        },
        "passe_compose": {
            "je": "suis parti", "tu": "es parti", "il/elle": "est parti",
            "nous": "sommes partis", "vous": "etes partis", "ils/elles": "sont partis",
        },
        "imparfait": {
            "je": "partais", "tu": "partais", "il/elle": "partait",
            "nous": "partions", "vous": "partiez", "ils/elles": "partaient",
        },
        "futur_simple": {
            "je": "partirai", "tu": "partiras", "il/elle": "partira",
            "nous": "partirons", "vous": "partirez", "ils/elles": "partiront",
        },
    },
    "prendre": {
        "present": {
            "je": "prends", "tu": "prends", "il/elle": "prend",
            "nous": "prenons", "vous": "prenez", "ils/elles": "prennent",
        },
        "passe_compose": {
            "j'": "ai pris", "tu": "as pris", "il/elle": "a pris",
            "nous": "avons pris", "vous": "avez pris", "ils/elles": "ont pris",
        },
        "imparfait": {
            "je": "prenais", "tu": "prenais", "il/elle": "prenait",
            "nous": "prenions", "vous": "preniez", "ils/elles": "prenaient",
        },
        "futur_simple": {
            "je": "prendrai", "tu": "prendras", "il/elle": "prendra",
            "nous": "prendrons", "vous": "prendrez", "ils/elles": "prendront",
        },
        "conditionnel": {
            "je": "prendrais", "tu": "prendrais", "il/elle": "prendrait",
            "nous": "prendrions", "vous": "prendriez", "ils/elles": "prendraient",
        },
    },
    "mettre": {
        "present": {
            "je": "mets", "tu": "mets", "il/elle": "met",
            "nous": "mettons", "vous": "mettez", "ils/elles": "mettent",
        },
        "passe_compose": {
            "j'": "ai mis", "tu": "as mis", "il/elle": "a mis",
            "nous": "avons mis", "vous": "avez mis", "ils/elles": "ont mis",
        },
        "imparfait": {
            "je": "mettais", "tu": "mettais", "il/elle": "mettait",
            "nous": "mettions", "vous": "mettiez", "ils/elles": "mettaient",
        },
        "futur_simple": {
            "je": "mettrai", "tu": "mettras", "il/elle": "mettra",
            "nous": "mettrons", "vous": "mettrez", "ils/elles": "mettront",
        },
    },
    "dire": {
        "present": {
            "je": "dis", "tu": "dis", "il/elle": "dit",
            "nous": "disons", "vous": "dites", "ils/elles": "disent",
        },
        "passe_compose": {
            "j'": "ai dit", "tu": "as dit", "il/elle": "a dit",
            "nous": "avons dit", "vous": "avez dit", "ils/elles": "ont dit",
        },
        "imparfait": {
            "je": "disais", "tu": "disais", "il/elle": "disait",
            "nous": "disions", "vous": "disiez", "ils/elles": "disaient",
        },
        "futur_simple": {
            "je": "dirai", "tu": "diras", "il/elle": "dira",
            "nous": "dirons", "vous": "direz", "ils/elles": "diront",
        },
    },
    "voir": {
        "present": {
            "je": "vois", "tu": "vois", "il/elle": "voit",
            "nous": "voyons", "vous": "voyez", "ils/elles": "voient",
        },
        "passe_compose": {
            "j'": "ai vu", "tu": "as vu", "il/elle": "a vu",
            "nous": "avons vu", "vous": "avez vu", "ils/elles": "ont vu",
        },
        "imparfait": {
            "je": "voyais", "tu": "voyais", "il/elle": "voyait",
            "nous": "voyions", "vous": "voyiez", "ils/elles": "voyaient",
        },
        "futur_simple": {
            "je": "verrai", "tu": "verras", "il/elle": "verra",
            "nous": "verrons", "vous": "verrez", "ils/elles": "verront",
        },
        "conditionnel": {
            "je": "verrais", "tu": "verrais", "il/elle": "verrait",
            "nous": "verrions", "vous": "verriez", "ils/elles": "verraient",
        },
    },
    "connaitre": {
        "present": {
            "je": "connais", "tu": "connais", "il/elle": "connait",
            "nous": "connaissons", "vous": "connaissez", "ils/elles": "connaissent",
        },
        "passe_compose": {
            "j'": "ai connu", "tu": "as connu", "il/elle": "a connu",
            "nous": "avons connu", "vous": "avez connu", "ils/elles": "ont connu",
        },
        "imparfait": {
            "je": "connaissais", "tu": "connaissais", "il/elle": "connaissait",
            "nous": "connaissions", "vous": "connaissiez", "ils/elles": "connaissaient",
        },
        "futur_simple": {
            "je": "connaitrai", "tu": "connaîtras", "il/elle": "connaitra",
            "nous": "connaitrons", "vous": "connaitrez", "ils/elles": "connaitront",
        },
    },
    "sortir": {
        "present": {
            "je": "sors", "tu": "sors", "il/elle": "sort",
            "nous": "sortons", "vous": "sortez", "ils/elles": "sortent",
        },
        "passe_compose": {
            "je": "suis sorti", "tu": "es sorti", "il/elle": "est sorti",
            "nous": "sommes sortis", "vous": "etes sortis", "ils/elles": "sont sortis",
        },
        "imparfait": {
            "je": "sortais", "tu": "sortais", "il/elle": "sortait",
            "nous": "sortions", "vous": "sortiez", "ils/elles": "sortaient",
        },
        "futur_simple": {
            "je": "sortirai", "tu": "sortiras", "il/elle": "sortira",
            "nous": "sortirons", "vous": "sortirez", "ils/elles": "sortiront",
        },
    },
    "lire": {
        "present": {
            "je": "lis", "tu": "lis", "il/elle": "lit",
            "nous": "lisons", "vous": "lisez", "ils/elles": "lisent",
        },
        "passe_compose": {
            "j'": "ai lu", "tu": "as lu", "il/elle": "a lu",
            "nous": "avons lu", "vous": "avez lu", "ils/elles": "ont lu",
        },
        "imparfait": {
            "je": "lisais", "tu": "lisais", "il/elle": "lisait",
            "nous": "lisions", "vous": "lisiez", "ils/elles": "lisaient",
        },
        "futur_simple": {
            "je": "lirai", "tu": "liras", "il/elle": "lira",
            "nous": "lirons", "vous": "lirez", "ils/elles": "liront",
        },
    },
    "ecrire": {
        "present": {
            "j'": "ecris", "tu": "ecris", "il/elle": "ecrit",
            "nous": "ecrivons", "vous": "ecrivez", "ils/elles": "ecrivent",
        },
        "passe_compose": {
            "j'": "ai ecrit", "tu": "as ecrit", "il/elle": "a ecrit",
            "nous": "avons ecrit", "vous": "avez ecrit", "ils/elles": "ont ecrit",
        },
        "imparfait": {
            "j'": "ecrivais", "tu": "ecrivais", "il/elle": "ecrivait",
            "nous": "ecrivions", "vous": "ecriviez", "ils/elles": "ecrivaient",
        },
        "futur_simple": {
            "j'": "ecrirai", "tu": "ecriras", "il/elle": "ecrira",
            "nous": "ecrirons", "vous": "ecrirez", "ils/elles": "ecriront",
        },
    },
    "ouvrir": {
        "present": {
            "j'": "ouvre", "tu": "ouvres", "il/elle": "ouvre",
            "nous": "ouvrons", "vous": "ouvrez", "ils/elles": "ouvrent",
        },
        "passe_compose": {
            "j'": "ai ouvert", "tu": "as ouvert", "il/elle": "a ouvert",
            "nous": "avons ouvert", "vous": "avez ouvert", "ils/elles": "ont ouvert",
        },
        "imparfait": {
            "j'": "ouvrais", "tu": "ouvrais", "il/elle": "ouvrait",
            "nous": "ouvrions", "vous": "ouvriez", "ils/elles": "ouvraient",
        },
        "futur_simple": {
            "j'": "ouvrirai", "tu": "ouvriras", "il/elle": "ouvrira",
            "nous": "ouvrirons", "vous": "ouvrirez", "ils/elles": "ouvriront",
        },
    },
    "recevoir": {
        "present": {
            "je": "recois", "tu": "recois", "il/elle": "recoit",
            "nous": "recevons", "vous": "recevez", "ils/elles": "recoivent",
        },
        "passe_compose": {
            "j'": "ai recu", "tu": "as recu", "il/elle": "a recu",
            "nous": "avons recu", "vous": "avez recu", "ils/elles": "ont recu",
        },
        "imparfait": {
            "je": "recevais", "tu": "recevais", "il/elle": "recevait",
            "nous": "recevions", "vous": "receviez", "ils/elles": "recevaient",
        },
        "futur_simple": {
            "je": "recevrai", "tu": "recevras", "il/elle": "recevra",
            "nous": "recevrons", "vous": "recevrez", "ils/elles": "recevront",
        },
    },
    "tenir": {
        "present": {
            "je": "tiens", "tu": "tiens", "il/elle": "tient",
            "nous": "tenons", "vous": "tenez", "ils/elles": "tiennent",
        },
        "passe_compose": {
            "j'": "ai tenu", "tu": "as tenu", "il/elle": "a tenu",
            "nous": "avons tenu", "vous": "avez tenu", "ils/elles": "ont tenu",
        },
        "imparfait": {
            "je": "tenais", "tu": "tenais", "il/elle": "tenait",
            "nous": "tenions", "vous": "teniez", "ils/elles": "tenaient",
        },
        "futur_simple": {
            "je": "tiendrai", "tu": "tiendras", "il/elle": "tiendra",
            "nous": "tiendrons", "vous": "tiendrez", "ils/elles": "tiendront",
        },
        "conditionnel": {
            "je": "tiendrais", "tu": "tiendrais", "il/elle": "tiendrait",
            "nous": "tiendrions", "vous": "tiendriez", "ils/elles": "tiendraient",
        },
    },
    "croire": {
        "present": {
            "je": "crois", "tu": "crois", "il/elle": "croit",
            "nous": "croyons", "vous": "croyez", "ils/elles": "croient",
        },
        "passe_compose": {
            "j'": "ai cru", "tu": "as cru", "il/elle": "a cru",
            "nous": "avons cru", "vous": "avez cru", "ils/elles": "ont cru",
        },
        "imparfait": {
            "je": "croyais", "tu": "croyais", "il/elle": "croyait",
            "nous": "croyions", "vous": "croyiez", "ils/elles": "croyaient",
        },
        "futur_simple": {
            "je": "croirai", "tu": "croiras", "il/elle": "croira",
            "nous": "croirons", "vous": "croirez", "ils/elles": "croiront",
        },
    },
    "suivre": {
        "present": {
            "je": "suis", "tu": "suis", "il/elle": "suit",
            "nous": "suivons", "vous": "suivez", "ils/elles": "suivent",
        },
        "passe_compose": {
            "j'": "ai suivi", "tu": "as suivi", "il/elle": "a suivi",
            "nous": "avons suivi", "vous": "avez suivi", "ils/elles": "ont suivi",
        },
        "imparfait": {
            "je": "suivais", "tu": "suivais", "il/elle": "suivait",
            "nous": "suivions", "vous": "suiviez", "ils/elles": "suivaient",
        },
        "futur_simple": {
            "je": "suivrai", "tu": "suivras", "il/elle": "suivra",
            "nous": "suivrons", "vous": "suivrez", "ils/elles": "suivront",
        },
    },
    "vivre": {
        "present": {
            "je": "vis", "tu": "vis", "il/elle": "vit",
            "nous": "vivons", "vous": "vivez", "ils/elles": "vivent",
        },
        "passe_compose": {
            "j'": "ai vecu", "tu": "as vecu", "il/elle": "a vecu",
            "nous": "avons vecu", "vous": "avez vecu", "ils/elles": "ont vecu",
        },
        "imparfait": {
            "je": "vivais", "tu": "vivais", "il/elle": "vivait",
            "nous": "vivions", "vous": "viviez", "ils/elles": "vivaient",
        },
        "futur_simple": {
            "je": "vivrai", "tu": "vivras", "il/elle": "vivra",
            "nous": "vivrons", "vous": "vivrez", "ils/elles": "vivront",
        },
    },
    "dormir": {
        "present": {
            "je": "dors", "tu": "dors", "il/elle": "dort",
            "nous": "dormons", "vous": "dormez", "ils/elles": "dorment",
        },
        "passe_compose": {
            "j'": "ai dormi", "tu": "as dormi", "il/elle": "a dormi",
            "nous": "avons dormi", "vous": "avez dormi", "ils/elles": "ont dormi",
        },
        "imparfait": {
            "je": "dormais", "tu": "dormais", "il/elle": "dormait",
            "nous": "dormions", "vous": "dormiez", "ils/elles": "dormaient",
        },
        "futur_simple": {
            "je": "dormirai", "tu": "dormiras", "il/elle": "dormira",
            "nous": "dormirons", "vous": "dormirez", "ils/elles": "dormiront",
        },
    },
    "attendre": {
        "present": {
            "j'": "attends", "tu": "attends", "il/elle": "attend",
            "nous": "attendons", "vous": "attendez", "ils/elles": "attendent",
        },
        "passe_compose": {
            "j'": "ai attendu", "tu": "as attendu", "il/elle": "a attendu",
            "nous": "avons attendu", "vous": "avez attendu", "ils/elles": "ont attendu",
        },
        "imparfait": {
            "j'": "attendais", "tu": "attendais", "il/elle": "attendait",
            "nous": "attendions", "vous": "attendiez", "ils/elles": "attendaient",
        },
        "futur_simple": {
            "j'": "attendrai", "tu": "attendras", "il/elle": "attendra",
            "nous": "attendrons", "vous": "attendrez", "ils/elles": "attendront",
        },
    },
    "comprendre": {
        "present": {
            "je": "comprends", "tu": "comprends", "il/elle": "comprend",
            "nous": "comprenons", "vous": "comprenez", "ils/elles": "comprennent",
        },
        "passe_compose": {
            "j'": "ai compris", "tu": "as compris", "il/elle": "a compris",
            "nous": "avons compris", "vous": "avez compris", "ils/elles": "ont compris",
        },
        "imparfait": {
            "je": "comprenais", "tu": "comprenais", "il/elle": "comprenait",
            "nous": "comprenions", "vous": "compreniez", "ils/elles": "comprenaient",
        },
        "futur_simple": {
            "je": "comprendrai", "tu": "comprendras", "il/elle": "comprendra",
            "nous": "comprendrons", "vous": "comprendrez", "ils/elles": "comprendront",
        },
    },
    "apprendre": {
        "present": {
            "j'": "apprends", "tu": "apprends", "il/elle": "apprend",
            "nous": "apprenons", "vous": "apprenez", "ils/elles": "apprennent",
        },
        "passe_compose": {
            "j'": "ai appris", "tu": "as appris", "il/elle": "a appris",
            "nous": "avons appris", "vous": "avez appris", "ils/elles": "ont appris",
        },
        "imparfait": {
            "j'": "apprenais", "tu": "apprenais", "il/elle": "apprenait",
            "nous": "apprenions", "vous": "appreniez", "ils/elles": "apprenaient",
        },
        "futur_simple": {
            "j'": "apprendrai", "tu": "apprendras", "il/elle": "apprendra",
            "nous": "apprendrons", "vous": "apprendrez", "ils/elles": "apprendront",
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
