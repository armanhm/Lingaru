import os

from .base import *  # noqa: F401, F403

DEBUG = True

# Postgres only when DB_HOST is a real environment variable (CI service
# container, docker compose). Read os.environ, not decouple: the repo-root
# .env sets DB_HOST for docker compose and must not drag a bare `pytest`
# run onto a database that is not there.
if not os.environ.get("DB_HOST"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }

# Faster password hashing for tests
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# No caching in tests
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# decouple falls back to the repo-root .env, which holds real secrets.
# Hard-override everything that could reach a paid or external service so
# a bare `pytest` stays offline no matter what the developer's .env says.
GEMINI_API_KEY = ""
GROQ_API_KEY = ""
TELEGRAM_BOT_TOKEN = ""
LINGARU_MEMORY_ENABLED = False

CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
