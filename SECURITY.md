# Security Policy

Lingaru is an actively developed personal-scale project. We take security seriously and welcome responsible disclosure.

## Supported Versions

Only the `main` branch receives security fixes. There are no LTS branches.

| Branch | Supported |
|--------|-----------|
| `main` | Yes       |
| any other branch | No |

If you are running a deployment older than 30 days, the first remediation step is to pull `main` and redeploy.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security reports.**

Instead, email **arman@nurau.com** with:

- A description of the issue and the impact you believe it has.
- The steps required to reproduce it (proof-of-concept code, requests, or screenshots are very welcome).
- The commit SHA or deployment URL where you observed the issue.
- Whether you would like to be credited publicly once the issue is fixed.

You can expect:

- **Acknowledgement** within 72 hours.
- **Initial assessment** within 7 days (severity, whether we accept the report).
- **Fix or mitigation** for confirmed high-severity issues within 30 days.
- **Public disclosure** coordinated with you after a fix has shipped.

If the report is declined, we will explain why (e.g. expected behavior, out of scope, low impact).

## Scope

In scope:

- The Django backend (`backend/`) and its REST API.
- The React frontend (`frontend/`).
- The Telegram bot (`backend/apps/bot/`).
- The deployment configuration (`docker-compose*.yml`, `nginx/`, GitHub Actions workflows).

Out of scope:

- Third-party services we integrate with (Google Gemini, Groq, Sentry, Telegram). Report those directly to the provider.
- Denial-of-service via brute-force or volumetric attacks (we expect Nginx / hosting-level rate limits to absorb these — but if you find a logic bug that lets a single request exhaust resources, that *is* in scope).
- Social-engineering attacks against the maintainer or users.
- Issues that require physical access to a user's already-unlocked device.

## Hardening Notes for Self-Hosters

If you fork or self-host Lingaru, please do the following before exposing it to the internet:

- Set `DEBUG=False` and configure `ALLOWED_HOSTS` to your exact domain(s).
- Generate a strong `DJANGO_SECRET_KEY` (e.g. `python -c "import secrets; print(secrets.token_urlsafe(64))"`) and keep it out of source control.
- Front Nginx with HTTPS (Let's Encrypt via Certbot is the documented path).
- Rotate API keys (`GEMINI_API_KEY`, `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`) if they have ever been committed or pasted into a chat.
- Keep the Docker images current — Dependabot opens weekly PRs against the base images and Python/Node dependencies; merge them.
- Restrict Django admin (`/admin/`) by IP at the Nginx level, or behind a VPN, if you can.

Thank you for helping keep Lingaru and its users safe.
