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
        # External routes can't be smuggled in — internal only.
        _, blocks = extract_blocks(
            _wrap([{"type": "action", "route": "https://example.com", "label": "Hack"}])
        )
        assert blocks == []

    def test_rejects_relative_path(self):
        _, blocks = extract_blocks(_wrap([{"type": "action", "route": "news", "label": "x"}]))
        assert blocks == []

    def test_drops_when_label_missing(self):
        _, blocks = extract_blocks(_wrap([{"type": "action", "route": "/news"}]))
        assert blocks == []


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
        # Middle entry is missing the "pronoun": key — JSON parse will
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
    """Models often default to ```json — accept it if the payload validates."""

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
