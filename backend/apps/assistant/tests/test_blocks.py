"""Lock down the block parser schema.

These tests double as documentation for the LLM block format. If you add
a new block type, mirror its acceptance criteria here.
"""

import json

from apps.assistant.blocks import extract_blocks


def _wrap(blocks):
    return "Here you go:\n```blocks\n" + json.dumps(blocks) + "\n```"


class TestPlainText:
    def test_no_fence_returns_text_unchanged(self):
        prose, blocks = extract_blocks("Just a plain reply.")
        assert prose == "Just a plain reply."
        assert blocks == []

    def test_empty_input(self):
        assert extract_blocks("") == ("", [])

    def test_malformed_json_keeps_original_text(self):
        # If we can't parse, leave the fence in the visible reply so the
        # user (or developer) can see what went wrong.
        raw = "Here:\n```blocks\n{not json}\n```"
        prose, blocks = extract_blocks(raw)
        assert prose == raw
        assert blocks == []


class TestAudioBlock:
    def test_minimal(self):
        _, blocks = extract_blocks(_wrap([{"type": "audio", "text": "bonjour"}]))
        assert blocks == [{"type": "audio", "text": "bonjour", "lang": "fr"}]

    def test_with_lang(self):
        _, blocks = extract_blocks(_wrap([{"type": "audio", "text": "hello", "lang": "en"}]))
        assert blocks[0]["lang"] == "en"

    def test_drops_when_text_missing(self):
        _, blocks = extract_blocks(_wrap([{"type": "audio"}]))
        assert blocks == []


class TestVocabCardBlock:
    def test_full(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "vocab_card",
                        "french": "marché",
                        "english": "market",
                        "pos": "n.m.",
                        "example_fr": "Je vais au marché.",
                    }
                ]
            )
        )
        assert blocks[0]["pos"] == "n.m."
        assert blocks[0]["example_fr"] == "Je vais au marché."

    def test_minimal(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "vocab_card",
                        "french": "marché",
                        "english": "market",
                    }
                ]
            )
        )
        assert blocks == [{"type": "vocab_card", "french": "marché", "english": "market"}]

    def test_drops_when_required_missing(self):
        _, blocks = extract_blocks(_wrap([{"type": "vocab_card", "french": "x"}]))
        assert blocks == []


class TestExpressionBlock:
    def test_with_note(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "expression",
                        "fr": "avoir le cafard",
                        "en": "to feel down",
                        "note": "lit. 'to have the cockroach'",
                    }
                ]
            )
        )
        assert blocks[0]["note"] == "lit. 'to have the cockroach'"

    def test_drops_without_translation(self):
        _, blocks = extract_blocks(_wrap([{"type": "expression", "fr": "x"}]))
        assert blocks == []


class TestConjugationTable:
    def test_valid(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "conjugation_table",
                        "verb": "aller",
                        "tense": "présent",
                        "rows": [
                            {"pronoun": "je", "form": "vais"},
                            {"pronoun": "tu", "form": "vas"},
                        ],
                    }
                ]
            )
        )
        assert blocks[0]["verb"] == "aller"
        assert len(blocks[0]["rows"]) == 2

    def test_drops_with_no_valid_rows(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "conjugation_table",
                        "verb": "aller",
                        "tense": "présent",
                        "rows": [{"pronoun": "je"}, {"form": "vas"}],
                    }
                ]
            )
        )
        assert blocks == []


class TestQuizMcq:
    def test_valid(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "quiz",
                        "questions": [
                            {
                                "kind": "mcq",
                                "prompt": "What does 'bonjour' mean?",
                                "options": ["hello", "goodbye", "thanks", "please"],
                                "correct": 0,
                                "explanation": "It's a greeting.",
                            }
                        ],
                    }
                ]
            )
        )
        q = blocks[0]["questions"][0]
        assert q["kind"] == "mcq"
        assert q["correct"] == 0
        assert len(q["options"]) == 4

    def test_drops_when_correct_out_of_range(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "quiz",
                        "questions": [
                            {
                                "kind": "mcq",
                                "prompt": "?",
                                "options": ["a", "b"],
                                "correct": 9,
                            }
                        ],
                    }
                ]
            )
        )
        assert blocks == []


