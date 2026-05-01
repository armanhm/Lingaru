"""Discover card generation service."""

import json
import logging
from datetime import timedelta
from typing import Optional

from django.utils import timezone

from apps.content.models import GrammarRule, Vocabulary
from apps.discover.models import DiscoverCard
from services.llm.factory import create_llm_router
from services.llm.prompts import SYSTEM_PROMPTS

logger = logging.getLogger(__name__)

CARD_EXPIRY_HOURS = 24


def generate_word_card() -> Optional[DiscoverCard]:
    """Generate a Word of the Day card from a random Vocabulary entry."""
    vocab = Vocabulary.objects.order_by("?").first()
    if vocab is None:
        logger.warning("No vocabulary items available for word card generation.")
        return None

    now = timezone.now()
    card = DiscoverCard.objects.create(
        type="word",
        title=vocab.french,
        summary=f"{vocab.french} — {vocab.english}",
        content_json={
            "french": vocab.french,
            "english": vocab.english,
            "pronunciation": vocab.pronunciation,
            "example": vocab.example_sentence,
            "gender": vocab.gender,
            "part_of_speech": vocab.part_of_speech,
        },
        generated_at=now,
        expires_at=now + timedelta(hours=CARD_EXPIRY_HOURS),
    )
    return card


def generate_grammar_card() -> Optional[DiscoverCard]:
    """Generate a Grammar Tip card from a random GrammarRule entry."""
    rule = GrammarRule.objects.order_by("?").first()
    if rule is None:
        logger.warning("No grammar rules available for grammar card generation.")
        return None

    now = timezone.now()
    card = DiscoverCard.objects.create(
        type="grammar",
        title=rule.title,
        summary=rule.explanation[:200],
        content_json={
            "explanation": rule.explanation,
            "formula": rule.formula,
            "examples": rule.examples,
            "exceptions": rule.exceptions,
        },
        generated_at=now,
        expires_at=now + timedelta(hours=CARD_EXPIRY_HOURS),
    )
    return card


def generate_trivia_card() -> Optional[DiscoverCard]:
    """Generate a trivia card using the LLM."""
    try:
        router = create_llm_router()
        response = router.generate(
            messages=[{"role": "user", "content": "Generate a French trivia fact."}],
            system_prompt=SYSTEM_PROMPTS["trivia_generator"],
        )
        data = json.loads(response.content)
    except (RuntimeError, json.JSONDecodeError, KeyError) as exc:
        logger.warning("Failed to generate trivia card: %s", exc)
        return None

    now = timezone.now()
    card = DiscoverCard.objects.create(
        type="trivia",
        title=data.get("title", "French Trivia"),
        summary=data.get("summary", ""),
        content_json={
            "fact_fr": data.get("fact_fr", ""),
            "fact_en": data.get("fact_en", ""),
        },
        generated_at=now,
        expires_at=now + timedelta(hours=CARD_EXPIRY_HOURS),
    )
    return card


VALID_NEWS_TOPICS = {
    "politics", "sports", "culture", "economy", "science",
    "tech", "society", "environ", "world", "misc",
}


