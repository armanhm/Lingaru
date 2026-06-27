import logging

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.dictionary.cache import CacheMissResult, cached_or_call
from apps.dictionary.models import DictionaryCache
from apps.dictionary.parsing import parse_json_response
from services.llm.factory import create_llm_router

logger = logging.getLogger(__name__)

LOOKUP_SYSTEM_PROMPT_FR = (
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
    "Always respond with JSON only, no prose, no markdown."
)

# Keep backward-compatible name used in older code paths / tests.
LOOKUP_SYSTEM_PROMPT = LOOKUP_SYSTEM_PROMPT_FR

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
    "Always respond with JSON only, no prose, no markdown."
)


# Re-exported for callers that imported the parser from this module.
# Source of truth is apps.dictionary.parsing.parse_json_response.
_parse_json_response = parse_json_response


class DictionaryLookupView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        word = (request.data.get("word") or "").strip().lower()
        if not word:
            return Response({"detail": "word is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(word) > 100:
            return Response({"detail": "word is too long."}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.target_language == "en":
            system_prompt = (
                "You are an English dictionary assistant. "
                "Given an English word or phrase, respond ONLY with valid JSON "
                "(no markdown, no extra text) in this exact structure:\n"
                '{"word": "...", "part_of_speech": "noun|verb|adjective|adverb|pronoun|preposition|conjunction|interjection", '
                '"definitions": [{"fr": "...", "en": "..."}], '
                '"examples": [{"fr": "...", "en": "..."}], '
                '"synonyms": ["...", "..."], '
                '"antonyms": ["...", "..."], '
                '"etymology": "...", '
                '"register": "formal|informal|neutral|slang", '
                '"gender": null}\n'
                "Include 2-3 definitions, 2-3 example sentences, up to 5 synonyms, up to 3 antonyms. "
                "etymology may be null if not applicable. gender is always null for English. "
                "Always respond with JSON only, no prose, no markdown."
            )
        else:
            system_prompt = LOOKUP_SYSTEM_PROMPT_FR

        def lookup_llm() -> dict:
            router = create_llm_router()
            llm_result = router.generate(
                messages=[{"role": "user", "content": word}],
                system_prompt=system_prompt,
            )
            parsed = _parse_json_response(llm_result.content)
            if parsed is None:
                # Caller (cached_or_call) translates None to CacheMissResult.
                return {"result": None, "provider": llm_result.provider}
            return {"result": parsed, "provider": llm_result.provider}

        try:
            payload = cached_or_call(
                kind=DictionaryCache.LOOKUP,
                key=word,
                llm_fn=lookup_llm,
                default_cefr=getattr(request.user, "target_level", None),
            )
        except CacheMissResult:
            return Response(
                {"detail": "Could not parse dictionary response. Try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            logger.error("Dictionary lookup failed for %r: %s", word, exc)
            return Response(
                {"detail": "Dictionary lookup failed. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(payload)


class VerbConjugatorView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        if request.user.target_language == "en":
            return Response(
                {
                    "detail": "Conjugation drills are not yet available for English.",
                    "code": "feature_unavailable_for_language",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        verb = (request.data.get("verb") or "").strip().lower()
        if not verb:
            return Response({"detail": "verb is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(verb) > 60:
            return Response({"detail": "verb is too long."}, status=status.HTTP_400_BAD_REQUEST)

        def conjugate_llm() -> dict:
            router = create_llm_router()
            llm_result = router.generate(
                messages=[{"role": "user", "content": verb}],
                system_prompt=CONJUGATE_SYSTEM_PROMPT,
            )
            parsed = _parse_json_response(llm_result.content)
            if parsed is None:
                return {"result": None, "provider": llm_result.provider}
            return {"result": parsed, "provider": llm_result.provider}

        try:
            payload = cached_or_call(
                kind=DictionaryCache.CONJUGATION,
                key=verb,
                llm_fn=conjugate_llm,
                default_cefr=getattr(request.user, "target_level", None),
            )
        except CacheMissResult:
            return Response(
                {"detail": "Could not parse conjugation response. Try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            logger.error("Conjugation failed for %r: %s", verb, exc)
            return Response(
                {"detail": "Conjugation failed. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(payload)
