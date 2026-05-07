"""Seed initial exam prep exercises for CE (reading) and CO (listening)."""

from django.core.management.base import BaseCommand

from apps.exam_prep.models import ExamExercise

CE_EXERCISES = [
    # A1
    {
        "section": "CE",
        "cefr_level": "A1",
        "title": "Au café",
        "order": 1,
        "instructions_fr": "Lisez le texte et répondez aux questions.",
        "instructions_en": "Read the text and answer the questions.",
        "time_limit_seconds": 180,
        "content": {
            "text_fr": "Bonjour ! Je m'appelle Marie. J'ai 25 ans. J'habite à Paris. Je suis étudiante. Le matin, je vais au café. Je prends un café et un croissant. Le café est bon. Le croissant est chaud.",
            "text_en": "Hello! My name is Marie. I am 25 years old. I live in Paris. I am a student. In the morning, I go to the café. I have a coffee and a croissant. The coffee is good. The croissant is warm.",
            "questions": [
                {
                    "prompt": "Comment s'appelle la personne ?",
                    "options": ["Marie", "Sophie", "Julie", "Claire"],
                    "correct_answer": "Marie",
                    "explanation": "Le texte dit : « Je m'appelle Marie. »",
                },
                {
                    "prompt": "Où habite Marie ?",
                    "options": ["À Lyon", "À Paris", "À Marseille", "À Nice"],
                    "correct_answer": "À Paris",
                    "explanation": "Le texte dit : « J'habite à Paris. »",
                },
                {
                    "prompt": "Que prend Marie au café ?",
                    "options": [
                        "Un thé et un pain",
                        "Un café et un croissant",
                        "Un jus et un gâteau",
                        "Un chocolat et une tartine",
                    ],
                    "correct_answer": "Un café et un croissant",
                    "explanation": "Le texte dit : « Je prends un café et un croissant. »",
                },
            ],
        },
    },
    {
        "section": "CE",
        "cefr_level": "A1",
        "title": "La famille de Pierre",
        "order": 2,
        "instructions_fr": "Lisez le texte et répondez aux questions.",
        "instructions_en": "Read the text and answer the questions.",
        "time_limit_seconds": 180,
        "content": {
            "text_fr": "Je m'appelle Pierre. J'ai une grande famille. Mon père s'appelle Jean et ma mère s'appelle Isabelle. J'ai deux sœurs : Sophie et Léa. Sophie a 20 ans et Léa a 15 ans. Nous habitons dans une maison avec un jardin. Le week-end, nous mangeons ensemble.",
            "text_en": "My name is Pierre. I have a big family. My father's name is Jean and my mother's name is Isabelle. I have two sisters: Sophie and Léa. Sophie is 20 and Léa is 15. We live in a house with a garden. On weekends, we eat together.",
            "questions": [
                {
                    "prompt": "Combien de sœurs a Pierre ?",
                    "options": ["Une", "Deux", "Trois", "Zéro"],
                    "correct_answer": "Deux",
                    "explanation": "Le texte dit : « J'ai deux sœurs : Sophie et Léa. »",
                },
                {
                    "prompt": "Quel âge a Léa ?",
                    "options": ["20 ans", "25 ans", "15 ans", "10 ans"],
                    "correct_answer": "15 ans",
                    "explanation": "Le texte dit : « Léa a 15 ans. »",
                },
                {
                    "prompt": "Où habite la famille ?",
                    "options": [
                        "Dans un appartement",
                        "Dans une maison",
                        "À l'hôtel",
                        "Chez des amis",
                    ],
                    "correct_answer": "Dans une maison",
                    "explanation": "Le texte dit : « Nous habitons dans une maison avec un jardin. »",
                },
            ],
        },
    },
    # A2
    {
        "section": "CE",
        "cefr_level": "A2",
        "title": "Une journée à Lyon",
        "order": 3,
        "instructions_fr": "Lisez le texte et répondez aux questions.",
        "instructions_en": "Read the text and answer the questions.",
        "time_limit_seconds": 240,
        "content": {
            "text_fr": "Samedi dernier, je suis allé à Lyon avec mes amis. Nous avons pris le train à 8 heures du matin. Le voyage a duré deux heures. À Lyon, nous avons visité le Vieux Lyon et nous avons mangé dans un bouchon lyonnais. J'ai pris des quenelles, c'est une spécialité locale. L'après-midi, nous avons marché le long du Rhône. Il faisait beau. Nous sommes rentrés fatigués mais contents.",
            "text_en": "Last Saturday, I went to Lyon with my friends. We took the train at 8 in the morning. The trip lasted two hours. In Lyon, we visited the Old Lyon and we ate in a Lyonnais bouchon. I had quenelles, it's a local specialty. In the afternoon, we walked along the Rhône. The weather was nice. We came back tired but happy.",
            "questions": [
                {
                    "prompt": "Quand sont-ils allés à Lyon ?",
                    "options": ["Vendredi", "Samedi", "Dimanche", "Lundi"],
                    "correct_answer": "Samedi",
                    "explanation": "Le texte dit : « Samedi dernier, je suis allé à Lyon. »",
                },
                {
                    "prompt": "Combien de temps a duré le voyage ?",
                    "options": ["Une heure", "Deux heures", "Trois heures", "Trente minutes"],
                    "correct_answer": "Deux heures",
                    "explanation": "Le texte dit : « Le voyage a duré deux heures. »",
                },
                {
                    "prompt": "Qu'est-ce que le narrateur a mangé ?",
                    "options": ["Une pizza", "Des quenelles", "Un steak", "Une salade"],
                    "correct_answer": "Des quenelles",
                    "explanation": "Le texte dit : « J'ai pris des quenelles, c'est une spécialité locale. »",
                },
                {
                    "prompt": "Comment étaient-ils en rentrant ?",
                    "options": ["Tristes", "En colère", "Fatigués mais contents", "Malades"],
                    "correct_answer": "Fatigués mais contents",
                    "explanation": "Le texte dit : « Nous sommes rentrés fatigués mais contents. »",
                },
            ],
        },
    },
    # B1
    {
        "section": "CE",
        "cefr_level": "B1",
        "title": "Le télétravail en France",
        "order": 4,
        "instructions_fr": "Lisez le texte et répondez aux questions.",
        "instructions_en": "Read the text and answer the questions.",
        "time_limit_seconds": 300,
        "content": {
            "text_fr": "Depuis la pandémie de 2020, le télétravail s'est considérablement développé en France. Selon une étude récente, environ 30% des salariés français travaillent régulièrement depuis leur domicile, au moins un jour par semaine. Les avantages sont nombreux : gain de temps sur les trajets, meilleur équilibre entre vie professionnelle et personnelle, et réduction des coûts pour les entreprises.\n\nCependant, le télétravail présente aussi des inconvénients. Beaucoup de travailleurs ressentent un sentiment d'isolement et ont du mal à séparer leur vie privée de leur vie professionnelle. De plus, certains métiers ne peuvent tout simplement pas être exercés à distance.\n\nLes experts estiment que le modèle hybride — alternant jours au bureau et jours à la maison — est probablement la solution d'avenir. Ce modèle permettrait de combiner les avantages des deux modes de travail.",
            "text_en": "Since the 2020 pandemic, remote work has significantly expanded in France. According to a recent study, about 30% of French employees regularly work from home, at least one day a week. The advantages are numerous: time saved on commuting, better work-life balance, and cost reduction for companies.\n\nHowever, remote work also has disadvantages. Many workers feel a sense of isolation and have difficulty separating their private and professional lives. Moreover, some jobs simply cannot be done remotely.\n\nExperts believe that the hybrid model — alternating office and home days — is probably the solution for the future. This model would combine the advantages of both work modes.",
            "questions": [
                {
                    "prompt": "Quel pourcentage de salariés français pratiquent le télétravail régulièrement ?",
                    "options": ["10%", "20%", "30%", "50%"],
                    "correct_answer": "30%",
                    "explanation": "Le texte dit : « environ 30% des salariés français travaillent régulièrement depuis leur domicile ».",
                },
                {
                    "prompt": "Quel est un inconvénient du télétravail mentionné dans le texte ?",
                    "options": [
                        "Le coût élevé",
                        "Le sentiment d'isolement",
                        "Le manque de technologie",
                        "Les horaires fixes",
                    ],
                    "correct_answer": "Le sentiment d'isolement",
                    "explanation": "Le texte dit : « Beaucoup de travailleurs ressentent un sentiment d'isolement. »",
                },
                {
                    "prompt": "Quelle est la solution proposée par les experts ?",
                    "options": [
                        "Supprimer le télétravail",
                        "Travailler uniquement à la maison",
                        "Le modèle hybride",
                        "Réduire les heures de travail",
                    ],
                    "correct_answer": "Le modèle hybride",
                    "explanation": "Le texte dit : « le modèle hybride — alternant jours au bureau et jours à la maison — est probablement la solution d'avenir ».",
                },
                {
                    "prompt": "Depuis quand le télétravail s'est-il développé en France ?",
                    "options": ["Depuis 2015", "Depuis 2018", "Depuis 2020", "Depuis 2022"],
                    "correct_answer": "Depuis 2020",
                    "explanation": "Le texte dit : « Depuis la pandémie de 2020 ».",
                },
            ],
        },
    },
]