class TestQuizMulti:
    def test_valid(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "quiz",
                        "questions": [
                            {
                                "kind": "multi",
                                "prompt": "Which are masculine?",
                                "options": ["le chat", "la table", "le chien", "la voiture"],
                                "correct": [0, 2],
                            }
                        ],
                    }
                ]
            )
        )
        assert blocks[0]["questions"][0]["correct"] == [0, 2]

    def test_drops_with_empty_correct(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "quiz",
                        "questions": [
                            {
                                "kind": "multi",
                                "prompt": "?",
                                "options": ["a", "b"],
                                "correct": [],
                            }
                        ],
                    }
                ]
            )
        )
        assert blocks == []


class TestQuizTrueFalse:
    def test_valid(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "quiz",
                        "questions": [
                            {
                                "kind": "true_false",
                                "prompt": "Paris is the capital of France.",
                                "correct": True,
                            }
                        ],
                    }
                ]
            )
        )
        assert blocks[0]["questions"][0]["correct"] is True

    def test_drops_when_not_bool(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "quiz",
                        "questions": [{"kind": "true_false", "prompt": "?", "correct": "yes"}],
                    }
                ]
            )
        )
        assert blocks == []


class TestQuizMatching:
    def test_valid(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "quiz",
                        "questions": [
                            {
                                "kind": "matching",
                                "prompt": "Match French to English.",
                                "pairs": [
                                    {"left": "le chat", "right": "the cat"},
                                    {"left": "le chien", "right": "the dog"},
                                ],
                            }
                        ],
                    }
                ]
            )
        )
        assert len(blocks[0]["questions"][0]["pairs"]) == 2

    def test_drops_with_one_pair(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "quiz",
                        "questions": [
                            {
                                "kind": "matching",
                                "prompt": "?",
                                "pairs": [{"left": "x", "right": "y"}],
                            }
                        ],
                    }
                ]
            )
        )
        assert blocks == []


class TestQuizShort:
    def test_valid(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "quiz",
                        "questions": [
                            {
                                "kind": "short",
                                "prompt": "How do you say 'hello'?",
                                "accept": ["bonjour", "Bonjour", "salut"],
                            }
                        ],
                    }
                ]
            )
        )
        assert blocks[0]["questions"][0]["accept"] == ["bonjour", "Bonjour", "salut"]

    def test_drops_with_empty_accept(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "quiz",
                        "questions": [{"kind": "short", "prompt": "?", "accept": []}],
                    }
                ]
            )
        )
        assert blocks == []


class TestActionBlock:
    def test_minimal(self):
        _, blocks = extract_blocks(
            _wrap([{"type": "action", "route": "/news", "label": "Ouvrir les news"}])
        )
        assert blocks == [{"type": "action", "route": "/news", "label": "Ouvrir les news"}]

    def test_with_emoji(self):
        _, blocks = extract_blocks(
            _wrap(
                [{"type": "action", "route": "/dictionary", "label": "Dictionnaire", "emoji": "📖"}]
            )
        )
        assert blocks[0]["emoji"] == "📖"

    def test_rejects_external_url(self):
        # External routes can't be smuggled in, internal only.
        _, blocks = extract_blocks(
            _wrap([{"type": "action", "route": "https://example.com", "label": "Hack"}])
        )
        assert blocks == []

    def test_rejects_relative_path(self):
        _, blocks = extract_blocks(_wrap([{"type": "action", "route": "news", "label": "x"}]))
        assert blocks == []

    def test_rejects_unknown_route(self):
        # Model loves to translate route names, "/grammaire" instead of
        # "/grammar". Validator must reject so we don't 404 the user.
        _, blocks = extract_blocks(_wrap([{"type": "action", "route": "/grammaire", "label": "x"}]))
        assert blocks == []

    def test_drops_when_label_missing(self):
        _, blocks = extract_blocks(_wrap([{"type": "action", "route": "/news"}]))
        assert blocks == []


