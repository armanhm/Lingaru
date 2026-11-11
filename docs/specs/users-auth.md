# Spec: Users and Auth

Status: Current-state (reverse-engineered from code, 2026-11-11) · Owner: @armanhm · Wiki: [Users and Auth](../wiki/Users-and-Auth.md)

## 1. Purpose & scope

**In scope:** the custom `User` model and learner profile fields, sign-up with admin approval, JWT login and refresh, profile read/update, password change, the admin approval actions, and the shared `LANGUAGE_CHOICES` constant.

**Out of scope:** Telegram bot account creation and linking flow (`apps/bot`), per-feature progress data (other apps), frontend auth handling.

## 2. Requirements

| ID | Requirement |
|----|-------------|
| FR-1 | Anyone can register with `username`, `email`, `password`, `password_confirm`. `email` and `username` are unique. `password` has at least 8 characters and must equal `password_confirm`. |
| FR-2 | A newly registered account is inactive (`is_active=False`). Registration returns `202` with `status: "pending_approval"` and no tokens. |
| FR-3 | An inactive account cannot obtain tokens. If its password is correct, login returns `401` with an "awaiting admin approval" `detail` message (DRF error code `pending_approval`). |
| FR-4 | An active account obtains an access/refresh JWT pair by posting `username` and `password` to the login endpoint. |
| FR-5 | A refresh token can be exchanged for a new access token and a new refresh token (rotation). |
| FR-6 | An authenticated user can read their profile and update their profile fields. `id`, `date_joined` and `is_staff` are read-only. |
| FR-7 | An authenticated user can change their password by supplying the correct current password and a new password of at least 8 characters. |
| FR-8 | Staff can approve (activate) or suspend (deactivate) accounts in bulk from Django admin. Suspension never applies to the acting admin. Pending accounts are listed first. |
| FR-9 | `target_language` defaults to `fr` and is one of `LANGUAGE_CHOICES`. All content APIs scope their results by it (see [content spec](content.md)). |
| FR-10 | `mode = null` means the user has not been onboarded; the frontend shows a mode picker. |

## 3. Data model

### `User` (table `users`, extends `django.contrib.auth.models.AbstractUser`)

Inherited fields (`username`, `password`, `first_name`, `last_name`, `is_staff`, `is_active`, `is_superuser`, `last_login`, `date_joined`) plus:

| Field | Type | Constraints / default | Notes |
|-------|------|-----------------------|-------|
| `email` | `EmailField` | unique | Overrides the non-unique base field. |
| `telegram_id` | `BigIntegerField` | unique, nullable | Telegram user id used by the bot. |
| `native_language` | `CharField(10)` | default `"en"` | Free text code. |
| `target_level` | `CharField(2)` | choices A1, A2, B1, B2, C1, C2; default `B2` | Goal level. |
| `daily_goal_minutes` | `PositiveIntegerField` | default 15 | |
| `target_language` | `CharField(8)` | choices `LANGUAGE_CHOICES`; default `fr` | Learned language; content discriminator. |
| `preferences` | `JSONField` | default `{}` | Frontend-owned settings blob. |
| `mode` | `CharField(12)` | choices `general`, `exam`, `agentic`; nullable | Null = not onboarded. |
| `proficiency_level` | `CharField(8)` | choices A1-C2, `unsure`; nullable | Self-reported current level. |
| `ui_language` | `CharField(4)` | choices `en`, `fr`; nullable | Null = detect from browser. |

No custom indexes beyond the unique constraints.

### `LANGUAGE_CHOICES` (`apps/users/constants.py`)

`[("fr", "French"), ("en", "English")]` and `LANGUAGE_CODES = {"fr", "en"}`. Imported by every model with a `language` field. Kept outside `models.py` to avoid migration import cycles.

### Migrations of note

`0005_user_target_language` adds `target_language` and backfills existing rows to `fr`.

## 4. API contract

Base path `/api/users/`. Default auth is JWT Bearer (`Authorization: Bearer <access>`).