def generate_news_card(topic: Optional[str] = None) -> Optional[DiscoverCard]:
    """Generate a news card with three layers of fallback.

    1. RSS-real path (preferred) \u2014 fetch one unseen item from a curated
       French RSS feed for the requested topic, then ask the LLM to rewrite
       it at B1-B2 with vocabulary / expressions / grammar_points. Saves
       the original `source_url` so users can read the source.

    2. LLM-synthetic path \u2014 if no RSS items are available (network down,
       all sources already consumed, etc.) we still ask the LLM to invent
       a plausible article. Used to be the only path; kept for resilience.

    3. Curated offline mock \u2014 when the LLM is also unreachable (no API
       keys / rate-limited), pick the hand-written article matching the
       topic. Works fully offline.
    """

    # \u2500\u2500 Layer 1: real news \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try:
        from apps.discover.news_fetcher import fetch_one_fresh_card
        card = fetch_one_fresh_card(topic=topic)
        if card is not None:
            logger.info("News card from RSS: %s [%s]", card.title[:60], card.source_url)
            return card
    except Exception as exc:
        # Don't swallow this in tests \u2014 but in production we want resilience.
        logger.warning("RSS news fetch failed, falling back to LLM-synthetic: %s", exc)

    # \u2500\u2500 Layer 2: LLM synthetic \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    user_msg = "Generate a simplified French news article for B1-B2 learners."
    if topic and topic in VALID_NEWS_TOPICS:
        user_msg += f" Topic must be: {topic}."

    data = None
    try:
        router = create_llm_router()
        response = router.generate(
            messages=[{"role": "user", "content": user_msg}],
            system_prompt=SYSTEM_PROMPTS["news_generator"],
        )
        data = json.loads(response.content)
    except (RuntimeError, json.JSONDecodeError, KeyError) as exc:
        logger.warning("LLM-synthetic news failed, falling back to curated mock: %s", exc)

    # \u2500\u2500 Layer 3: curated mock \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    if data is None:
        data = _curated_news_mock(topic)

    resolved_topic = data.get("topic") or topic or "misc"
    if resolved_topic not in VALID_NEWS_TOPICS:
        resolved_topic = "misc"

    now = timezone.now()
    card = DiscoverCard.objects.create(
        type="news",
        title=data.get("title", "Actualit\u00e9s"),
        summary=data.get("summary", ""),
        topic=resolved_topic,
        level=(data.get("level") or "B1")[:2],
        content_json={
            "article_fr":     data.get("article_fr", ""),
            "article_en":     data.get("article_en", ""),
            "vocabulary":     data.get("vocabulary") or data.get("key_vocabulary", []),
            "expressions":    data.get("expressions", []),
            "grammar_points": data.get("grammar_points", []),
        },
        generated_at=now,
        expires_at=now + timedelta(hours=CARD_EXPIRY_HOURS * 7),  # news lives for a week
    )
    return card