class TestBareTrailingArrayFallback:
    """Some models skip the fence entirely and just put a JSON array at
    the very end of the prose. We salvage these, but only if they
    validate as our schema, and only when they're at end-of-string."""

    def test_bare_action_array_at_end(self):
        # Reproduces the gemini reply we saw in the wild.
        raw = (
            "C'est une excellente idée pour progresser. Voici le lien :\n"
            '[{"type": "action", "route": "/grammar", "label": "Ouvrir la grammaire", "emoji": "📖"}]'
        )
        prose, blocks = extract_blocks(raw)
        assert len(blocks) == 1
        assert blocks[0]["type"] == "action"
        assert blocks[0]["route"] == "/grammar"
        assert "type" not in prose
        assert "Voici le lien" in prose

    def test_bare_feature_widget_array_at_end(self):
        raw = (
            "On va s'amuser !\n"
            '[{"type": "feature_widget", "widget": "minigame", "title": "Jeu amusant"}]'
        )
        prose, blocks = extract_blocks(raw)
        assert len(blocks) == 1
        assert blocks[0]["widget"] == "minigame"
        assert prose == "On va s'amuser !"


class TestFeatureWidgetBlock:
    def test_minimal(self):
        _, blocks = extract_blocks(_wrap([{"type": "feature_widget", "widget": "news"}]))
        assert blocks == [{"type": "feature_widget", "widget": "news", "config": {}}]

    def test_with_config_and_title(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {
                        "type": "feature_widget",
                        "widget": "dictation",
                        "config": {"length": "short"},
                        "title": "Mini dictée",
                    }
                ]
            )
        )
        assert blocks[0]["widget"] == "dictation"
        assert blocks[0]["config"] == {"length": "short"}
        assert blocks[0]["title"] == "Mini dictée"

    def test_rejects_unknown_widget(self):
        _, blocks = extract_blocks(_wrap([{"type": "feature_widget", "widget": "rocketship"}]))
        assert blocks == []


class TestUnknownTypeIsForwardCompat:
    def test_unknown_dropped_others_kept(self):
        _, blocks = extract_blocks(
            _wrap(
                [
                    {"type": "future_thing", "data": "?"},
                    {"type": "audio", "text": "salut"},
                ]
            )
        )
        assert blocks == [{"type": "audio", "text": "salut", "lang": "fr"}]


class TestSalvageMalformedArray:
    """When the LLM emits one bad object inside an otherwise-fine array,
    the strict json.loads fails and we'd render nothing. The salvage
    walker recovers the surviving objects so the user still sees
    something useful."""

    def test_skips_one_bad_object_keeps_rest(self):
        # Middle entry is missing the "pronoun": key, JSON parse will
        # blow up. The two valid entries should still render.
        raw = (
            "Voici les conjugaisons.\n"
            "```blocks\n"
            "[\n"
            '  {"type":"conjugation_table","verb":"aller","tense":"présent",'
            '"rows":[{"pronoun":"je","form":"vais"}]},\n'
            '  {"type":"conjugation_table","verb":"aller","tense":"subjonctif",'
            '"rows":[{"que vous","form":"alliez"}]},\n'
            '  {"type":"conjugation_table","verb":"aller","tense":"imparfait",'
            '"rows":[{"pronoun":"je","form":"allais"}]}\n'
            "]\n"
            "```"
        )
        prose, blocks = extract_blocks(raw)
        assert len(blocks) == 2
        tenses = [b["tense"] for b in blocks]
        assert "présent" in tenses
        assert "imparfait" in tenses
        assert "subjonctif" not in tenses
        assert prose == "Voici les conjugaisons."

    def test_all_objects_bad_returns_empty(self):
        raw = '```blocks\n[\n  {"type":"conjugation_table","verb":"aller","rows":[{"x"}]}\n]\n```'
        _, blocks = extract_blocks(raw)
        assert blocks == []