### POST `/api/users/register/`

| | |
|---|---|
| Auth | None |
| Request | `{username, email, password, password_confirm}` |
| 202 | `{status: "pending_approval", detail: str, username, email}` |
| 400 | DRF field errors, e.g. `{"password_confirm": ["Passwords do not match."]}`, `{"email": ["user with this email already exists."]}` |

### POST `/api/users/login/`

| | |
|---|---|
| Auth | None |
| Request | `{username, password}` |
| 200 | `{access: str, refresh: str}` |
| 401 | `{detail: "Your account is awaiting admin approval. ..."}` for an inactive account with the right password (the DRF error code is `pending_approval`; the body carries only `detail`); otherwise SimpleJWT's standard `no_active_account` error |

### POST `/api/users/token/refresh/`

| | |
|---|---|
| Auth | None |
| Request | `{refresh}` |
| 200 | `{access, refresh}` (refresh is rotated) |
| 401 | Invalid or expired token |

### GET / PUT / PATCH `/api/users/me/`

| | |
|---|---|
| Auth | Authenticated |
| Response 200 | `{id, username, email, telegram_id, native_language, target_language, target_level, daily_goal_minutes, preferences, mode, proficiency_level, ui_language, date_joined, is_staff}` |
| PATCH body | Any subset of the learner profile fields: `username`, `email`, `native_language`, `target_language`, `target_level`, `daily_goal_minutes`, `preferences`, `mode`, `proficiency_level`, `ui_language`. Choice fields reject unknown values with `400`. |
| 401 | Missing/invalid token |

### PUT / PATCH `/api/users/change-password/`

| | |
|---|---|
| Auth | Authenticated |
| Request | `{old_password, new_password}` |
| 200 | `{detail: "Password updated successfully."}` |
| 400 | `{old_password: "Wrong password."}` or `{new_password: "Password must be at least 8 characters."}` |
| 405 | `POST` is not accepted |

### Language scoping

These endpoints are not language-scoped. Changing `target_language` via `PATCH me/` changes the scope of all content endpoints on the next request.

## 5. Business rules & invariants

| Rule | Detail |
|------|--------|
| Approval gate | Accounts created through the API start inactive. Accounts created with `createsuperuser` or in admin are not affected. |
| Token lifetimes | Access 60 min, refresh 7 days, rotation on (`config.settings.local`: 7 d / 30 d). |
| Password length | Minimum 8 characters on register and change. |
| Mode semantics | `general`, `exam`, `agentic` select dashboard and nav in the frontend (`frontend/src/lib/modeConfig.js`). |
| Progress across languages | Switching `target_language` does not delete per-user progress; views filter it instead. |

## 6. Background jobs

None. No Celery tasks or management commands in this app.

## 7. Dependencies

| Dependency | Use |
|------------|-----|
| `djangorestframework-simplejwt` | Token obtain/refresh views and JWT authentication. |
| Django auth | `AbstractUser`, password hashing, admin `UserAdmin`. |
| `apps/bot` | Reads `User.telegram_id` and creates `tg_<id>` users on `/start`. |
| All content apps | Read `request.user.target_language`. |

## 8. Deviations / open questions

| # | Item |
|---|------|
| D-1 | README documents `POST /api/users/change-password/`; the view only accepts `PUT`/`PATCH` (the frontend uses `PUT`). |
| D-2 | README does not mention that `me/` supports `PUT`/`PATCH`. |
| D-3 | `ChangePasswordView` error bodies are bare strings, not DRF's list form used by the register endpoint. |
| D-4 | `UserAdmin` fieldsets omit `target_language`, `mode`, `proficiency_level`, `ui_language`, `preferences`, so staff cannot edit them in the change form. |
| D-6 | The `ui_language` help text says the learned language is "always French"; stale since `target_language` was added. |
| D-7 | `LEVEL_CHOICES` and `PROFICIENCY_CHOICES` duplicate the A1-C2 list. |
| D-8 | `preferences` has no schema; its shape is defined only by the frontend. |
