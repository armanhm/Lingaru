import os

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()

# SDK entry points that talk to a paid or external service. Patched per
# test with a raising stub; a test that needs one must mock it explicitly.
# Both the SDK attribute and every `from x import Y` binding are listed,
# because a from-import copies the reference at import time.
REAL_PROVIDER_CLIENTS = [
    "google.genai.Client",
    "groq.Groq",
    "services.llm.groq_provider.Groq",
    "services.stt.groq_whisper.Groq",
    "services.tts.gtts_provider.gTTS",
]


@pytest.hookimpl(tryfirst=True)
def pytest_configure(config):
    # pytest-socket: block every outbound connection except the test DB.
    # Runs before the plugin reads the option; an explicit --allow-hosts wins.
    if not config.option.allow_hosts:
        hosts = ["127.0.0.1", "::1", "localhost"]
        if os.environ.get("DB_HOST"):
            hosts.append(os.environ["DB_HOST"])
        config.option.allow_hosts = ",".join(hosts)


class RealProviderBlocked(RuntimeError):
    pass


class _RealProviderGuard:
    def __init__(self):
        self.hits = []

    def stub_for(self, target):
        def blocked(*args, **kwargs):
            self.hits.append(target)
            raise RealProviderBlocked(
                f"Test tried to construct a real provider client ({target}). Mock it instead."
            )

        return blocked


@pytest.fixture(autouse=True)
def real_provider_guard(monkeypatch):
    guard = _RealProviderGuard()
    for target in REAL_PROVIDER_CLIENTS:
        monkeypatch.setattr(target, guard.stub_for(target))
    yield guard
    # App code often swallows provider errors and degrades gracefully, so the
    # raise alone could pass silently. Fail the test at teardown regardless.
    if guard.hits:
        pytest.fail(
            "Real provider client(s) constructed during this test: " + ", ".join(guard.hits),
            pytrace=False,
        )


@pytest.fixture
def user_data():
    return {
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpass123!",
    }


@pytest.fixture
def create_user(db, user_data):
    user = User.objects.create_user(**user_data)
    return user


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, create_user):
    api_client.force_authenticate(user=create_user)
    return api_client