class TestJsonFenceFallback:
    """Models often default to ```json, accept it if the payload validates."""

    def test_json_fence_with_valid_blocks_array(self):
        raw = (
            "Voici la conjugaison.\n"
            "```json\n"
            '[{"type":"audio","text":"je vais"},'
            ' {"type":"vocab_card","french":"aller","english":"to go"}]\n'
            "```"
        )
        prose, blocks = extract_blocks(raw)
        assert prose == "Voici la conjugaison."
        assert len(blocks) == 2
        assert blocks[0]["type"] == "audio"
        assert blocks[1]["type"] == "vocab_card"

    def test_json_fence_with_unrelated_payload_kept_in_prose(self):
        # A conversational reply that contains a JSON code sample which is
        # NOT our schema must stay rendered as a code fence.
        raw = (
            "Here's an example response shape:\n"
            "```json\n"
            '{"http_status": 200, "data": [1,2,3]}\n'
            "```"
        )
        prose, blocks = extract_blocks(raw)
        assert blocks == []
        assert "http_status" in prose

    def test_explicit_blocks_fence_still_wins(self):
        # A reply that has BOTH a generic json fence and an explicit blocks
        # fence: the explicit one is preferred.
        raw = (
            '```json\n[{"type":"audio","text":"a"}]\n```\n'
            '```blocks\n[{"type":"vocab_card","french":"x","english":"y"}]\n```'
        )
        prose, blocks = extract_blocks(raw)
        assert len(blocks) == 1
        assert blocks[0]["type"] == "vocab_card"
        # The unused json fence stays in the prose so the reader sees what
        # the model also produced.
        assert "```json" in prose


class TestBlocksWrapperKey:
    def test_accepts_dict_with_blocks_key(self):
        raw = (
            "Hi.\n```blocks\n" + json.dumps({"blocks": [{"type": "audio", "text": "x"}]}) + "\n```"
        )
        prose, blocks = extract_blocks(raw)
        assert prose == "Hi."
        assert len(blocks) == 1


class TestSingleBlockObject:
    """LLMs (notably gemini-flash on @-mention agents) sometimes emit a
    SINGLE block as a bare object inside the fence instead of wrapping it
    in a list. Regression coverage for the @grammar imparfait quiz bug
    where this caused the JSON to render as a code block in the UI."""

    def test_single_block_object_treated_as_one_element_list(self):
        raw = (
            "Here's a quiz.\n```blocks\n"
            + json.dumps(
                {
                    "type": "quiz",
                    "questions": [
                        {
                            "kind": "mcq",
                            "prompt": "Choisis la bonne forme.",
                            "options": ["a", "b", "c"],
                            "correct": 1,
                        }
                    ],
                }
            )
            + "\n```"
        )
        prose, blocks = extract_blocks(raw)
        assert prose == "Here's a quiz."
        assert len(blocks) == 1
        assert blocks[0]["type"] == "quiz"

    def test_single_block_object_via_fallback_json_fence(self):
        # Same shape but the model used ```json instead of ```blocks.
        raw = (
            "Here's a vocab card.\n```json\n"
            + json.dumps({"type": "vocab_card", "french": "chat", "english": "cat"})
            + "\n```"
        )
        prose, blocks = extract_blocks(raw)
        assert prose == "Here's a vocab card."
        assert len(blocks) == 1
        assert blocks[0]["type"] == "vocab_card"


