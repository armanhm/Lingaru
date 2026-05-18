"""Tests for the language-aware prompt resolver."""

from services.llm.prompts import SYSTEM_PROMPTS, get_system_prompt


def test_two_level_dict_shape():
    """SYSTEM_PROMPTS is keyed by language first, then mode."""
    assert "fr" in SYSTEM_PROMPTS
    assert "en" in SYSTEM_PROMPTS
    assert "conversation" in SYSTEM_PROMPTS["fr"]
    assert "conversation" in SYSTEM_PROMPTS["en"]


def test_get_system_prompt_fr_conversation():
    prompt = get_system_prompt("fr", "conversation")
    assert isinstance(prompt, str)
    assert len(prompt) > 0


def test_get_system_prompt_en_conversation_is_different_from_fr():
    fr = get_system_prompt("fr", "conversation")
    en = get_system_prompt("en", "conversation")
    assert fr != en
    assert isinstance(en, str)
    assert len(en) > 0


def test_get_system_prompt_unknown_language_falls_back_to_fr():
    fallback = get_system_prompt("es", "conversation")
    fr = get_system_prompt("fr", "conversation")
    assert fallback == fr


def test_get_system_prompt_unknown_mode_falls_back_to_conversation():
    fallback = get_system_prompt("fr", "nonexistent_mode")
    base = get_system_prompt("fr", "conversation")
    assert fallback == base


def test_all_existing_modes_have_en_versions():
    """Every mode that exists for FR must also exist for EN."""
    fr_modes = set(SYSTEM_PROMPTS["fr"].keys())
    en_modes = set(SYSTEM_PROMPTS["en"].keys())
    assert fr_modes == en_modes
