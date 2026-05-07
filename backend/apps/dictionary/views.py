import json
import logging
import re

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.dictionary.models import DictionaryCache
from services.llm.factory import create_llm_router

logger = logging.getLogger(__name__)

LOOKUP_SYSTEM_PROMPT = (
    "You are a French-English dictionary assistant. "
    "Given a French word or phrase, respond ONLY with valid JSON (no markdown, no extra text) "
    "in this exact structure:\n"
    '{"word": "...", "part_of_speech": "noun|verb|adjective|adverb|pronoun|preposition|conjunction|interjection", '
    '"definitions": [{"fr": "...", "en": "..."}], '
    '"examples": [{"fr": "...", "en": "..."}], '
    '"synonyms": ["...", "..."], '
    '"antonyms": ["...", "..."], '
    '"etymology": "...", '
    '"register": "formal|informal|neutral|slang", '
    '"gender": "masculine|feminine|invariable|null"}\n'
    "Include 2-3 definitions, 2-3 example sentences, up to 5 synonyms, up to 3 antonyms. "
    "etymology and gender may be null if not applicable. "
    "Always respond with JSON only — no prose, no markdown."
)

CONJUGATE_SYSTEM_PROMPT = (
    "You are a French verb conjugation engine. "
    "Given a French infinitive verb, respond ONLY with valid JSON (no markdown, no extra text) "
    "in this exact structure:\n"
    '{"verb": "...", "auxiliary": "avoir|etre", '
    '"past_participle": "...", "present_participle": "...", '
    '"tenses": {'
    '"Présent": {"je": "...", "tu": "...", "il/elle": "...", "nous": "...", "vous": "...", "ils/elles": "..."}, '
    '"Imparfait": {"je": "...", "tu": "...", "il/elle": "...", "nous": "...", "vous": "...", "ils/elles": "..."}, '
    '"Passé composé": {"je": "...", "tu": "...", "il/elle": "...", "nous": "...", "vous": "...", "ils/elles": "..."}, '
    '"Futur simple": {"je": "...", "tu": "...", "il/elle": "...", "nous": "...", "vous": "...", "ils/elles": "..."}, '
    '"Conditionnel présent": {"je": "...", "tu": "...", "il/elle": "...", "nous": "...", "vous": "...", "ils/elles": "..."}, '
    '"Subjonctif présent": {"que je": "...", "que tu": "...", "qu\'il/elle": "...", "que nous": "...", "que vous": "...", "qu\'ils/elles": "..."}, '
    '"Impératif": {"tu": "...", "nous": "...", "vous": "..."}, '
    '"Plus-que-parfait": {"j\'": "...", "tu": "...", "il/elle": "...", "nous": "...", "vous": "...", "ils/elles": "..."}'
    "}}\n"
    "Fill in correct conjugated forms with proper French accents. "
    "Always respond with JSON only — no prose, no markdown."
)


def _parse_json_response(text: str) -> dict | None:
    """Extract and parse JSON from LLM response, stripping markdown if present."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return None


class DictionaryLookupView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        word = (request.data.get("word") or "").strip().lower()
        if not word:
            return Response({"detail": "word is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(word) > 100:
            return Response({"detail": "word is too long."}, status=status.HTTP_400_BAD_REQUEST)

        # Check cache first
        cached = DictionaryCache.objects.filter(kind=DictionaryCache.LOOKUP, key=word).first()
        if cached:
            return Response({"result": cached.result, "provider": "cache"})

        try:
            router = create_llm_router()
            llm_result = router.generate(
                messages=[{"role": "user", "content": word}],
                system_prompt=LOOKUP_SYSTEM_PROMPT,
            )
            data = _parse_json_response(llm_result.content)
            if data is None:
                return Response(
                    {"detail": "Could not parse dictionary response. Try again."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            DictionaryCache.objects.update_or_create(
                kind=DictionaryCache.LOOKUP,
                key=word,
                defaults={"result": data},
            )
            return Response({"result": data, "provider": llm_result.provider})
        except Exception as e:
            logger.error("Dictionary lookup failed for %r: %s", word, e)
            return Response(
                {"detail": "Dictionary lookup failed. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class VerbConjugatorView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        verb = (request.data.get("verb") or "").strip().lower()
        if not verb:
            return Response({"detail": "verb is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(verb) > 60:
            return Response({"detail": "verb is too long."}, status=status.HTTP_400_BAD_REQUEST)

        # Check cache first
        cached = DictionaryCache.objects.filter(kind=DictionaryCache.CONJUGATION, key=verb).first()
        if cached:
            return Response({"result": cached.result, "provider": "cache"})

        try:
            router = create_llm_router()
            llm_result = router.generate(
                messages=[{"role": "user", "content": verb}],
                system_prompt=CONJUGATE_SYSTEM_PROMPT,
            )
            data = _parse_json_response(llm_result.content)
            if data is None:
                return Response(
                    {"detail": "Could not parse conjugation response. Try again."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            DictionaryCache.objects.update_or_create(
                kind=DictionaryCache.CONJUGATION,
                key=verb,
                defaults={"result": data},
            )
            return Response({"result": data, "provider": llm_result.provider})
        except Exception as e:
            logger.error("Conjugation failed for %r: %s", verb, e)
            return Response(
                {"detail": "Conjugation failed. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