class TestQuizAnswerCorrectAlias:
    """Loosen quiz validation: when the LLM writes `answer` instead of
    `correct`, accept it. For MCQ, allow `answer` to be either the index
    (int) or the option string (we resolve it to the index). For
    true_false, allow `answer` as a bool."""

    def test_mcq_with_answer_as_string_option(self):
        raw = _wrap(
            [
                {
                    "type": "quiz",
                    "questions": [
                        {
                            "kind": "mcq",
                            "prompt": "Forme pour 'Nous' de 'Manger' à l'imparfait.",
                            "options": ["Mangions", "Mangaisons", "Mangeons"],
                            "answer": "Mangions",
                        }
                    ],
                }
            ]
        )
        _, blocks = extract_blocks(raw)
        assert len(blocks) == 1
        assert blocks[0]["questions"][0]["correct"] == 0

    def test_mcq_with_answer_as_int_index(self):
        raw = _wrap(
            [
                {
                    "type": "quiz",
                    "questions": [
                        {
                            "kind": "mcq",
                            "prompt": "p",
                            "options": ["a", "b", "c"],
                            "answer": 2,
                        }
                    ],
                }
            ]
        )
        _, blocks = extract_blocks(raw)
        assert len(blocks) == 1
        assert blocks[0]["questions"][0]["correct"] == 2

    def test_mcq_answer_string_not_in_options_rejected(self):
        # If the model emits a string that isn't one of the options,
        # we cannot recover an index; drop the question.
        raw = _wrap(
            [
                {
                    "type": "quiz",
                    "questions": [
                        {
                            "kind": "mcq",
                            "prompt": "p",
                            "options": ["a", "b"],
                            "answer": "z",
                        }
                    ],
                }
            ]
        )
        _, blocks = extract_blocks(raw)
        assert blocks == []

    def test_true_false_with_answer_alias(self):
        raw = _wrap(
            [
                {
                    "type": "quiz",
                    "questions": [
                        {
                            "kind": "true_false",
                            "prompt": "L'imparfait sert aux actions précises.",
                            "answer": False,
                        }
                    ],
                }
            ]
        )
        _, blocks = extract_blocks(raw)
        assert len(blocks) == 1
        assert blocks[0]["questions"][0]["correct"] is False

    def test_correct_field_still_wins_when_both_present(self):
        # If a future LLM emits BOTH `correct` and `answer`, the explicit
        # `correct` should take precedence.
        raw = _wrap(
            [
                {
                    "type": "quiz",
                    "questions": [
                        {
                            "kind": "mcq",
                            "prompt": "p",
                            "options": ["a", "b", "c"],
                            "correct": 0,
                            "answer": "c",
                        }
                    ],
                }
            ]
        )
        _, blocks = extract_blocks(raw)
        assert blocks[0]["questions"][0]["correct"] == 0


