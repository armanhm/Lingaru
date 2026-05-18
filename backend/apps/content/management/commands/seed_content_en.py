"""Seed English content for v2.0.0 launch.

5 topics x 5 lessons = 25 lessons total. Each lesson has ~12 vocabulary
items. Numbers chosen to mirror the FR seed shape (apps/content/management/
commands/seed_content.py) so the UX feels consistent.

Idempotent: skips if any EN Topic rows already exist.
"""

from django.core.management.base import BaseCommand

from apps.content.models import Lesson, Topic, Vocabulary


class Command(BaseCommand):
    help = "Seed English content (5 topics, 25 lessons, ~300 vocab)."

    def handle(self, *args, **options):
        if Topic.objects.filter(language="en").exists():
            self.stdout.write(self.style.WARNING("EN content already exists. Skipping seed."))
            return

        self.stdout.write("Seeding EN content...")

        topics_created = 0
        lessons_created = 0
        vocab_created = 0

        # =============================================================
        # TOPIC 1: Greetings & Introductions
        # =============================================================
        t1 = Topic.objects.create(
            name_fr="Greetings & Introductions",
            name_en="Greetings & Introductions",
            description="Learn to greet people and introduce yourself in English.",
            icon="👋",
            order=1,
            difficulty_level=1,
            language="en",
        )
        topics_created += 1

        l1_1 = Lesson.objects.create(
            topic=t1,
            type="vocab",
            title="Basic Greetings",
            content={"intro": "Master the essential English greetings used every day."},
            order=1,
            difficulty=1,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("hello", "bonjour", "interjection", "Hello, how are you?"),
            ("hi", "salut", "interjection", "Hi! Nice to meet you."),
            ("good morning", "bonjour (matin)", "phrase", "Good morning, everyone."),
            ("good evening", "bonsoir", "phrase", "Good evening, ladies and gentlemen."),
            ("good night", "bonne nuit", "phrase", "Good night, sleep well."),
            ("goodbye", "au revoir", "interjection", "Goodbye, see you tomorrow."),
            ("see you later", "à plus tard", "phrase", "See you later, alligator!"),
            ("welcome", "bienvenue", "interjection", "Welcome to our home."),
            ("thanks", "merci", "interjection", "Thanks a lot!"),
            ("thank you", "merci (formel)", "phrase", "Thank you very much."),
            ("please", "s'il te plaît / s'il vous plaît", "adverb", "Please pass the salt."),
            ("excuse me", "excuse-moi / excusez-moi", "phrase", "Excuse me, where's the station?"),
        ]:
            Vocabulary.objects.create(
                lesson=l1_1,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        l1_2 = Lesson.objects.create(
            topic=t1,
            type="vocab",
            title="Introducing Yourself",
            content={"intro": "Tell people your name, age, and where you're from."},
            order=2,
            difficulty=1,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("my name is", "je m'appelle", "phrase", "My name is John."),
            ("I am", "je suis", "phrase", "I am a teacher."),
            ("nice to meet you", "ravi de te rencontrer", "phrase", "Nice to meet you, Sarah."),
            ("pleased to meet you", "enchanté(e)", "phrase", "Pleased to meet you."),
            ("how are you", "comment vas-tu / comment allez-vous", "phrase", "How are you today?"),
            ("I'm fine", "je vais bien", "phrase", "I'm fine, thanks."),
            ("and you", "et toi / et vous", "phrase", "I'm good, and you?"),
            (
                "where are you from",
                "d'où viens-tu / d'où venez-vous",
                "phrase",
                "Where are you from?",
            ),
            ("I'm from", "je viens de", "phrase", "I'm from Canada."),
            ("how old are you", "quel âge as-tu / avez-vous", "phrase", "How old are you?"),
            ("years old", "ans", "noun", "I'm twenty-five years old."),
            ("see you tomorrow", "à demain", "phrase", "See you tomorrow at work."),
        ]:
            Vocabulary.objects.create(
                lesson=l1_2,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        l1_3 = Lesson.objects.create(
            topic=t1,
            type="vocab",
            title="Family Members",
            content={"intro": "Learn the names of family members in English."},
            order=3,
            difficulty=1,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("family", "famille", "noun", "I have a big family."),
            ("father", "père", "noun", "My father is a doctor."),
            ("mother", "mère", "noun", "My mother loves to cook."),
            ("dad", "papa", "noun", "Dad, can I borrow the car?"),
            ("mom", "maman", "noun", "Mom made breakfast."),
            ("parents", "parents", "noun", "My parents live in Boston."),
            ("brother", "frère", "noun", "I have one brother."),
            ("sister", "sœur", "noun", "My sister is older than me."),
            ("son", "fils", "noun", "Their son is at university."),
            ("daughter", "fille", "noun", "Their daughter is a lawyer."),
            ("grandfather", "grand-père", "noun", "My grandfather is 80."),
            ("grandmother", "grand-mère", "noun", "My grandmother tells great stories."),
        ]:
            Vocabulary.objects.create(
                lesson=l1_3,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        l1_4 = Lesson.objects.create(
            topic=t1,
            type="vocab",
            title="Courtesy Phrases",
            content={"intro": "Polite expressions for everyday social interaction."},
            order=4,
            difficulty=1,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("sorry", "désolé(e)", "adjective", "Sorry, I didn't mean it."),
            ("I'm sorry", "je suis désolé(e)", "phrase", "I'm sorry for being late."),
            ("you're welcome", "de rien", "phrase", "You're welcome, anytime."),
            ("no problem", "pas de problème", "phrase", "No problem at all."),
            ("of course", "bien sûr", "phrase", "Of course I can help."),
            ("never mind", "tant pis / laisse tomber", "phrase", "Never mind, it's not important."),
            ("congratulations", "félicitations", "noun", "Congratulations on your promotion!"),
            ("good luck", "bonne chance", "phrase", "Good luck with your exam."),
            ("take care", "prends soin de toi", "phrase", "Take care of yourself."),
            ("have a nice day", "bonne journée", "phrase", "Have a nice day!"),
            ("cheers", "santé / merci (informel)", "interjection", "Cheers, mate!"),
            ("bless you", "à tes souhaits", "phrase", "Bless you! (after a sneeze)"),
        ]:
            Vocabulary.objects.create(
                lesson=l1_4,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        Lesson.objects.create(
            topic=t1,
            type="text",
            title="A First Conversation",
            content={
                "intro": "A simple dialogue between two people meeting for the first time.",
                "dialogue": (
                    "Anna: Hi, I'm Anna. Nice to meet you.\n"
                    "Ben: Hi Anna, I'm Ben. Pleased to meet you too.\n"
                    "Anna: Where are you from, Ben?\n"
                    "Ben: I'm from London. And you?\n"
                    "Anna: I'm from Paris. Are you here on holiday?\n"
                    "Ben: No, I'm here for work. I'm an engineer.\n"
                    "Anna: That's interesting! I'm a journalist.\n"
                    "Ben: Nice. Well, I have to go. See you later!\n"
                    "Anna: See you, Ben! Have a good day."
                ),
            },
            order=5,
            difficulty=2,
            language="en",
        )
        lessons_created += 1

        # =============================================================
        # TOPIC 2: Travel & Transportation
        # =============================================================
        t2 = Topic.objects.create(
            name_fr="Travel & Transportation",
            name_en="Travel & Transportation",
            description="Vocabulary for airports, hotels, and getting around.",
            icon="✈️",
            order=2,
            difficulty_level=2,
            language="en",
        )
        topics_created += 1

        l2_1 = Lesson.objects.create(
            topic=t2,
            type="vocab",
            title="At the Airport",
            content={"intro": "Essential vocabulary for navigating an airport."},
            order=1,
            difficulty=2,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("airport", "aéroport", "noun", "The airport is busy today."),
            ("plane", "avion", "noun", "The plane lands at 3 PM."),
            ("flight", "vol", "noun", "My flight is delayed."),
            ("ticket", "billet", "noun", "I bought my ticket online."),
            ("passport", "passeport", "noun", "Don't forget your passport."),
            ("boarding pass", "carte d'embarquement", "noun", "Show me your boarding pass."),
            ("luggage", "bagages", "noun", "I lost my luggage."),
            ("suitcase", "valise", "noun", "My suitcase is heavy."),
            ("gate", "porte d'embarquement", "noun", "Gate 12 is at the end."),
            ("terminal", "terminal", "noun", "Terminal 3 is for international flights."),
            ("check-in", "enregistrement", "noun", "Check-in opens two hours before."),
            ("security", "sécurité", "noun", "Security took twenty minutes."),
        ]:
            Vocabulary.objects.create(
                lesson=l2_1,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        l2_2 = Lesson.objects.create(
            topic=t2,
            type="vocab",
            title="At the Hotel",
            content={"intro": "Vocabulary for checking in and staying at a hotel."},
            order=2,
            difficulty=2,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("hotel", "hôtel", "noun", "Our hotel is downtown."),
            ("reservation", "réservation", "noun", "I have a reservation."),
            ("room", "chambre", "noun", "Can I see the room?"),
            ("single room", "chambre simple", "noun", "I'd like a single room."),
            ("double room", "chambre double", "noun", "Do you have a double room?"),
            ("key", "clé", "noun", "Here's your key."),
            ("breakfast", "petit-déjeuner", "noun", "Breakfast is from 7 to 10."),
            ("reception", "réception", "noun", "Please wait at reception."),
            ("bill", "facture", "noun", "Could I have the bill?"),
            ("Wi-Fi", "Wi-Fi", "noun", "What's the Wi-Fi password?"),
            ("elevator", "ascenseur", "noun", "The elevator is on the right."),
            ("floor", "étage", "noun", "Your room is on the third floor."),
        ]:
            Vocabulary.objects.create(
                lesson=l2_2,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        l2_3 = Lesson.objects.create(
            topic=t2,
            type="vocab",
            title="Getting Around",
            content={"intro": "Vocabulary for transportation: taxi, bus, train, and more."},
            order=3,
            difficulty=2,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("bus", "bus", "noun", "The bus arrives in five minutes."),
            ("train", "train", "noun", "The train to Paris is fast."),
            ("taxi", "taxi", "noun", "Can you call a taxi?"),
            ("subway", "métro", "noun", "The subway is the fastest way."),
            ("car", "voiture", "noun", "I rented a car for the trip."),
            ("bicycle", "vélo", "noun", "I ride my bicycle to work."),
            ("station", "gare / station", "noun", "Where is the train station?"),
            ("stop", "arrêt", "noun", "This is my bus stop."),
            ("driver", "chauffeur", "noun", "The driver was friendly."),
            ("ticket office", "guichet", "noun", "Buy tickets at the ticket office."),
            ("schedule", "horaire", "noun", "Check the schedule online."),
            ("delay", "retard", "noun", "There's a thirty-minute delay."),
        ]:
            Vocabulary.objects.create(
                lesson=l2_3,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        l2_4 = Lesson.objects.create(
            topic=t2,
            type="vocab",
            title="Asking for Directions",
            content={"intro": "How to ask where things are and understand directions."},
            order=4,
            difficulty=2,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("where is", "où est", "phrase", "Where is the bathroom?"),
            ("how do I get to", "comment aller à", "phrase", "How do I get to the museum?"),
            ("left", "gauche", "noun", "Turn left at the corner."),
            ("right", "droite", "noun", "It's on the right side."),
            ("straight ahead", "tout droit", "phrase", "Go straight ahead."),
            ("around the corner", "au coin de la rue", "phrase", "It's around the corner."),
            ("next to", "à côté de", "phrase", "The pharmacy is next to the bakery."),
            ("across from", "en face de", "phrase", "I live across from the park."),
            ("near", "près", "adjective", "It's near the station."),
            ("far", "loin", "adjective", "Is it far from here?"),
            ("map", "carte / plan", "noun", "Do you have a map?"),
            ("lost", "perdu(e)", "adjective", "I think I'm lost."),
        ]:
            Vocabulary.objects.create(
                lesson=l2_4,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        Lesson.objects.create(
            topic=t2,
            type="text",
            title="A Trip to London",
            content={
                "intro": "A short text about a weekend trip.",
                "dialogue": (
                    "Last weekend, I took the train to London for the first time. "
                    "The journey was quick, only two hours from Paris. When I arrived, "
                    "I took a taxi from the station to my hotel. The driver was very "
                    "friendly and gave me some tips about the city. I checked in at "
                    "reception and went up to my room on the fifth floor. The view "
                    "was wonderful! After resting for an hour, I went out to explore. "
                    "I walked around the streets, visited a small museum, and had "
                    "dinner at a cozy restaurant. London is an amazing city, and I "
                    "can't wait to go back."
                ),
            },
            order=5,
            difficulty=2,
            language="en",
        )
        lessons_created += 1

        # =============================================================
        # TOPIC 3: Food & Restaurant
        # =============================================================
        t3 = Topic.objects.create(
            name_fr="Food & Restaurant",
            name_en="Food & Restaurant",
            description="Order meals, read menus, and talk about food preferences.",
            icon="🍽️",
            order=3,
            difficulty_level=2,
            language="en",
        )
        topics_created += 1

        l3_1 = Lesson.objects.create(
            topic=t3,
            type="vocab",
            title="Common Foods",
            content={"intro": "Everyday food items in English."},
            order=1,
            difficulty=1,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("bread", "pain", "noun", "I'd like some bread, please."),
            ("cheese", "fromage", "noun", "This cheese is delicious."),
            ("meat", "viande", "noun", "I don't eat meat."),
            ("fish", "poisson", "noun", "The fish is fresh today."),
            ("chicken", "poulet", "noun", "Roast chicken for dinner."),
            ("rice", "riz", "noun", "Rice is a staple food."),
            ("pasta", "pâtes", "noun", "I love Italian pasta."),
            ("vegetables", "légumes", "noun", "Eat your vegetables."),
            ("fruit", "fruit", "noun", "Fruit is a healthy snack."),
            ("apple", "pomme", "noun", "An apple a day."),
            ("egg", "œuf", "noun", "I'll have two eggs."),
            ("soup", "soupe", "noun", "Vegetable soup is comforting."),
        ]:
            Vocabulary.objects.create(
                lesson=l3_1,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        l3_2 = Lesson.objects.create(
            topic=t3,
            type="vocab",
            title="Drinks",
            content={"intro": "Common beverages and how to ask for them."},
            order=2,
            difficulty=1,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("water", "eau", "noun", "Could I have water, please?"),
            ("coffee", "café", "noun", "I drink coffee in the morning."),
            ("tea", "thé", "noun", "Black tea, please."),
            ("juice", "jus", "noun", "Orange juice, no ice."),
            ("milk", "lait", "noun", "Milk in your coffee?"),
            ("wine", "vin", "noun", "A glass of red wine."),
            ("beer", "bière", "noun", "Two beers, please."),
            ("soda", "soda / boisson gazeuse", "noun", "A soda would be nice."),
            ("sparkling water", "eau gazeuse", "noun", "Sparkling water with lemon."),
            ("still water", "eau plate", "noun", "Still water, please."),
            ("hot chocolate", "chocolat chaud", "noun", "Hot chocolate in winter."),
            ("smoothie", "smoothie", "noun", "I made a banana smoothie."),
        ]:
            Vocabulary.objects.create(
                lesson=l3_2,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        l3_3 = Lesson.objects.create(
            topic=t3,
            type="vocab",
            title="Ordering at a Restaurant",
            content={"intro": "Phrases for ordering in restaurants and cafés."},
            order=3,
            difficulty=2,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("menu", "menu / carte", "noun", "Could I see the menu?"),
            ("waiter", "serveur", "noun", "The waiter is bringing the bill."),
            ("waitress", "serveuse", "noun", "The waitress was kind."),
            ("I'd like", "je voudrais", "phrase", "I'd like the soup of the day."),
            ("starter", "entrée", "noun", "What do you have for starters?"),
            ("main course", "plat principal", "noun", "For the main course, the steak."),
            ("dessert", "dessert", "noun", "Dessert is on the house."),
            ("bill", "addition", "noun", "Could we have the bill?"),
            ("tip", "pourboire", "noun", "Don't forget the tip."),
            ("reservation", "réservation", "noun", "I have a reservation for two."),
            ("table for two", "table pour deux", "phrase", "A table for two, please."),
            ("rare / well-done", "saignant / bien cuit", "adjective", "Medium-rare, please."),
        ]:
            Vocabulary.objects.create(
                lesson=l3_3,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        l3_4 = Lesson.objects.create(
            topic=t3,
            type="vocab",
            title="Cooking & Kitchen",
            content={"intro": "Things you find in the kitchen and cooking actions."},
            order=4,
            difficulty=2,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("kitchen", "cuisine", "noun", "The kitchen is small but cozy."),
            ("oven", "four", "noun", "Preheat the oven to 200°C."),
            ("stove", "cuisinière", "noun", "The stove has four burners."),
            ("fridge", "réfrigérateur", "noun", "The milk is in the fridge."),
            ("knife", "couteau", "noun", "Sharp knife, careful!"),
            ("fork", "fourchette", "noun", "Eat with a fork."),
            ("spoon", "cuillère", "noun", "Mix with a spoon."),
            ("plate", "assiette", "noun", "Clean plates in the cupboard."),
            ("glass", "verre", "noun", "Pour water in your glass."),
            ("to cook", "cuisiner", "verb", "I cook every evening."),
            ("to bake", "cuire au four", "verb", "She loves to bake cookies."),
            ("to chop", "hacher", "verb", "Chop the onions finely."),
        ]:
            Vocabulary.objects.create(
                lesson=l3_4,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        Lesson.objects.create(
            topic=t3,
            type="text",
            title="A Café Conversation",
            content={
                "intro": "Ordering breakfast at a café.",
                "dialogue": (
                    "Waiter: Good morning! What can I get you?\n"
                    "Customer: Good morning. I'd like a coffee, please.\n"
                    "Waiter: Sure. Anything to eat?\n"
                    "Customer: Yes, a croissant and a glass of orange juice.\n"
                    "Waiter: Would you like the juice with ice?\n"
                    "Customer: No, just cold, thanks.\n"
                    "Waiter: Coming right up.\n"
                    "(later)\n"
                    "Customer: Excuse me, could I have the bill?\n"
                    "Waiter: Of course. That'll be eight pounds fifty.\n"
                    "Customer: Here you are. Keep the change.\n"
                    "Waiter: Thank you, have a nice day!"
                ),
            },
            order=5,
            difficulty=2,
            language="en",
        )
        lessons_created += 1

        # =============================================================
        # TOPIC 4: Work & Daily Life
        # =============================================================
        t4 = Topic.objects.create(
            name_fr="Work & Daily Life",
            name_en="Work & Daily Life",
            description="Talk about jobs, schedules, and everyday routines.",
            icon="💼",
            order=4,
            difficulty_level=2,
            language="en",
        )
        topics_created += 1

        l4_1 = Lesson.objects.create(
            topic=t4,
            type="vocab",
            title="Jobs & Professions",
            content={"intro": "Common jobs and how to talk about your work."},
            order=1,
            difficulty=2,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("job", "emploi", "noun", "I have a new job."),
            ("work", "travail", "noun", "Work was busy today."),
            ("teacher", "professeur", "noun", "She's a math teacher."),
            ("doctor", "médecin", "noun", "He's a doctor at the hospital."),
            ("engineer", "ingénieur", "noun", "I work as a software engineer."),
            ("nurse", "infirmier / infirmière", "noun", "The nurse was very kind."),
            ("lawyer", "avocat(e)", "noun", "My brother is a lawyer."),
            ("student", "étudiant(e)", "noun", "She's a university student."),
            ("manager", "directeur / directrice", "noun", "Talk to your manager about it."),
            ("salesperson", "vendeur / vendeuse", "noun", "The salesperson was helpful."),
            ("driver", "chauffeur", "noun", "He's a taxi driver."),
            ("artist", "artiste", "noun", "She's a talented artist."),
        ]:
            Vocabulary.objects.create(
                lesson=l4_1,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        l4_2 = Lesson.objects.create(
            topic=t4,
            type="vocab",
            title="The Office",
            content={"intro": "Office vocabulary and workplace phrases."},
            order=2,
            difficulty=2,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("office", "bureau", "noun", "Our office is downtown."),
            ("meeting", "réunion", "noun", "I have a meeting at 3."),
            ("colleague", "collègue", "noun", "My colleague helped me."),
            ("boss", "patron / patronne", "noun", "Talk to your boss."),
            ("desk", "bureau (meuble)", "noun", "Clean your desk."),
            ("computer", "ordinateur", "noun", "The computer is slow today."),
            ("email", "courriel / e-mail", "noun", "I'll send you an email."),
            ("phone call", "appel téléphonique", "noun", "I have a phone call to make."),
            ("project", "projet", "noun", "The project is going well."),
            ("deadline", "date limite", "noun", "The deadline is Friday."),
            ("salary", "salaire", "noun", "Salaries are paid monthly."),
            ("vacation", "vacances", "noun", "I'm on vacation next week."),
        ]:
            Vocabulary.objects.create(
                lesson=l4_2,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        l4_3 = Lesson.objects.create(
            topic=t4,
            type="vocab",
            title="Daily Routine",
            content={"intro": "Talking about everyday activities."},
            order=3,
            difficulty=2,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("to wake up", "se réveiller", "verb", "I wake up at 7."),
            ("to get up", "se lever", "verb", "I get up early."),
            ("to have breakfast", "prendre le petit-déjeuner", "verb", "We have breakfast at 8."),
            ("to go to work", "aller au travail", "verb", "I go to work by bus."),
            ("to have lunch", "déjeuner", "verb", "She has lunch at noon."),
            ("to come home", "rentrer à la maison", "verb", "He comes home at 6."),
            ("to have dinner", "dîner", "verb", "We have dinner together."),
            ("to watch TV", "regarder la télé", "verb", "I watch TV in the evening."),
            ("to read", "lire", "verb", "I read before bed."),
            ("to go to bed", "se coucher", "verb", "I go to bed at 11."),
            ("to sleep", "dormir", "verb", "I sleep eight hours."),
            ("to relax", "se détendre", "verb", "I relax on weekends."),
        ]:
            Vocabulary.objects.create(
                lesson=l4_3,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        l4_4 = Lesson.objects.create(
            topic=t4,
            type="vocab",
            title="Errands & Shopping",
            content={"intro": "Vocabulary for running errands and shopping."},
            order=4,
            difficulty=2,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("shop", "magasin", "noun", "The shop opens at 9."),
            ("supermarket", "supermarché", "noun", "I go to the supermarket once a week."),
            ("bakery", "boulangerie", "noun", "Fresh bread at the bakery."),
            ("pharmacy", "pharmacie", "noun", "The pharmacy is on the corner."),
            ("bank", "banque", "noun", "I need to go to the bank."),
            ("post office", "bureau de poste", "noun", "Mail it at the post office."),
            ("cash", "espèces / argent liquide", "noun", "I'll pay in cash."),
            ("credit card", "carte de crédit", "noun", "Do you take credit cards?"),
            ("receipt", "reçu / ticket", "noun", "Keep the receipt."),
            ("change", "monnaie", "noun", "Here's your change."),
            ("on sale", "en solde", "phrase", "These shoes are on sale."),
            ("expensive", "cher / chère", "adjective", "That's too expensive."),
        ]:
            Vocabulary.objects.create(
                lesson=l4_4,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        Lesson.objects.create(
            topic=t4,
            type="text",
            title="A Day at Work",
            content={
                "intro": "A typical workday described in simple English.",
                "dialogue": (
                    "I usually wake up at 6:30 in the morning. I have a quick "
                    "breakfast — coffee and toast — and leave the house at 7:30. "
                    "I take the bus to the office, which takes about 25 minutes. "
                    "At work, I check my emails first and then attend a team meeting. "
                    "I'm a project manager, so I spend a lot of time talking with my "
                    "colleagues and following up on tasks. I have lunch at 12:30 with "
                    "a coworker, usually at a small café nearby. In the afternoon, "
                    "I work on reports and answer phone calls. I leave the office "
                    "around 6 PM and head home. In the evening, I cook dinner, "
                    "watch a bit of TV, and read for an hour before bed. It's a "
                    "simple routine, but I enjoy it."
                ),
            },
            order=5,
            difficulty=2,
            language="en",
        )
        lessons_created += 1

        # =============================================================
        # TOPIC 5: Numbers, Time & Dates
        # =============================================================
        t5 = Topic.objects.create(
            name_fr="Numbers, Time & Dates",
            name_en="Numbers, Time & Dates",
            description="Counting, telling time, and talking about dates.",
            icon="🔢",
            order=5,
            difficulty_level=1,
            language="en",
        )
        topics_created += 1

        l5_1 = Lesson.objects.create(
            topic=t5,
            type="vocab",
            title="Cardinal Numbers",
            content={"intro": "Counting from zero to twenty."},
            order=1,
            difficulty=1,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("zero", "zéro", "noun", "Zero degrees outside."),
            ("one", "un", "noun", "One apple, please."),
            ("two", "deux", "noun", "I have two brothers."),
            ("three", "trois", "noun", "Three coffees, please."),
            ("four", "quatre", "noun", "We need four chairs."),
            ("five", "cinq", "noun", "It's five o'clock."),
            ("ten", "dix", "noun", "Ten minutes left."),
            ("twenty", "vingt", "noun", "Twenty euros, please."),
            ("fifty", "cinquante", "noun", "About fifty people came."),
            ("one hundred", "cent", "noun", "One hundred percent sure."),
            ("one thousand", "mille", "noun", "A thousand thanks!"),
            ("a million", "un million", "noun", "It's worth a million dollars."),
        ]:
            Vocabulary.objects.create(
                lesson=l5_1,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        l5_2 = Lesson.objects.create(
            topic=t5,
            type="vocab",
            title="Telling Time",
            content={"intro": "How to ask for and tell time in English."},
            order=2,
            difficulty=1,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("hour", "heure", "noun", "The class lasts an hour."),
            ("minute", "minute", "noun", "Wait one minute, please."),
            ("second", "seconde", "noun", "It only takes a second."),
            ("o'clock", "heure (pile)", "phrase", "It's three o'clock."),
            ("half past", "et demie", "phrase", "It's half past four."),
            ("quarter past", "et quart", "phrase", "It's quarter past two."),
            ("quarter to", "moins le quart", "phrase", "Quarter to seven."),
            ("morning", "matin", "noun", "Good morning!"),
            ("afternoon", "après-midi", "noun", "See you this afternoon."),
            ("evening", "soir", "noun", "Have a nice evening."),
            ("night", "nuit", "noun", "Good night."),
            ("noon / midday", "midi", "noun", "Lunch at noon."),
        ]:
            Vocabulary.objects.create(
                lesson=l5_2,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        l5_3 = Lesson.objects.create(
            topic=t5,
            type="vocab",
            title="Days of the Week",
            content={"intro": "The seven days of the week."},
            order=3,
            difficulty=1,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("Monday", "lundi", "noun", "I work on Mondays."),
            ("Tuesday", "mardi", "noun", "We meet on Tuesday."),
            ("Wednesday", "mercredi", "noun", "Wednesday is my favorite day."),
            ("Thursday", "jeudi", "noun", "See you Thursday."),
            ("Friday", "vendredi", "noun", "Happy Friday!"),
            ("Saturday", "samedi", "noun", "I sleep in on Saturday."),
            ("Sunday", "dimanche", "noun", "Sunday is for family."),
            ("weekend", "week-end", "noun", "Have a great weekend."),
            ("weekday", "jour de semaine", "noun", "I work weekdays."),
            ("today", "aujourd'hui", "noun", "What's today's date?"),
            ("yesterday", "hier", "noun", "Yesterday was Monday."),
            ("tomorrow", "demain", "noun", "See you tomorrow."),
        ]:
            Vocabulary.objects.create(
                lesson=l5_3,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        l5_4 = Lesson.objects.create(
            topic=t5,
            type="vocab",
            title="Months & Seasons",
            content={"intro": "Months of the year and the four seasons."},
            order=4,
            difficulty=1,
            language="en",
        )
        lessons_created += 1
        for english, french, pos, example in [
            ("January", "janvier", "noun", "January is cold."),
            ("February", "février", "noun", "February has 28 days."),
            ("March", "mars", "noun", "Spring starts in March."),
            ("April", "avril", "noun", "It rains a lot in April."),
            ("May", "mai", "noun", "Flowers bloom in May."),
            ("June", "juin", "noun", "School ends in June."),
            ("July", "juillet", "noun", "July is summer."),
            ("December", "décembre", "noun", "December has Christmas."),
            ("spring", "printemps", "noun", "I love spring."),
            ("summer", "été", "noun", "Summer vacation is the best."),
            ("autumn / fall", "automne", "noun", "Autumn leaves are beautiful."),
            ("winter", "hiver", "noun", "Winter is cold here."),
        ]:
            Vocabulary.objects.create(
                lesson=l5_4,
                english=english,
                french=french,
                example_sentence=example,
                part_of_speech=pos,
                language="en",
            )
            vocab_created += 1

        Lesson.objects.create(
            topic=t5,
            type="text",
            title="Planning the Week",
            content={
                "intro": "Talking about plans for the week ahead.",
                "dialogue": (
                    "Lisa: Are you free this weekend?\n"
                    "Tom: Let me check. On Saturday morning I'm seeing my parents, "
                    "but I'm free in the afternoon.\n"
                    "Lisa: What about Sunday?\n"
                    "Tom: Sunday is wide open. What did you have in mind?\n"
                    "Lisa: How about a picnic in the park? The weather should be nice.\n"
                    "Tom: That sounds great. What time?\n"
                    "Lisa: How about noon? We can have lunch outdoors.\n"
                    "Tom: Perfect. I'll bring sandwiches and drinks.\n"
                    "Lisa: I'll bring dessert and a blanket. See you Sunday at noon!\n"
                    "Tom: Looking forward to it!"
                ),
            },
            order=5,
            difficulty=2,
            language="en",
        )
        lessons_created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"EN seed: +{topics_created} topics, "
                f"+{lessons_created} lessons, +{vocab_created} vocab"
            )
        )
