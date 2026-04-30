"""Production settings.

These run inside Docker behind nginx (which terminates HTTP today and
HTTPS once you point a domain + Let's Encrypt at the box). Two things
that bite first-deploy:

  1. Cookie security flags must match the actual request scheme. If
     you're serving HTTP, `SESSION_COOKIE_SECURE=True` and
     `CSRF_COOKIE_SECURE=True` cause the cookie to be silently dropped
     and Django rejects the next POST with 403 CSRF. Both flags are
     therefore env-driven and default to False (HTTP-friendly). Flip
     them on once you're behind HTTPS.

  2. Django 4+ requires `CSRF_TRUSTED_ORIGINS` to include the public
     scheme://host[:port] the browser uses, otherwise admin login and
     any other POST form returns 403. Comma-separated list in env.
"""

import os

from .base import *  # noqa: F401, F403

DEBUG = False

# ── Origins that may submit forms / API POSTs to this server ─────
# Each entry MUST include the scheme. Examples:
#   CSRF_TRUSTED_ORIGINS=http://37.27.222.155:8080,https://lingaru.app
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",")
    if o.strip()
]

# ── Cookie security ──────────────────────────────────────────────
# Default False so HTTP works out-of-the-box; set =True in .env once
# you're behind HTTPS (Let's Encrypt, Cloudflare, or a tunnel).
SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "False").lower() in ("1", "true", "yes")
CSRF_COOKIE_SECURE    = os.environ.get("CSRF_COOKIE_SECURE",    "False").lower() in ("1", "true", "yes")

# ── Behind a reverse proxy ───────────────────────────────────────
# nginx forwards X-Forwarded-Proto so Django knows the original scheme.
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ── Other production hardening ───────────────────────────────────
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