CO_EXERCISES = [
    # A1
    {
        "section": "CO",
        "cefr_level": "A1",
        "title": "Au marché",
        "order": 1,
        "instructions_fr": "Écoutez le dialogue et répondez aux questions.",
        "instructions_en": "Listen to the dialogue and answer the questions.",
        "time_limit_seconds": 120,
        "content": {
            "passage_fr": "Bonjour madame ! Je voudrais trois pommes et un kilo de bananes, s'il vous plaît. Voilà, ça fait quatre euros cinquante. Merci, au revoir !",
            "questions": [
                {
                    "prompt": "Que veut acheter le client ?",
                    "options": [
                        "Des oranges",
                        "Des pommes et des bananes",
                        "Du pain",
                        "Du fromage",
                    ],
                    "correct_answer": "Des pommes et des bananes",
                    "explanation": "Le client dit : « trois pommes et un kilo de bananes ».",
                },
                {
                    "prompt": "Combien coûte l'achat ?",
                    "options": ["3,50 €", "4,50 €", "5,00 €", "2,50 €"],
                    "correct_answer": "4,50 €",
                    "explanation": "La vendeuse dit : « ça fait quatre euros cinquante ».",
                },
            ],
        },
    },
    {
        "section": "CO",
        "cefr_level": "A1",
        "title": "À la gare",
        "order": 2,
        "instructions_fr": "Écoutez l'annonce et répondez aux questions.",
        "instructions_en": "Listen to the announcement and answer the questions.",
        "time_limit_seconds": 120,
        "content": {
            "passage_fr": "Attention, le train numéro 7542 à destination de Marseille va partir du quai numéro 3 dans cinq minutes. Les voyageurs sont priés de monter à bord.",
            "questions": [
                {
                    "prompt": "Où va le train ?",
                    "options": ["À Paris", "À Lyon", "À Marseille", "À Bordeaux"],
                    "correct_answer": "À Marseille",
                    "explanation": "L'annonce dit : « à destination de Marseille ».",
                },
                {
                    "prompt": "De quel quai part le train ?",
                    "options": ["Quai 1", "Quai 2", "Quai 3", "Quai 5"],
                    "correct_answer": "Quai 3",
                    "explanation": "L'annonce dit : « du quai numéro 3 ».",
                },
                {
                    "prompt": "Dans combien de temps part le train ?",
                    "options": ["2 minutes", "5 minutes", "10 minutes", "15 minutes"],
                    "correct_answer": "5 minutes",
                    "explanation": "L'annonce dit : « dans cinq minutes ».",
                },
            ],
        },
    },
    # A2
    {
        "section": "CO",
        "cefr_level": "A2",
        "title": "Réservation au restaurant",
        "order": 3,
        "instructions_fr": "Écoutez le dialogue et répondez aux questions.",
        "instructions_en": "Listen to the dialogue and answer the questions.",
        "time_limit_seconds": 180,
        "content": {
            "passage_fr": "Allô, restaurant Le Petit Bistrot, bonjour. Bonjour, je voudrais réserver une table pour quatre personnes, s'il vous plaît. C'est pour quand ? Pour samedi soir, vers 20 heures. D'accord, à quel nom ? Au nom de Dupont. Très bien, monsieur Dupont. Votre table est réservée pour samedi à 20 heures.",
            "questions": [
                {
                    "prompt": "Pour combien de personnes est la réservation ?",
                    "options": ["Deux", "Trois", "Quatre", "Six"],
                    "correct_answer": "Quatre",
                    "explanation": "Le client dit : « une table pour quatre personnes ».",
                },
                {
                    "prompt": "Quand est la réservation ?",
                    "options": ["Vendredi midi", "Samedi soir", "Dimanche midi", "Lundi soir"],
                    "correct_answer": "Samedi soir",
                    "explanation": "Le client dit : « Pour samedi soir, vers 20 heures. »",
                },
                {
                    "prompt": "Quel est le nom du client ?",
                    "options": ["Martin", "Dubois", "Dupont", "Moreau"],
                    "correct_answer": "Dupont",
                    "explanation": "Le client dit : « Au nom de Dupont. »",
                },
            ],
        },
    },
    # B1
    {
        "section": "CO",
        "cefr_level": "B1",
        "title": "La météo de la semaine",
        "order": 4,
        "instructions_fr": "Écoutez le bulletin météo et répondez aux questions.",
        "instructions_en": "Listen to the weather forecast and answer the questions.",
        "time_limit_seconds": 180,
        "content": {
            "passage_fr": "Voici la météo pour cette semaine. Lundi et mardi, le temps sera ensoleillé sur l'ensemble du pays avec des températures agréables, autour de 22 degrés. Mercredi, des nuages arriveront par l'ouest et il pleuvra en Bretagne et en Normandie. Jeudi et vendredi, la pluie s'étendra à toute la France avec des températures en baisse, autour de 15 degrés. Le week-end, le soleil reviendra progressivement.",
            "questions": [
                {
                    "prompt": "Quel temps fera-t-il lundi ?",
                    "options": ["Il pleuvra", "Il neigera", "Il fera beau", "Il y aura du vent"],
                    "correct_answer": "Il fera beau",
                    "explanation": "Le bulletin dit : « le temps sera ensoleillé ».",
                },
                {
                    "prompt": "Où pleuvra-t-il mercredi ?",
                    "options": [
                        "Dans le sud",
                        "En Bretagne et Normandie",
                        "À Paris",
                        "Dans les Alpes",
                    ],
                    "correct_answer": "En Bretagne et Normandie",
                    "explanation": "Le bulletin dit : « il pleuvra en Bretagne et en Normandie ».",
                },
                {
                    "prompt": "Quelle sera la température jeudi ?",
                    "options": ["22 degrés", "18 degrés", "15 degrés", "10 degrés"],
                    "correct_answer": "15 degrés",
                    "explanation": "Le bulletin dit : « autour de 15 degrés ».",
                },
                {
                    "prompt": "Quand le soleil reviendra-t-il ?",
                    "options": ["Mercredi", "Jeudi", "Vendredi", "Le week-end"],
                    "correct_answer": "Le week-end",
                    "explanation": "Le bulletin dit : « Le week-end, le soleil reviendra progressivement. »",
                },
            ],
        },
    },
]


