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


class TestBlocksWrapperKey:
    def test_accepts_dict_with_blocks_key(self):
        raw = (
            "Hi.\n```blocks\n" + json.dumps({"blocks": [{"type": "audio", "text": "x"}]}) + "\n```"
        )
        prose, blocks = extract_blocks(raw)
        assert prose == "Hi."
        assert len(blocks) == 1
