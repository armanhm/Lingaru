"""Seed exam exercises for ALL CEFR levels (A1-C2) across all 4 sections."""

from django.core.management.base import BaseCommand

from apps.exam_prep.models import ExamExercise

EXERCISES = [
    # ═══════════════════════════════════════════════════════════════
    # CE — Compréhension écrite (Reading)
    # ═══════════════════════════════════════════════════════════════
    {
        "section": "CE",
        "cefr_level": "A1",
        "title": "L'emploi du temps de Camille",
        "order": 10,
        "time_limit_seconds": 180,
        "instructions_fr": "Lisez le texte et répondez aux questions.",
        "instructions_en": "Read the text and answer the questions.",
        "content": {
            "text_fr": "Camille est infirmière. Elle travaille à l'hôpital. Le lundi, elle commence à 7 heures. Elle déjeune à midi à la cafétéria. Le soir, elle rentre chez elle à 19 heures. Le week-end, elle ne travaille pas. Elle fait du sport et elle voit ses amis.",
            "questions": [
                {
                    "prompt": "Quelle est la profession de Camille ?",
                    "options": ["Professeur", "Infirmière", "Secrétaire", "Médecin"],
                    "correct_answer": "Infirmière",
                },
                {
                    "prompt": "À quelle heure commence-t-elle le lundi ?",
                    "options": ["6 heures", "7 heures", "8 heures", "9 heures"],
                    "correct_answer": "7 heures",
                },
                {
                    "prompt": "Que fait-elle le week-end ?",
                    "options": ["Elle travaille", "Elle voyage", "Elle fait du sport", "Elle dort"],
                    "correct_answer": "Elle fait du sport",
                },
            ],
        },
    },
    {
        "section": "CE",
        "cefr_level": "A2",
        "title": "Annonce de location",
        "order": 11,
        "time_limit_seconds": 240,
        "content": {
            "text_fr": "À louer : appartement 3 pièces, 65 m², au 3ème étage avec ascenseur. Situé dans le centre-ville, proche des commerces et des transports. Cuisine équipée, salle de bains avec douche, un balcon. Chauffage collectif inclus. Loyer : 850 € par mois, charges comprises. Disponible à partir du 1er mars. Contacter M. Bertrand au 06 12 34 56 78.",
            "questions": [
                {
                    "prompt": "Combien de pièces a l'appartement ?",
                    "options": ["2", "3", "4", "5"],
                    "correct_answer": "3",
                },
                {
                    "prompt": "À quel étage se trouve l'appartement ?",
                    "options": ["1er", "2ème", "3ème", "4ème"],
                    "correct_answer": "3ème",
                },
                {
                    "prompt": "Quel est le loyer mensuel ?",
                    "options": ["750 €", "800 €", "850 €", "900 €"],
                    "correct_answer": "850 €",
                },
                {
                    "prompt": "Quand l'appartement est-il disponible ?",
                    "options": ["1er janvier", "1er février", "1er mars", "1er avril"],
                    "correct_answer": "1er mars",
                },
            ],
        },
    },
    {
        "section": "CE",
        "cefr_level": "B2",
        "title": "L'intelligence artificielle dans l'éducation",
        "order": 12,
        "time_limit_seconds": 360,
        "content": {
            "text_fr": "L'intelligence artificielle transforme progressivement le secteur éducatif. Des plateformes d'apprentissage adaptatif utilisent désormais des algorithmes pour personnaliser le parcours de chaque élève, identifiant ses lacunes et ajustant le niveau de difficulté en temps réel.\n\nLes partisans de ces technologies soulignent que l'IA permet une différenciation pédagogique impossible à réaliser pour un enseignant seul face à trente élèves. Les détracteurs, en revanche, s'inquiètent d'une déshumanisation de l'enseignement et du risque de créer une dépendance technologique.\n\nUne étude menée par l'Université de Montpellier montre que les élèves utilisant ces outils progressent en moyenne 20% plus vite en mathématiques, mais que leurs compétences sociales et leur autonomie n'en bénéficient pas. Le débat reste ouvert quant à l'équilibre optimal entre technologie et accompagnement humain.",
            "questions": [
                {
                    "prompt": "Que permettent les algorithmes d'IA dans l'éducation ?",
                    "options": [
                        "Remplacer les enseignants",
                        "Personnaliser le parcours de chaque élève",
                        "Réduire les coûts",
                        "Augmenter le nombre d'élèves",
                    ],
                    "correct_answer": "Personnaliser le parcours de chaque élève",
                },
                {
                    "prompt": "Quelle crainte expriment les détracteurs ?",
                    "options": [
                        "Le coût élevé",
                        "La déshumanisation de l'enseignement",
                        "Le manque de recherche",
                        "La lenteur des progrès",
                    ],
                    "correct_answer": "La déshumanisation de l'enseignement",
                },
                {
                    "prompt": "Quel résultat montre l'étude de Montpellier ?",
                    "options": [
                        "Les élèves progressent 20% plus vite en maths",
                        "Les élèves sont plus sociables",
                        "Les enseignants sont plus satisfaits",
                        "Les coûts diminuent de 20%",
                    ],
                    "correct_answer": "Les élèves progressent 20% plus vite en maths",
                },
                {
                    "prompt": "Quel aspect n'est pas amélioré par l'IA selon l'étude ?",
                    "options": [
                        "Les notes en maths",
                        "Les compétences sociales et l'autonomie",
                        "La motivation",
                        "La lecture",
                    ],
                    "correct_answer": "Les compétences sociales et l'autonomie",
                },
            ],
        },
    },
    {
        "section": "CE",
        "cefr_level": "C1",
        "title": "La gentrification des quartiers populaires",
        "order": 13,
        "time_limit_seconds": 420,
        "content": {
            "text_fr": "La gentrification, phénomène urbain consistant en la transformation de quartiers populaires par l'arrivée de populations plus aisées, suscite un débat croissant dans les métropoles françaises. À Paris, le processus est particulièrement visible dans les arrondissements du nord-est, jadis ouvriers, aujourd'hui parsemés de cafés branchés et de boutiques de créateurs.\n\nLes mécanismes sont bien identifiés : attirés par des loyers relativement bas et une authenticité culturelle, les premiers arrivants — souvent des artistes et des jeunes cadres — insufflent une dynamique nouvelle. S'ensuit une hausse des prix immobiliers qui contraint les habitants historiques, aux revenus plus modestes, à quitter le quartier.\n\nLes municipalités tentent de concilier renouvellement urbain et mixité sociale par des dispositifs tels que le logement social obligatoire. Toutefois, ces mesures peinent à endiguer un phénomène largement porté par les forces du marché. Certains sociologues plaident pour une approche plus radicale, incluant l'encadrement strict des loyers et la préemption systématique par les collectivités.",
            "questions": [
                {
                    "prompt": "Comment le texte définit-il la gentrification ?",
                    "options": [
                        "La construction de nouveaux immeubles",
                        "La transformation de quartiers populaires par l'arrivée de populations aisées",
                        "La rénovation des bâtiments historiques",
                        "L'expansion des banlieues",
                    ],
                    "correct_answer": "La transformation de quartiers populaires par l'arrivée de populations aisées",
                },
                {
                    "prompt": "Qui sont les premiers arrivants selon le texte ?",
                    "options": [
                        "Des familles nombreuses",
                        "Des retraités",
                        "Des artistes et jeunes cadres",
                        "Des étudiants étrangers",
                    ],
                    "correct_answer": "Des artistes et jeunes cadres",
                },
                {
                    "prompt": "Quelle conséquence subissent les habitants historiques ?",
                    "options": [
                        "Ils deviennent propriétaires",
                        "Ils sont contraints de quitter le quartier",
                        "Ils bénéficient de meilleurs services",
                        "Ils reçoivent des subventions",
                    ],
                    "correct_answer": "Ils sont contraints de quitter le quartier",
                },
                {
                    "prompt": "Que proposent certains sociologues ?",
                    "options": [
                        "Supprimer le logement social",
                        "L'encadrement strict des loyers et la préemption",
                        "Interdire les nouvelles constructions",
                        "Encourager la gentrification",
                    ],
                    "correct_answer": "L'encadrement strict des loyers et la préemption",
                },
            ],
        },
    },
    {
        "section": "CE",
        "cefr_level": "C2",
        "title": "Épistémologie de la traduction littéraire",
        "order": 14,
        "time_limit_seconds": 480,
        "content": {
            "text_fr": "La question de la fidélité en traduction littéraire se pose avec une acuité renouvelée à l'ère de la mondialisation culturelle. Si les théoriciens classiques, à l'instar d'Eugène Nida, distinguaient entre équivalence formelle et équivalence dynamique, les approches contemporaines — notamment celles d'Antoine Berman et de Lawrence Venuti — ont complexifié le débat en introduisant les notions d'éthique de la traduction et de résistance à l'ethnocentrisme.\n\nBerman, dans « L'épreuve de l'étranger », argumente que toute bonne traduction doit préserver l'altérité du texte source plutôt que de le domestiquer au profit des conventions de la culture cible. Cette posture, qualifiée de « sourcière », s'oppose à la tradition « cibliste » qui privilégie la lisibilité et l'idiomaticité.\n\nLa traduction automatique neuronale, malgré ses progrès spectaculaires dans le domaine technique, demeure impuissante face aux subtilités stylistiques, aux jeux de mots et aux résonances intertextuelles qui font la substance même de la littérature. Le traducteur humain reste, pour l'heure, le seul médiateur capable de négocier entre la lettre et l'esprit d'une œuvre.",
            "questions": [
                {
                    "prompt": "Quelle distinction classique Nida établit-il ?",
                    "options": [
                        "Traduction libre et traduction littérale",
                        "Équivalence formelle et équivalence dynamique",
                        "Traduction sourcière et traduction cibliste",
                        "Traduction technique et traduction littéraire",
                    ],
                    "correct_answer": "Équivalence formelle et équivalence dynamique",
                },
                {
                    "prompt": "Que défend Berman selon le texte ?",
                    "options": [
                        "La domestication du texte",
                        "La préservation de l'altérité du texte source",
                        "L'utilisation de la traduction automatique",
                        "La primauté de la lisibilité",
                    ],
                    "correct_answer": "La préservation de l'altérité du texte source",
                },
                {
                    "prompt": "Pourquoi la traduction automatique reste-t-elle insuffisante pour la littérature ?",
                    "options": [
                        "Elle est trop lente",
                        "Elle ne peut saisir les subtilités stylistiques et intertextuelles",
                        "Elle coûte trop cher",
                        "Elle ne traduit pas le français",
                    ],
                    "correct_answer": "Elle ne peut saisir les subtilités stylistiques et intertextuelles",
                },
            ],
        },
    },
    # ═══════════════════════════════════════════════════════════════
    # CO — Compréhension orale (Listening)
    # ═══════════════════════════════════════════════════════════════
    {
        "section": "CO",
        "cefr_level": "A2",
        "title": "Message sur le répondeur",
        "order": 10,
        "time_limit_seconds": 120,
        "content": {
            "passage_fr": "Bonjour Sophie, c'est Nathalie. Je t'appelle pour te dire que le dîner de samedi est annulé parce que Marc est malade. On peut reporter à la semaine prochaine, samedi 15. Est-ce que ça te convient ? Rappelle-moi quand tu peux. Bisous !",
            "questions": [
                {
                    "prompt": "Pourquoi le dîner est-il annulé ?",
                    "options": [
                        "Sophie est en voyage",
                        "Marc est malade",
                        "Le restaurant est fermé",
                        "Nathalie travaille",
                    ],
                    "correct_answer": "Marc est malade",
                },
                {
                    "prompt": "Quand est proposé le nouveau dîner ?",
                    "options": ["Dimanche", "Vendredi 14", "Samedi 15", "Samedi 22"],
                    "correct_answer": "Samedi 15",
                },
            ],
        },
    },
    {
        "section": "CO",
        "cefr_level": "B2",
        "title": "Interview d'un chef cuisinier",
        "order": 11,
        "time_limit_seconds": 240,
        "content": {
            "passage_fr": "Merci d'être avec nous aujourd'hui, Chef Arnaud. Alors, qu'est-ce qui vous a inspiré à devenir chef ? Eh bien, j'ai grandi dans le sud de la France, entouré de marchés, de produits frais, et ma grand-mère cuisinait des plats extraordinaires. Pour moi, la cuisine, c'est avant tout le partage et le respect du produit. Aujourd'hui, dans mon restaurant, j'essaie de travailler exclusivement avec des producteurs locaux. C'est plus cher, certes, mais la qualité est incomparable. Et votre plus grand défi ? Former la nouvelle génération de cuisiniers à cette philosophie. Les jeunes veulent aller vite, mais la bonne cuisine demande de la patience et de l'humilité.",
            "questions": [
                {
                    "prompt": "Où a grandi le Chef Arnaud ?",
                    "options": [
                        "À Paris",
                        "Dans le nord",
                        "Dans le sud de la France",
                        "En Belgique",
                    ],
                    "correct_answer": "Dans le sud de la France",
                },
                {
                    "prompt": "Quelle est sa philosophie de cuisine ?",
                    "options": [
                        "Cuisiner rapidement",
                        "Le partage et le respect du produit",
                        "Utiliser des produits importés",
                        "Suivre les tendances",
                    ],
                    "correct_answer": "Le partage et le respect du produit",
                },
                {
                    "prompt": "Quel est son plus grand défi ?",
                    "options": [
                        "Ouvrir un deuxième restaurant",
                        "Former la nouvelle génération",
                        "Trouver des clients",
                        "Écrire un livre",
                    ],
                    "correct_answer": "Former la nouvelle génération",
                },
            ],
        },
    },
    {
        "section": "CO",
        "cefr_level": "C1",
        "title": "Débat sur l'écologie urbaine",
        "order": 12,
        "time_limit_seconds": 300,
        "content": {
            "passage_fr": "Le concept de ville durable ne se limite pas à la multiplication des espaces verts. Il implique une refonte complète de nos modes de vie urbains. Prenons l'exemple du transport : interdire les voitures du centre-ville ne suffit pas si l'on ne développe pas simultanément des alternatives crédibles. À Strasbourg, la combinaison tramway, vélo en libre-service et zones piétonnes a réduit la pollution de 30 pour cent en dix ans. Mais soyons honnêtes, ce modèle fonctionne pour une ville de taille moyenne. Pour les métropoles comme Paris ou Lyon, les enjeux sont autrement plus complexes. Il faudrait repenser l'urbanisme à l'échelle régionale, en décentralisant les emplois et les services pour réduire les déplacements quotidiens.",
            "questions": [
                {
                    "prompt": "Selon l'intervenant, à quoi ne se limite pas la ville durable ?",
                    "options": [
                        "Aux espaces verts",
                        "Aux transports",
                        "À l'économie",
                        "À l'éducation",
                    ],
                    "correct_answer": "Aux espaces verts",
                },
                {
                    "prompt": "Quel résultat a obtenu Strasbourg ?",
                    "options": [
                        "Augmentation du tourisme",
                        "Réduction de la pollution de 30%",
                        "Doublement de la population",
                        "Construction de nouveaux quartiers",
                    ],
                    "correct_answer": "Réduction de la pollution de 30%",
                },
                {
                    "prompt": "Que faudrait-il pour les grandes métropoles ?",
                    "options": [
                        "Plus de voitures électriques",
                        "Repenser l'urbanisme à l'échelle régionale",
                        "Construire plus de parkings",
                        "Interdire les vélos",
                    ],
                    "correct_answer": "Repenser l'urbanisme à l'échelle régionale",
                },
            ],
        },
    },
    {
        "section": "CO",
        "cefr_level": "C2",
        "title": "Conférence sur la mémoire collective",
        "order": 13,
        "time_limit_seconds": 360,
        "content": {
            "passage_fr": "La notion de mémoire collective, telle que théorisée par Maurice Halbwachs, postule que nos souvenirs individuels sont indissociables des cadres sociaux dans lesquels ils s'inscrivent. Cette perspective, longtemps marginalisée au profit d'une approche cognitiviste centrée sur l'individu, connaît un regain d'intérêt considérable depuis les travaux de Pierre Nora sur les lieux de mémoire. Ce qui est particulièrement fascinant, c'est la manière dont les sociétés contemporaines instrumentalisent la mémoire à des fins politiques. La commémoration, loin d'être un acte neutre de rappel du passé, constitue un acte performatif qui façonne l'identité nationale et légitime certains récits au détriment d'autres.",
            "questions": [
                {
                    "prompt": "Qui a théorisé la mémoire collective ?",
                    "options": [
                        "Pierre Nora",
                        "Maurice Halbwachs",
                        "Michel Foucault",
                        "Émile Durkheim",
                    ],
                    "correct_answer": "Maurice Halbwachs",
                },
                {
                    "prompt": "Que postule la mémoire collective ?",
                    "options": [
                        "Les souvenirs sont purement individuels",
                        "Les souvenirs sont indissociables des cadres sociaux",
                        "La mémoire est génétique",
                        "Les souvenirs sont toujours fiables",
                    ],
                    "correct_answer": "Les souvenirs sont indissociables des cadres sociaux",
                },
                {
                    "prompt": "Comment le texte qualifie-t-il la commémoration ?",
                    "options": [
                        "Un acte neutre",
                        "Un acte performatif",
                        "Un acte scientifique",
                        "Un acte religieux",
                    ],
                    "correct_answer": "Un acte performatif",
                },
            ],
        },
    },
    # ═══════════════════════════════════════════════════════════════
    # EE — Expression écrite (Writing)
    # ═══════════════════════════════════════════════════════════════
    {
        "section": "EE",
        "cefr_level": "B2",
        "title": "Essai argumentatif",
        "order": 10,
        "time_limit_seconds": 1200,
        "content": {
            "prompt_fr": "Le gouvernement souhaite interdire les téléphones portables dans les écoles. Êtes-vous pour ou contre cette mesure ? Développez votre argumentation avec des exemples concrets.",
            "prompt_en": "The government wants to ban mobile phones in schools. Are you for or against? Develop your argument with concrete examples.",
            "word_limit": 200,
            "rubric": "B2: clear argumentation, connectors (néanmoins, en revanche, d'une part/d'autre part), conditional, subjunctive in opinion clauses.",
        },
    },
    {
        "section": "EE",
        "cefr_level": "C1",
        "title": "Synthèse de documents",
        "order": 11,
        "time_limit_seconds": 1500,
        "content": {
            "prompt_fr": "Rédigez une synthèse sur le thème suivant : Les avantages et les inconvénients du travail à distance. Présentez les différents points de vue de manière objective, puis donnez votre opinion personnelle dans une conclusion.",
            "prompt_en": "Write a synthesis on remote work: advantages and disadvantages. Present different viewpoints objectively, then give your personal opinion in a conclusion.",
            "word_limit": 250,
            "rubric": "C1: nuanced argumentation, formal register, complex syntax (participle clauses, subjunctive), varied connectors, clear structure with introduction/development/conclusion.",
        },
    },
    {
        "section": "EE",
        "cefr_level": "C2",
        "title": "Critique littéraire",
        "order": 12,
        "time_limit_seconds": 1800,
        "content": {
            "prompt_fr": "Rédigez une critique littéraire d'un livre que vous avez lu récemment (réel ou fictif). Analysez le style de l'auteur, les thèmes abordés et l'impact de l'œuvre sur le lecteur. Justifiez votre appréciation avec des exemples précis tirés du texte.",
            "prompt_en": "Write a literary critique of a book you have recently read (real or fictional). Analyze the author's style, themes, and the work's impact on the reader.",
            "word_limit": 300,
            "rubric": "C2: sophisticated vocabulary, literary analysis terminology, nuanced judgments, elegant style, mastery of all tenses and moods.",
        },
    },
    # ═══════════════════════════════════════════════════════════════
    # EO — Expression orale (Speaking)
    # ═══════════════════════════════════════════════════════════════
    {
        "section": "EO",
        "cefr_level": "B2",
        "title": "Débat sur un sujet de société",
        "order": 10,
        "time_limit_seconds": 120,
        "content": {
            "prompt_fr": "Faut-il rendre les transports en commun gratuits dans les grandes villes ? Présentez des arguments pour et contre, puis donnez votre opinion.",
            "prompt_en": "Should public transport be free in large cities? Present arguments for and against, then give your opinion.",
            "duration_seconds": 90,
            "rubric": "B2: structured argument, connectors, conditional, opinion expressions, clear pronunciation.",
        },
    },
    {
        "section": "EO",
        "cefr_level": "C1",
        "title": "Présentation formelle",
        "order": 11,
        "time_limit_seconds": 180,
        "content": {
            "prompt_fr": "Présentez un sujet qui vous passionne comme si vous étiez devant un public professionnel. Structurez votre présentation avec une introduction, un développement et une conclusion.",
            "prompt_en": "Present a topic you are passionate about as if before a professional audience. Structure your presentation with an introduction, development, and conclusion.",
            "duration_seconds": 120,
            "rubric": "C1: formal register, complex sentences, varied vocabulary, clear structure, confident delivery.",
        },
    },
    {
        "section": "EO",
        "cefr_level": "C2",
        "title": "Analyse d'une citation",
        "order": 12,
        "time_limit_seconds": 180,
        "content": {
            "prompt_fr": "Commentez cette citation de Camus : « La vraie générosité envers l'avenir consiste à tout donner au présent. » Expliquez-la, donnez votre interprétation personnelle et illustrez-la avec des exemples.",
            "prompt_en": "Comment on this Camus quote: 'True generosity toward the future consists in giving everything to the present.' Explain it, give your interpretation, and illustrate with examples.",
            "duration_seconds": 120,
            "rubric": "C2: philosophical analysis, elegant expression, literary references, mastery of nuance and register.",
        },
    },
]


class Command(BaseCommand):
    help = "Seed exam exercises for all CEFR levels (A1-C2) across all sections."

    def handle(self, *args, **options):
        self.stdout.write("Seeding exam exercises for all levels...")
        count = 0
        for data in EXERCISES:
            _, created = ExamExercise.objects.get_or_create(
                section=data["section"],
                cefr_level=data["cefr_level"],
                title=data["title"],
                defaults={
                    "instructions_fr": data.get("instructions_fr", ""),
                    "instructions_en": data.get("instructions_en", ""),
                    "content": data["content"],
                    "time_limit_seconds": data.get("time_limit_seconds", 0),
                    "order": data.get("order", 0),
                },
            )
            if created:
                count += 1
                self.stdout.write(
                    f"  Created: [{data['section']}/{data['cefr_level']}] {data['title']}"
                )
            else:
                self.stdout.write(f"  Exists: {data['title']}")
        self.stdout.write(self.style.SUCCESS(f"Done! {count} new exercises created."))
