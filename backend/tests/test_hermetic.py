"""The suite must never reach a real LLM/TTS/STT provider or the network.

These tests pin the guards in config/settings/test.py and conftest.py, and
are meant to hold even when the developer's repo-root .env holds real keys.
"""

import socket

import pytest
from django.conf import settings


def test_llm_and_bot_keys_are_blank():
    # Compare booleans only so a failure never prints a real key.
    keys = ["GEMINI_API_KEY", "GROQ_API_KEY", "TELEGRAM_BOT_TOKEN"]
    blank = {key: getattr(settings, key) == "" for key in keys}
    assert blank == dict.fromkeys(keys, True)


def test_chat_memory_wiring_is_off():
    assert settings.LINGARU_MEMORY_ENABLED is False


def test_celery_runs_eagerly_on_in_memory_transport():
    from config.celery import app

    assert app.conf.task_always_eager is True
    assert app.conf.task_eager_propagates is True
    assert app.conf.broker_url == "memory://"
    assert app.conf.result_backend == "cache+memory://"


def _gemini_llm():
    from services.llm.gemini import GeminiProvider

    GeminiProvider(api_key="fake", model="gemini-test")


def _groq_llm():
    from services.llm.groq_provider import GroqProvider

    GroqProvider(api_key="fake", model="llama-test")


def _gemini_embedder():
    from services.rag.embedder import GeminiEmbedder

    GeminiEmbedder(api_key="fake")


def _groq_whisper():
    from services.stt.groq_whisper import GroqWhisperProvider

    GroqWhisperProvider(api_key="fake")


def _gtts():
    from services.tts.gtts_provider import gTTS

    gTTS(text="bonjour", lang="fr")


@pytest.mark.parametrize(
    "build",
    [_gemini_llm, _groq_llm, _gemini_embedder, _groq_whisper, _gtts],
    ids=["gemini-llm", "groq-llm", "gemini-embedder", "groq-whisper", "gtts"],
)
def test_constructing_a_real_provider_client_fails_loudly(build, real_provider_guard):
    with pytest.raises(RuntimeError, match="real provider client"):
        build()
    assert real_provider_guard.hits, "the guard should record the attempt"
    # Clear so this deliberate hit does not fail the test at teardown.
    real_provider_guard.hits.clear()


def test_outbound_network_is_blocked():
    # 192.0.2.1 is TEST-NET-1 (RFC 5737): never routable, no DNS lookup.
    with pytest.raises(RuntimeError, match="socket"):
        socket.create_connection(("192.0.2.1", 443), timeout=1)