EE_EXERCISES = [
    {
        "section": "EE",
        "cefr_level": "A1",
        "title": "Se présenter",
        "order": 1,
        "instructions_fr": "Écrivez un court texte pour vous présenter.",
        "instructions_en": "Write a short text introducing yourself.",
        "time_limit_seconds": 300,
        "content": {
            "prompt_fr": "Présentez-vous en français : votre nom, votre âge, votre ville, votre profession et une chose que vous aimez faire.",
            "prompt_en": "Introduce yourself in French: your name, age, city, job, and one thing you enjoy doing.",
            "word_limit": 60,
            "rubric": "A1 level: simple sentences, basic vocabulary, present tense. Expect 3-5 sentences.",
        },
    },
    {
        "section": "EE",
        "cefr_level": "A2",
        "title": "Un e-mail à un ami",
        "order": 2,
        "instructions_fr": "Écrivez un e-mail à un ami français.",
        "instructions_en": "Write an email to a French friend.",
        "time_limit_seconds": 600,
        "content": {
            "prompt_fr": "Écrivez un e-mail à votre ami français Paul. Racontez-lui votre week-end dernier : où vous êtes allé, ce que vous avez fait, et avec qui.",
            "prompt_en": "Write an email to your French friend Paul. Tell him about your last weekend: where you went, what you did, and with whom.",
            "word_limit": 100,
            "rubric": "A2 level: past tense (passé composé), time expressions, informal register. Expect 5-8 sentences.",
        },
    },
    {
        "section": "EE",
        "cefr_level": "B1",
        "title": "Lettre de motivation",
        "order": 3,
        "instructions_fr": "Écrivez une lettre pour postuler à un emploi d'été.",
        "instructions_en": "Write a letter applying for a summer job.",
        "time_limit_seconds": 900,
        "content": {
            "prompt_fr": "Vous voulez travailler dans un café français pendant l'été. Écrivez une lettre de motivation : présentez-vous, expliquez pourquoi vous voulez ce travail, et décrivez vos qualités.",
            "prompt_en": "You want to work in a French café during summer. Write a cover letter: introduce yourself, explain why you want this job, and describe your qualities.",
            "word_limit": 150,
            "rubric": "B1 level: formal register, conditional tense, connectors (car, donc, cependant), structured paragraphs.",
        },
    },
]