def _curated_news_mock(topic: Optional[str]) -> dict:
    """Hand-written fallback articles, one per topic, used when the LLM
    is unavailable. Each one matches the LLM-generator JSON shape."""

    library = {
        "politics": {
            "title": "Le Parlement adopte la nouvelle loi sur le climat",
            "summary": "France's parliament passes a sweeping new climate law.",
            "topic": "politics", "level": "B2",
            "article_fr": (
                "L'Assembl\u00e9e nationale a adopt\u00e9 hier soir la nouvelle loi sur le climat, "
                "apr\u00e8s plusieurs mois de d\u00e9bats. Le texte impose aux grandes entreprises "
                "de r\u00e9duire leurs \u00e9missions de gaz \u00e0 effet de serre de 40 % d'ici 2030. "
                "Les \u00e9cologistes saluent un progr\u00e8s, mais regrettent l'absence de mesures "
                "concr\u00e8tes pour les m\u00e9nages les plus modestes. Le S\u00e9nat se prononcera la "
                "semaine prochaine."
            ),
            "article_en": (
                "The National Assembly passed the new climate law last night after months "
                "of debate. The text requires large companies to cut their greenhouse-gas "
                "emissions by 40% by 2030. Greens welcome the progress but regret the lack "
                "of concrete measures for the lowest-income households. The Senate will "
                "vote next week."
            ),
            "vocabulary": [
                {"french": "l'Assembl\u00e9e nationale", "english": "the National Assembly", "pos": "noun phrase", "example_fr": "L'Assembl\u00e9e nationale a vot\u00e9 la loi."},
                {"french": "adopter",   "english": "to pass/adopt",       "pos": "verb",  "example_fr": "Ils ont adopt\u00e9 le texte."},
                {"french": "le d\u00e9bat",  "english": "debate",              "pos": "noun",  "example_fr": "Le d\u00e9bat a dur\u00e9 trois heures."},
                {"french": "imposer",   "english": "to impose, to require","pos": "verb", "example_fr": "La loi impose un quota."},
                {"french": "les m\u00e9nages","english": "households",          "pos": "noun (pl)","example_fr": "Les m\u00e9nages modestes sont aid\u00e9s."},
                {"french": "se prononcer","english": "to rule, to vote",   "pos": "verb (refl.)","example_fr": "Le juge se prononce demain."},
            ],
            "expressions": [
                {"fr": "\u00e0 effet de serre", "en": "greenhouse (effect)",       "note": "Used in \u00ab gaz \u00e0 effet de serre \u00bb \u2014 greenhouse gases."},
                {"fr": "saluer un progr\u00e8s","en": "to welcome progress",       "note": "\u00ab Saluer \u00bb here is figurative \u2014 to acknowledge with approval."},
                {"fr": "d'ici 2030",       "en": "by 2030",                   "note": "\u00ab D'ici \u00bb + date marks a deadline; \u00ab avant 2030 \u00bb is also valid but less formal."},
            ],
            "grammar_points": [
                {"title": "Pass\u00e9 compos\u00e9 with avoir", "explanation": "Most action verbs in news take avoir + past participle.", "example_fr": "L'Assembl\u00e9e a adopt\u00e9 la loi."},
                {"title": "Future tense", "explanation": "Used for upcoming events: -ra/-ront endings.", "example_fr": "Le S\u00e9nat se prononcera la semaine prochaine."},
            ],
        },
        "sports": {
            "title": "Les Bleus se qualifient pour la finale de l'Euro",
            "summary": "France reaches the Euro final after a 2\u20131 win over Spain.",
            "topic": "sports", "level": "B1",
            "article_fr": (
                "L'\u00e9quipe de France de football s'est qualifi\u00e9e hier soir pour la finale de "
                "l'Euro apr\u00e8s une victoire 2-1 contre l'Espagne. Mbapp\u00e9 a marqu\u00e9 le but "
                "d\u00e9cisif \u00e0 la 87e minute. Le s\u00e9lectionneur a salu\u00e9 \"un match courageux\". "
                "La finale aura lieu dimanche soir au Stade de France, devant 80 000 "
                "supporters."
            ),
            "article_en": (
                "France's football team qualified for the Euro final last night after a 2\u20131 "
                "win over Spain. Mbapp\u00e9 scored the decisive goal in the 87th minute. The "
                "head coach hailed \"a brave match\". The final will be held on Sunday "
                "evening at the Stade de France, in front of 80,000 fans."
            ),
            "vocabulary": [
                {"french": "se qualifier", "english": "to qualify",      "pos": "verb (refl.)", "example_fr": "Ils se sont qualifi\u00e9s pour la finale."},
                {"french": "la victoire",  "english": "the win",         "pos": "noun",         "example_fr": "Une belle victoire."},
                {"french": "marquer",      "english": "to score",        "pos": "verb",         "example_fr": "Il a marqu\u00e9 un but."},
                {"french": "le s\u00e9lectionneur","english": "head coach",   "pos": "noun",         "example_fr": "Le s\u00e9lectionneur est satisfait."},
                {"french": "courageux",    "english": "brave",           "pos": "adj",          "example_fr": "Une \u00e9quipe courageuse."},
                {"french": "le supporter", "english": "fan",             "pos": "noun",         "example_fr": "Les supporters chantent."},
            ],
            "expressions": [
                {"fr": "le but d\u00e9cisif",     "en": "the decisive goal",  "note": "Goal that settles the outcome."},
                {"fr": "avoir lieu",         "en": "to take place",      "note": "Common idiom for events: \u00ab le match a lieu samedi \u00bb."},
                {"fr": "devant 80 000 supporters","en": "in front of 80,000 fans","note": "\u00ab Devant \u00bb + crowd: standard phrasing for attendance."},
            ],
            "grammar_points": [
                {"title": "Reflexive verbs in pass\u00e9 compos\u00e9", "explanation": "Reflexives use \u00eatre + agreement.", "example_fr": "L'\u00e9quipe s'est qualifi\u00e9e."},
                {"title": "Future simple",                    "explanation": "Used for scheduled events.",       "example_fr": "La finale aura lieu dimanche."},
            ],
        },
        "culture": {
            "title": "Le Louvre annonce une nouvelle aile contemporaine",
            "summary": "The Louvre will open a new wing dedicated to contemporary art in 2027.",
            "topic": "culture", "level": "B1",
            "article_fr": (
                "Le mus\u00e9e du Louvre a annonc\u00e9 hier la construction d'une nouvelle aile "
                "consacr\u00e9e \u00e0 l'art contemporain. Le projet, sign\u00e9 par l'architecte Kazuyo "
                "Sejima, ouvrira ses portes en 2027. Il accueillera des \u0153uvres pr\u00eat\u00e9es par "
                "des collectionneurs priv\u00e9s ainsi que des installations num\u00e9riques. "
                "L'objectif : attirer un public plus jeune."
            ),
            "article_en": (
                "The Louvre announced yesterday the construction of a new wing dedicated to "
                "contemporary art. The project, designed by architect Kazuyo Sejima, will "
                "open in 2027. It will host works on loan from private collectors as well "
                "as digital installations. The goal: attract a younger audience."
            ),
            "vocabulary": [
                {"french": "annoncer",        "english": "to announce",       "pos": "verb",  "example_fr": "Elle a annonc\u00e9 la nouvelle."},
                {"french": "consacr\u00e9 \u00e0",      "english": "dedicated to",      "pos": "adj phrase", "example_fr": "Une salle consacr\u00e9e \u00e0 Picasso."},
                {"french": "l'aile",          "english": "the wing",          "pos": "noun (f)", "example_fr": "L'aile sud du mus\u00e9e."},
                {"french": "accueillir",      "english": "to host, welcome",  "pos": "verb",  "example_fr": "Le mus\u00e9e accueille 5000 visiteurs."},
                {"french": "pr\u00eat\u00e9",           "english": "on loan",           "pos": "adj",   "example_fr": "Un tableau pr\u00eat\u00e9 par le MoMA."},
                {"french": "attirer",         "english": "to attract",        "pos": "verb",  "example_fr": "Attirer les jeunes."},
            ],
            "expressions": [
                {"fr": "ouvrir ses portes",    "en": "to open (its doors)",   "note": "Used for institutions and events."},
                {"fr": "sign\u00e9 par",            "en": "designed by / signed by","note": "Used for buildings, books, fashion."},
                {"fr": "un public plus jeune", "en": "a younger audience",    "note": "\u00ab Public \u00bb means audience; \u00ab plus jeune \u00bb comparative."},
            ],
            "grammar_points": [
                {"title": "Future simple",     "explanation": "\u00ab ouvrira \u00bb, \u00ab accueillera \u00bb \u2014 -ra ending for the future.", "example_fr": "Il ouvrira en 2027."},
                {"title": "Past participle as adjective","explanation": "\u00ab pr\u00eat\u00e9 \u00bb agrees with the noun it modifies.","example_fr": "Des \u0153uvres pr\u00eat\u00e9es."},
            ],
        },
        "tech": {
            "title": "Une startup parisienne l\u00e8ve 50 millions d'euros pour son IA",
            "summary": "A Paris-based AI startup raises \u20ac50 million in Series B funding.",
            "topic": "tech", "level": "B2",
            "article_fr": (
                "La startup parisienne Mistral a annonc\u00e9 hier avoir lev\u00e9 50 millions "
                "d'euros lors d'une lev\u00e9e de fonds en s\u00e9rie B. L'argent servira \u00e0 "
                "embaucher une centaine d'ing\u00e9nieurs et \u00e0 d\u00e9velopper une nouvelle "
                "g\u00e9n\u00e9ration de mod\u00e8les d'intelligence artificielle. La France compte "
                "d\u00e9sormais cinq licornes dans le secteur de la tech, contre deux il y a "
                "un an."
            ),
            "article_en": (
                "Paris startup Mistral announced yesterday it raised \u20ac50 million in a "
                "Series B funding round. The money will fund hiring around 100 engineers "
                "and developing a new generation of AI models. France now counts five "
                "tech unicorns, up from two a year ago."
            ),
            "vocabulary": [
                {"french": "lever des fonds", "english": "to raise funds",   "pos": "verb phrase", "example_fr": "Ils ont lev\u00e9 5 M\u20ac."},
                {"french": "la lev\u00e9e de fonds","english": "fundraising round","pos": "noun",       "example_fr": "Une lev\u00e9e de fonds r\u00e9ussie."},
                {"french": "embaucher",       "english": "to hire",          "pos": "verb",        "example_fr": "Embaucher dix personnes."},
                {"french": "une licorne",     "english": "unicorn (startup)","pos": "noun",        "example_fr": "Une licorne fran\u00e7aise."},
                {"french": "d\u00e9sormais",       "english": "now / from now on","pos": "adv",         "example_fr": "D\u00e9sormais, c'est interdit."},
                {"french": "le secteur",      "english": "sector",           "pos": "noun",        "example_fr": "Le secteur de la sant\u00e9."},
            ],
            "expressions": [
                {"fr": "une centaine de",       "en": "about a hundred",      "note": "\u00ab -aine \u00bb suffix for approximate counts: dizaine, vingtaine."},
                {"fr": "contre deux il y a un an","en": "vs two a year ago",  "note": "\u00ab contre \u00bb contrasts; \u00ab il y a \u00bb + duration = ago."},
                {"fr": "lors de",               "en": "during / at the time of","note": "Formal alternative to \u00ab pendant \u00bb for specific events."},
            ],
            "grammar_points": [
                {"title": "Future simple with servir \u00e0", "explanation": "\u00ab L'argent servira \u00e0 \u00bb + infinitive \u2014 to be used for.", "example_fr": "L'argent servira \u00e0 embaucher."},
                {"title": "Comparatives",                "explanation": "\u00ab cinq \u2026 contre deux \u00bb contrasts two values.",         "example_fr": "Cinq licornes contre deux."},
            ],
        },
        "science": {
            "title": "D\u00e9couverte d'une nouvelle esp\u00e8ce de poisson en M\u00e9diterran\u00e9e",
            "summary": "Researchers find a new fish species in the Mediterranean Sea.",
            "topic": "science", "level": "B1",
            "article_fr": (
                "Des chercheurs de l'Ifremer ont d\u00e9couvert une nouvelle esp\u00e8ce de poisson "
                "au large des c\u00f4tes corses. Long de seulement quatre centim\u00e8tres, "
                "l'animal vit \u00e0 200 m\u00e8tres de profondeur. Il s'agit du quinzi\u00e8me poisson "
                "identifi\u00e9 dans la r\u00e9gion cette ann\u00e9e. Les scientifiques lui ont donn\u00e9 le "
                "nom provisoire de \"Symphodus corsicus\"."
            ),
            "article_en": (
                "Researchers at Ifremer have discovered a new species of fish off the "
                "coast of Corsica. Just four centimetres long, the animal lives at 200 "
                "metres depth. It is the fifteenth fish identified in the region this "
                "year. Scientists have given it the provisional name \"Symphodus corsicus\"."
            ),
            "vocabulary": [
                {"french": "d\u00e9couvrir",      "english": "to discover",       "pos": "verb", "example_fr": "D\u00e9couvrir un tr\u00e9sor."},
                {"french": "l'esp\u00e8ce",       "english": "the species",       "pos": "noun (f)", "example_fr": "Une esp\u00e8ce rare."},
                {"french": "le chercheur",   "english": "researcher",        "pos": "noun", "example_fr": "Les chercheurs travaillent."},
                {"french": "au large de",    "english": "off the coast of",  "pos": "prep phrase", "example_fr": "Au large de Marseille."},
                {"french": "la profondeur",  "english": "depth",             "pos": "noun", "example_fr": "\u00c0 100 m de profondeur."},
                {"french": "provisoire",     "english": "provisional",       "pos": "adj",  "example_fr": "Un nom provisoire."},
            ],
            "expressions": [
                {"fr": "il s'agit de",        "en": "it is / this is about",  "note": "Impersonal \u2014 never conjugates differently."},
                {"fr": "donner le nom de",    "en": "to give the name of",    "note": "\u00ab Donner un nom \u00e0 \u00bb is also valid for naming."},
                {"fr": "long de quatre cm",   "en": "four cm long",           "note": "\u00ab Long de \u00bb + measurement for size."},
            ],
            "grammar_points": [
                {"title": "Pass\u00e9 compos\u00e9 with avoir", "explanation": "\u00ab ont d\u00e9couvert \u00bb, \u00ab ont donn\u00e9 \u00bb follow the standard pattern.","example_fr": "Ils ont d\u00e9couvert."},
                {"title": "Numbers and approximations","explanation": "\u00ab Le quinzi\u00e8me \u00bb uses ordinal -i\u00e8me.",                       "example_fr": "Le quinzi\u00e8me poisson."},
            ],
        },
        "society": {
            "title": "La semaine de quatre jours test\u00e9e dans 30 entreprises fran\u00e7aises",
            "summary": "Thirty French companies are trialling a four-day work week.",
            "topic": "society", "level": "B1",
            "article_fr": (
                "Trente entreprises fran\u00e7aises participent \u00e0 une exp\u00e9rimentation nationale "
                "sur la semaine de quatre jours. Pendant six mois, leurs salari\u00e9s "
                "travailleront du lundi au jeudi, sans baisse de salaire. Les premiers "
                "r\u00e9sultats montrent une hausse de la productivit\u00e9 et une meilleure sant\u00e9 "
                "mentale. Le ministre du Travail \u00e9voque une \u00e9ventuelle g\u00e9n\u00e9ralisation."
            ),
            "article_en": (
                "Thirty French companies are taking part in a national experiment on the "
                "four-day work week. For six months, their employees will work Monday to "
                "Thursday with no pay cut. Early results show a rise in productivity and "
                "better mental health. The Minister of Labour hints at possible nationwide "
                "rollout."
            ),
            "vocabulary": [
                {"french": "l'entreprise",      "english": "company",         "pos": "noun (f)", "example_fr": "Une grande entreprise."},
                {"french": "le salari\u00e9",        "english": "employee",        "pos": "noun",     "example_fr": "Les salari\u00e9s sont contents."},
                {"french": "la baisse",         "english": "drop, decrease",  "pos": "noun",     "example_fr": "Une baisse des prix."},
                {"french": "la hausse",         "english": "rise, increase",  "pos": "noun",     "example_fr": "La hausse du ch\u00f4mage."},
                {"french": "\u00e9ventuel",          "english": "possible / potential","pos": "adj",  "example_fr": "Un changement \u00e9ventuel."},
                {"french": "\u00e9voquer",           "english": "to mention, hint at","pos": "verb",  "example_fr": "Il \u00e9voque cette id\u00e9e."},
            ],
            "expressions": [
                {"fr": "sans baisse de salaire",  "en": "without a pay cut",  "note": "\u00ab sans \u00bb + noun = without."},
                {"fr": "du lundi au jeudi",       "en": "Monday to Thursday", "note": "\u00ab du \u2026 au \u2026 \u00bb for ranges."},
                {"fr": "la sant\u00e9 mentale",        "en": "mental health",      "note": "Direct cognate; common in news."},
            ],
            "grammar_points": [
                {"title": "Future simple",       "explanation": "Used for plans: \u00ab travailleront \u00bb.",       "example_fr": "Ils travailleront du lundi au jeudi."},
                {"title": "Comparatives with de", "explanation": "\u00ab une meilleure sant\u00e9 \u00bb \u2014 comparative adjective + noun.","example_fr": "Une meilleure sant\u00e9."},
            ],
        },
        "environ": {
            "title": "Paris devient officiellement zone \u00e0 z\u00e9ro \u00e9mission en 2030",
            "summary": "Paris confirms 2030 deadline for full zero-emission zone.",
            "topic": "environ", "level": "B1",
            "article_fr": (
                "La Mairie de Paris a confirm\u00e9 hier que la capitale deviendra une zone \u00e0 "
                "z\u00e9ro \u00e9mission de CO\u2082 d'ici 2030. Tous les v\u00e9hicules thermiques seront "
                "interdits dans le p\u00e9rim\u00e8tre du boulevard p\u00e9riph\u00e9rique. Une aide "
                "financi\u00e8re sera propos\u00e9e aux m\u00e9nages modestes pour acheter un v\u00e9lo ou "
                "une voiture \u00e9lectrique."
            ),
            "article_en": (
                "Paris City Hall confirmed yesterday that the capital will become a zero "
                "CO\u2082 emission zone by 2030. All combustion-engine vehicles will be banned "
                "within the ring road. Financial aid will be offered to low-income "
                "households to buy a bicycle or electric car."
            ),
            "vocabulary": [
                {"french": "la mairie",        "english": "city hall",          "pos": "noun (f)", "example_fr": "La mairie de Lyon."},
                {"french": "thermique",        "english": "combustion-engine",  "pos": "adj",      "example_fr": "Une voiture thermique."},
                {"french": "interdire",        "english": "to ban",             "pos": "verb",     "example_fr": "Interdire la circulation."},
                {"french": "le p\u00e9rim\u00e8tre",     "english": "perimeter",          "pos": "noun",     "example_fr": "Dans le p\u00e9rim\u00e8tre."},
                {"french": "modeste",          "english": "low-income",         "pos": "adj",      "example_fr": "Les familles modestes."},
                {"french": "le p\u00e9riph\u00e9rique",  "english": "ring road",          "pos": "noun",     "example_fr": "Le p\u00e9riph\u00e9rique parisien."},
            ],
            "expressions": [
                {"fr": "d'ici 2030",          "en": "by 2030",                  "note": "\u00ab d'ici \u00bb + date = deadline."},
                {"fr": "zone \u00e0 z\u00e9ro \u00e9mission","en": "zero-emission zone",       "note": "Modeled on English; \u00ab ZFE \u00bb = zone \u00e0 faibles \u00e9missions."},
                {"fr": "une aide financi\u00e8re", "en": "financial aid/support",    "note": "\u00ab aide \u00bb feminine; \u00ab soutien \u00bb masculine = synonym."},
            ],
            "grammar_points": [
                {"title": "Future simple",     "explanation": "\u00ab deviendra \u00bb, \u00ab seront interdits \u00bb mark scheduled changes.","example_fr": "Paris deviendra une zone."},
                {"title": "Passive voice",     "explanation": "\u00ab sera propos\u00e9e \u00bb \u2014 \u00eatre + past participle (agrees in gender).","example_fr": "Une aide sera propos\u00e9e."},
            ],
        },
        "economy": {
            "title": "L'inflation ralentit \u00e0 2,1 % en mars",
            "summary": "French inflation slows to 2.1% in March.",
            "topic": "economy", "level": "B2",
            "article_fr": (
                "L'inflation en France a ralenti \u00e0 2,1 % en mars, contre 2,5 % en f\u00e9vrier, "
                "selon l'Insee. Les prix de l'\u00e9nergie ont nettement baiss\u00e9 tandis que ceux "
                "de l'alimentation continuent de grimper. La Banque centrale europ\u00e9enne "
                "pourrait baisser ses taux d\u00e8s le mois prochain pour soutenir la croissance."
            ),
            "article_en": (
                "Inflation in France slowed to 2.1% in March, down from 2.5% in February, "
                "according to Insee. Energy prices fell notably while food prices keep "
                "climbing. The European Central Bank could cut rates as soon as next month "
                "to support growth."
            ),
            "vocabulary": [
                {"french": "ralentir",     "english": "to slow down",     "pos": "verb",  "example_fr": "Le march\u00e9 ralentit."},
                {"french": "selon",        "english": "according to",     "pos": "prep",  "example_fr": "Selon l'auteur, \u2026"},
                {"french": "nettement",    "english": "notably",          "pos": "adv",   "example_fr": "Nettement mieux."},
                {"french": "baisser",      "english": "to drop / lower",  "pos": "verb",  "example_fr": "Baisser les prix."},
                {"french": "grimper",      "english": "to climb (price)", "pos": "verb",  "example_fr": "Les prix grimpent."},
                {"french": "le taux",      "english": "rate",             "pos": "noun",  "example_fr": "Le taux d'int\u00e9r\u00eat."},
            ],
            "expressions": [
                {"fr": "tandis que",        "en": "while / whereas",     "note": "Formal contrast \u2014 like \u00ab alors que \u00bb."},
                {"fr": "d\u00e8s le mois prochain","en": "as soon as next month","note": "\u00ab d\u00e8s \u00bb signals starting point."},
                {"fr": "soutenir la croissance","en": "to support growth", "note": "Common in economic news."},
            ],
            "grammar_points": [
                {"title": "Conditional",       "explanation": "\u00ab pourrait \u00bb \u2014 softens predictions.",         "example_fr": "Elle pourrait baisser."},
                {"title": "Demonstrative pronoun","explanation": "\u00ab ceux de \u00bb = the ones of (replaces a noun).","example_fr": "Ceux de l'alimentation."},
            ],
        },
        "world": {
            "title": "Le Japon \u00e9lit sa premi\u00e8re Premi\u00e8re ministre",
            "summary": "Japan elects its first female Prime Minister.",
            "topic": "world", "level": "B1",
            "article_fr": (
                "Le Japon a \u00e9lu hier sa premi\u00e8re femme \u00e0 la t\u00eate du gouvernement. Sanae "
                "Takaichi, 64 ans, devient Premi\u00e8re ministre apr\u00e8s la victoire de son "
                "parti aux \u00e9lections l\u00e9gislatives. Elle promet une politique \u00e9conomique "
                "ambitieuse et un renforcement de la s\u00e9curit\u00e9 r\u00e9gionale. La nouvelle a "
                "\u00e9t\u00e9 salu\u00e9e \u00e0 l'\u00e9tranger."
            ),
            "article_en": (
                "Japan elected its first woman head of government yesterday. Sanae "
                "Takaichi, 64, becomes Prime Minister after her party's victory in the "
                "legislative elections. She promises an ambitious economic policy and "
                "strengthened regional security. The news was welcomed abroad."
            ),
            "vocabulary": [
                {"french": "\u00e9lire",           "english": "to elect",         "pos": "verb",   "example_fr": "\u00c9lire un pr\u00e9sident."},
                {"french": "le gouvernement", "english": "the government",   "pos": "noun",   "example_fr": "Le gouvernement d\u00e9cide."},
                {"french": "promettre",       "english": "to promise",       "pos": "verb",   "example_fr": "Il promet de venir."},
                {"french": "le renforcement", "english": "strengthening",    "pos": "noun",   "example_fr": "Un renforcement de la loi."},
                {"french": "saluer",          "english": "to welcome",       "pos": "verb",   "example_fr": "Saluer une d\u00e9cision."},
                {"french": "\u00e0 l'\u00e9tranger",    "english": "abroad",           "pos": "prep phrase","example_fr": "Vivre \u00e0 l'\u00e9tranger."},
            ],
            "expressions": [
                {"fr": "\u00e0 la t\u00eate de",         "en": "at the head of",       "note": "\u00ab \u00eatre \u00e0 la t\u00eate \u00bb = to lead."},
                {"fr": "aux \u00e9lections l\u00e9gislatives","en": "in the legislative elections","note": "\u00ab l\u00e9gislatives \u00bb = parliamentary elections."},
                {"fr": "la nouvelle a \u00e9t\u00e9 salu\u00e9e","en": "the news was welcomed","note": "Passive voice past."},
            ],
            "grammar_points": [
                {"title": "Passive voice in pass\u00e9 compos\u00e9","explanation": "\u00ab a \u00e9t\u00e9 salu\u00e9e \u00bb \u2014 agrees with feminine subject.","example_fr": "La nouvelle a \u00e9t\u00e9 salu\u00e9e."},
                {"title": "Ordinal first",                 "explanation": "\u00ab sa premi\u00e8re Premi\u00e8re ministre \u00bb \u2014 premi\u00e8re = ordinal feminine.","example_fr": "La premi\u00e8re fois."},
            ],
        },
    }

    if topic and topic in library:
        return library[topic]
    # Default: pick a random one to keep variety
    import random
    return random.choice(list(library.values()))


def generate_daily_cards() -> list[DiscoverCard]:
    """Generate one card of each type for the daily feed.

    Returns a list of successfully created cards (skips any that failed).
    """
    # News is generated through the dedicated /api/news/ flow now;
    # the Discover feed only shows word/grammar/trivia.
    generators = [
        generate_word_card,
        generate_grammar_card,
        generate_trivia_card,
    ]

    cards = []
    for gen_fn in generators:
        card = gen_fn()
        if card is not None:
            cards.append(card)

    logger.info("Daily feed generated: %d cards created.", len(cards))
    return cards