class TestMultipleFences:
    """Compound replies sometimes contain multiple separate ```blocks
    fences -- "here's news" + news widget, then "and play this" +
    word_scramble widget. The parser must aggregate them all, not just
    the first one (which left the second fence in the prose as an ugly
    code block in production -- see message #86 in the dev DB)."""

    def test_two_blocks_fences_both_extracted(self):
        raw = (
            "Voici les actualités du jour :\n"
            '```blocks\n[{"type": "feature_widget", "widget": "news"}]\n```\n\n'
            "Et voici ton exercice de mots mélangés :\n"
            '```blocks\n[{"type": "feature_widget", "widget": "word_scramble"}]\n```'
        )
        prose, blocks = extract_blocks(raw)
        assert "```" not in prose
        assert len(blocks) == 2
        widgets = sorted(b["widget"] for b in blocks)
        assert widgets == ["news", "word_scramble"]

    def test_three_fences_with_mixed_types(self):
        raw = (
            "Salut !\n"
            '```blocks\n[{"type":"audio","text":"Bonjour"}]\n```\n'
            "Voici un mot :\n"
            '```blocks\n[{"type":"vocab_card","french":"chat","english":"cat"}]\n```\n'
            "Et un widget :\n"
            '```blocks\n[{"type":"feature_widget","widget":"news"}]\n```'
        )
        prose, blocks = extract_blocks(raw)
        assert "```" not in prose
        assert len(blocks) == 3
        types = sorted(b["type"] for b in blocks)
        assert types == ["audio", "feature_widget", "vocab_card"]

    def test_two_fences_one_invalid_other_still_extracts(self):
        # First fence has unknown type (dropped); second fence is valid.
        raw = (
            "First:\n"
            '```blocks\n[{"type":"unknown_type","foo":"bar"}]\n```\n'
            "Second:\n"
            '```blocks\n[{"type":"vocab_card","french":"chat","english":"cat"}]\n```'
        )
        prose, blocks = extract_blocks(raw)
        # Both fences stripped (we found valid JSON in both, even if one
        # had no valid blocks after validation).
        assert "```" not in prose
        assert len(blocks) == 1
        assert blocks[0]["type"] == "vocab_card"

    def test_two_fences_one_malformed_json_other_works(self):
        raw = (
            "First:\n"
            "```blocks\n{not valid json at all\n```\n"
            "Second:\n"
            '```blocks\n[{"type":"vocab_card","french":"chat","english":"cat"}]\n```'
        )
        prose, blocks = extract_blocks(raw)
        # The valid second fence still gets extracted.
        assert len(blocks) == 1
        assert blocks[0]["type"] == "vocab_card"

    def test_news_then_word_scramble_from_message_86(self):
        """Verbatim payload from dev DB message #86 -- the bug screenshot:
        'show me some news' triggered news + word_scramble in two fences,
        but only news got extracted and word_scramble rendered as a code
        block in the chat bubble."""
        raw = (
            "Voici les actualités du jour :\n"
            "\n"
            '```blocks\n[{"type": "feature_widget", "widget": "news"}]\n```\n'
            "\n"
            "Et voici ton exercice de mots mélangés :\n"
            "\n"
            '```blocks\n[{"type": "feature_widget", "widget": "word_scramble"}]\n```'
        )
        prose, blocks = extract_blocks(raw)
        assert "```" not in prose
        assert "Voici les actualités du jour" in prose
        assert "Et voici ton exercice" in prose
        assert len(blocks) == 2
        widgets = sorted(b["widget"] for b in blocks)
        assert widgets == ["news", "word_scramble"]


class TestSingleQuizFromImparfaitBug:
    """End-to-end regression for the exact LLM output from production:
    a single quiz block (not wrapped in a list) with `answer` (not
    `correct`) on questions. Both fixes have to compose."""

    def test_imparfait_quiz_payload_extracts_cleanly(self):
        # Verbatim shape from Message #78 in the dev database.
        raw = (
            "L'imparfait est le temps du récit.\n"
            "```blocks\n"
            + json.dumps(
                {
                    "type": "quiz",
                    "questions": [
                        {
                            "kind": "mcq",
                            "prompt": "Choisis la bonne forme pour 'Nous' au verbe 'Manger' à l'imparfait.",
                            "options": ["Mangions", "Mangaisons", "Mangeons"],
                            "answer": "Mangions",
                        },
                        {
                            "kind": "true_false",
                            "prompt": "L'imparfait est utilisé pour décrire des actions précises et terminées.",
                            "answer": False,
                        },
                    ],
                }
            )
            + "\n```"
        )
        prose, blocks = extract_blocks(raw)
        assert "L'imparfait" in prose
        assert "```" not in prose  # fence stripped
        assert len(blocks) == 1
        quiz = blocks[0]
        assert quiz["type"] == "quiz"
        assert len(quiz["questions"]) == 2
        mcq, tf = quiz["questions"]
        assert mcq["correct"] == 0
        assert tf["correct"] is False