EO_EXERCISES = [
    {
        "section": "EO",
        "cefr_level": "A1",
        "title": "Parler de soi",
        "order": 1,
        "instructions_fr": "Parlez de vous pendant 30 secondes.",
        "instructions_en": "Talk about yourself for 30 seconds.",
        "time_limit_seconds": 45,
        "content": {
            "prompt_fr": "Présentez-vous : dites votre nom, votre nationalité, votre ville et ce que vous aimez.",
            "prompt_en": "Introduce yourself: say your name, nationality, city, and what you like.",
            "duration_seconds": 30,
            "rubric": "A1 level: basic pronunciation, simple sentences, present tense.",
        },
    },
    {
        "section": "EO",
        "cefr_level": "A2",
        "title": "Décrire sa journée",
        "order": 2,
        "instructions_fr": "Décrivez une journée typique.",
        "instructions_en": "Describe a typical day.",
        "time_limit_seconds": 60,
        "content": {
            "prompt_fr": "Décrivez votre journée typique : à quelle heure vous vous levez, ce que vous faites le matin, l'après-midi et le soir.",
            "prompt_en": "Describe your typical day: what time you get up, what you do in the morning, afternoon, and evening.",
            "duration_seconds": 45,
            "rubric": "A2 level: reflexive verbs, time expressions, daily routine vocabulary.",
        },
    },
    {
        "section": "EO",
        "cefr_level": "B1",
        "title": "Donner son opinion",
        "order": 3,
        "instructions_fr": "Donnez votre opinion sur un sujet.",
        "instructions_en": "Give your opinion on a topic.",
        "time_limit_seconds": 90,
        "content": {
            "prompt_fr": "Les réseaux sociaux sont-ils bons ou mauvais pour les jeunes ? Donnez votre opinion avec des arguments et des exemples.",
            "prompt_en": "Are social media good or bad for young people? Give your opinion with arguments and examples.",
            "duration_seconds": 60,
            "rubric": "B1 level: opinion expressions (je pense que, à mon avis), arguments with connectors, subjunctive optional.",
        },
    },
]


class Command(BaseCommand):
    help = "Seed initial exam prep exercises for CE and CO sections."

    def handle(self, *args, **options):
        self.stdout.write("Seeding exam prep exercises...")
        count = 0
        for data in CE_EXERCISES + CO_EXERCISES + EE_EXERCISES + EO_EXERCISES:
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
                self.stdout.write(f"  Created: {data['title']}")
            else:
                self.stdout.write(f"  Exists: {data['title']}")
        self.stdout.write(self.style.SUCCESS(f"Done! {count} new exercises created."))
