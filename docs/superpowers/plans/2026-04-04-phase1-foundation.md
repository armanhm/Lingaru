# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Django + DRF backend with user auth (JWT), PostgreSQL, Docker Compose stack, and a basic React + Vite frontend shell with routing — producing a deployable skeleton that all future phases build on.

**Architecture:** Django monolith with DRF serving a REST API. React + Vite SPA as the frontend. PostgreSQL for persistence. Docker Compose orchestrates all services (nginx, django, postgres, redis). JWT authentication via `djangorestframework-simplejwt`.

**Tech Stack:** Python 3.12, Django 5.x, Django REST Framework, djangorestframework-simplejwt, PostgreSQL 16, Redis 7, Docker + Docker Compose, React 18, Vite 5, React Router 6, Axios, Tailwind CSS 3, Nginx

---

## File Structure

```
lingaru/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── .gitignore                          # (exists, update)
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── manage.py
│   ├── config/
│   │   ├── __init__.py
│   │   ├── asgi.py
│   │   ├── wsgi.py
│   │   ├── urls.py
│   │   ├── celery.py
│   │   └── settings/
│   │       ├── __init__.py
│   │       ├── base.py
│   │       ├── dev.py
│   │       └── prod.py
│   ├── apps/
│   │   ├── __init__.py
│   │   └── users/
│   │       ├── __init__.py
│   │       ├── models.py
│   │       ├── serializers.py
│   │       ├── views.py
│   │       ├── urls.py
│   │       ├── admin.py
│   │       └── tests/
│   │           ├── __init__.py
│   │           ├── test_models.py
│   │           ├── test_serializers.py
│   │           └── test_views.py
│   ├── conftest.py
│   └── pytest.ini
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── api/
│   │   │   └── client.js          # Axios instance with JWT interceptor
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx     # Auth state provider
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── NotFound.jsx
│   │   └── components/
│   │       ├── Layout.jsx          # App shell with nav
│   │       └── ProtectedRoute.jsx  # Auth guard
│   └── .env.example
│
└── nginx/
    ├── Dockerfile
    └── nginx.conf
```

---

### Task 1: Django Project Scaffold

**Files:**
- Create: `backend/manage.py`
- Create: `backend/config/__init__.py`
- Create: `backend/config/wsgi.py`
- Create: `backend/config/asgi.py`
- Create: `backend/config/urls.py`
- Create: `backend/config/settings/__init__.py`
- Create: `backend/config/settings/base.py`
- Create: `backend/config/settings/dev.py`
- Create: `backend/config/settings/prod.py`
- Create: `backend/requirements.txt`
- Create: `backend/apps/__init__.py`
- Create: `backend/pytest.ini`
- Create: `backend/conftest.py`
- Delete: `main.py` (PyCharm placeholder)

- [ ] **Step 1: Create requirements.txt**

```
# backend/requirements.txt
Django>=5.1,<5.2
djangorestframework>=3.15,<3.16
djangorestframework-simplejwt>=5.3,<5.4
django-cors-headers>=4.3,<4.4
psycopg2-binary>=2.9,<2.10
redis>=5.0,<5.1
celery>=5.4,<5.5
gunicorn>=22.0,<23.0
python-decouple>=3.8,<3.9
pytest>=8.0,<9.0
pytest-django>=4.8,<4.9
pytest-cov>=5.0,<6.0
factory-boy>=3.3,<3.4
```

- [ ] **Step 2: Create Django settings base**

```python
# backend/config/settings/base.py
import os
from pathlib import Path
from decouple import config, Csv
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config("DJANGO_SECRET_KEY", default="insecure-dev-key-change-in-production")

DEBUG = config("DEBUG", default=False, cast=bool)

ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "corsheaders",
    # Local apps
    "apps.users",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME", default="lingaru"),
        "USER": config("DB_USER", default="lingaru"),
        "PASSWORD": config("DB_PASSWORD", default="lingaru"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
    }
}

AUTH_USER_MODEL = "users.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# DRF
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# JWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

# CORS
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://localhost:3000",
    cast=Csv(),
)

# Redis
REDIS_URL = config("REDIS_URL", default="redis://localhost:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}

# Celery
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default=REDIS_URL)
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default=REDIS_URL)
```

- [ ] **Step 3: Create dev and prod settings**

```python
# backend/config/settings/dev.py
from .base import *  # noqa: F401, F403

DEBUG = True

# Allow all origins in development
CORS_ALLOW_ALL_ORIGINS = True
```

```python
# backend/config/settings/prod.py
from .base import *  # noqa: F401, F403

DEBUG = False

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = "DENY"
```

```python
# backend/config/settings/__init__.py
```

- [ ] **Step 4: Create config modules**

```python
# backend/config/__init__.py
```

```python
# backend/config/wsgi.py
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
application = get_wsgi_application()
```

```python
# backend/config/asgi.py
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
application = get_asgi_application()
```

```python
# backend/config/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", include("apps.users.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

```python
# backend/config/celery.py
import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("lingaru")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
```

- [ ] **Step 5: Create manage.py and pytest config**

```python
# backend/manage.py
#!/usr/bin/env python
import os
import sys

def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == "__main__":
    main()
```

```ini
# backend/pytest.ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings.dev
python_files = tests.py test_*.py *_tests.py
python_classes = Test*
python_functions = test_*
addopts = -v --tb=short
```

```python
# backend/conftest.py
import pytest
from django.contrib.auth import get_user_model

User = get_user_model()

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
```

```python
# backend/apps/__init__.py
```

- [ ] **Step 6: Create .env.example**

```env
# .env.example
DJANGO_SECRET_KEY=change-me-to-a-random-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=lingaru
DB_USER=lingaru
DB_PASSWORD=lingaru
DB_HOST=postgres
DB_PORT=5432

REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

TELEGRAM_BOT_TOKEN=
GEMINI_API_KEY=
GROQ_API_KEY=
```

- [ ] **Step 7: Delete placeholder main.py**

```bash
rm main.py
```

- [ ] **Step 8: Verify Django project loads**

```bash
cd backend && pip install -r requirements.txt && python manage.py check
```

Expected: `System check identified no issues.` (will warn about unapplied migrations — that's fine, no DB yet)

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: scaffold Django project with settings, DRF, JWT config"
```

---

### Task 2: Custom User Model

**Files:**
- Create: `backend/apps/users/__init__.py`
- Create: `backend/apps/users/models.py`
- Create: `backend/apps/users/admin.py`
- Create: `backend/apps/users/tests/__init__.py`
- Create: `backend/apps/users/tests/test_models.py`

- [ ] **Step 1: Write failing test for User model**

```python
# backend/apps/users/tests/__init__.py
```

```python
# backend/apps/users/tests/test_models.py
import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
class TestUserModel:
    def test_create_user(self):
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123!",
        )
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.check_password("testpass123!")
        assert user.is_active
        assert not user.is_staff

    def test_create_user_with_telegram_id(self):
        user = User.objects.create_user(
            username="telegramuser",
            email="tg@example.com",
            password="testpass123!",
            telegram_id=123456789,
        )
        assert user.telegram_id == 123456789

    def test_create_user_default_fields(self):
        user = User.objects.create_user(
            username="defaultuser",
            email="default@example.com",
            password="testpass123!",
        )
        assert user.telegram_id is None
        assert user.native_language == "en"
        assert user.target_level == "B2"
        assert user.daily_goal_minutes == 15

    def test_create_superuser(self):
        user = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="adminpass123!",
        )
        assert user.is_staff
        assert user.is_superuser

    def test_user_str(self):
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123!",
        )
        assert str(user) == "testuser"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest apps/users/tests/test_models.py -v
```

Expected: FAIL — User model not defined yet

- [ ] **Step 3: Write User model**

```python
# backend/apps/users/__init__.py
```

```python
# backend/apps/users/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    LEVEL_CHOICES = [
        ("A1", "A1 - Beginner"),
        ("A2", "A2 - Elementary"),
        ("B1", "B1 - Intermediate"),
        ("B2", "B2 - Upper Intermediate"),
        ("C1", "C1 - Advanced"),
        ("C2", "C2 - Proficiency"),
    ]

    email = models.EmailField(unique=True)
    telegram_id = models.BigIntegerField(unique=True, null=True, blank=True)
    native_language = models.CharField(max_length=10, default="en")
    target_level = models.CharField(max_length=2, choices=LEVEL_CHOICES, default="B2")
    daily_goal_minutes = models.PositiveIntegerField(default=15)

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.username
```

```python
# backend/apps/users/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "telegram_id", "target_level", "is_active")
    list_filter = ("target_level", "is_active", "is_staff")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Lingaru", {"fields": ("telegram_id", "native_language", "target_level", "daily_goal_minutes")}),
    )
```

- [ ] **Step 4: Create and run migrations**

```bash
cd backend && python manage.py makemigrations users && python manage.py migrate
```

Note: this runs against SQLite in dev by default since no Postgres is running. Tests use an in-memory DB.

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && python -m pytest apps/users/tests/test_models.py -v
```

Expected: all 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add custom User model with telegram_id, target_level, daily_goal"
```

---

### Task 3: User Auth Serializers

**Files:**
- Create: `backend/apps/users/serializers.py`
- Create: `backend/apps/users/tests/test_serializers.py`

- [ ] **Step 1: Write failing tests for serializers**

```python
# backend/apps/users/tests/test_serializers.py
import pytest
from django.contrib.auth import get_user_model
from apps.users.serializers import RegisterSerializer, UserSerializer

User = get_user_model()


@pytest.mark.django_db
class TestRegisterSerializer:
    def test_valid_registration(self):
        data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "strongpass123!",
            "password_confirm": "strongpass123!",
        }
        serializer = RegisterSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        user = serializer.save()
        assert user.username == "newuser"
        assert user.email == "new@example.com"
        assert user.check_password("strongpass123!")

    def test_password_mismatch(self):
        data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "strongpass123!",
            "password_confirm": "differentpass!",
        }
        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert "password_confirm" in serializer.errors

    def test_duplicate_email(self):
        User.objects.create_user(
            username="existing", email="taken@example.com", password="pass123!"
        )
        data = {
            "username": "newuser",
            "email": "taken@example.com",
            "password": "strongpass123!",
            "password_confirm": "strongpass123!",
        }
        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert "email" in serializer.errors


@pytest.mark.django_db
class TestUserSerializer:
    def test_serializes_user(self):
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="pass123!",
            telegram_id=123456,
            target_level="B1",
            daily_goal_minutes=30,
        )
        serializer = UserSerializer(user)
        data = serializer.data
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"
        assert data["telegram_id"] == 123456
        assert data["target_level"] == "B1"
        assert data["daily_goal_minutes"] == 30
        assert "password" not in data
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest apps/users/tests/test_serializers.py -v
```

Expected: FAIL — serializers not defined

- [ ] **Step 3: Write serializers**

```python
# backend/apps/users/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("username", "email", "password", "password_confirm")

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        user = User.objects.create_user(**validated_data)
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id", "username", "email", "telegram_id",
            "native_language", "target_level", "daily_goal_minutes",
            "date_joined",
        )
        read_only_fields = ("id", "date_joined")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest apps/users/tests/test_serializers.py -v
```

Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Register and User serializers with validation"
```

---

### Task 4: User Auth Views & URLs

**Files:**
- Create: `backend/apps/users/views.py`
- Create: `backend/apps/users/urls.py`
- Create: `backend/apps/users/tests/test_views.py`

- [ ] **Step 1: Write failing tests for auth endpoints**

```python
# backend/apps/users/tests/test_views.py
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def registered_user(db):
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123!",
    )


@pytest.mark.django_db
class TestRegisterView:
    def test_register_success(self, api_client):
        url = reverse("users:register")
        data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "strongpass123!",
            "password_confirm": "strongpass123!",
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == 201
        assert response.data["username"] == "newuser"
        assert response.data["email"] == "new@example.com"
        assert "password" not in response.data
        assert User.objects.filter(username="newuser").exists()

    def test_register_password_mismatch(self, api_client):
        url = reverse("users:register")
        data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "strongpass123!",
            "password_confirm": "wrongpass!",
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == 400


@pytest.mark.django_db
class TestLoginView:
    def test_login_success(self, api_client, registered_user):
        url = reverse("users:token_obtain")
        data = {"username": "testuser", "password": "testpass123!"}
        response = api_client.post(url, data, format="json")
        assert response.status_code == 200
        assert "access" in response.data
        assert "refresh" in response.data

    def test_login_wrong_password(self, api_client, registered_user):
        url = reverse("users:token_obtain")
        data = {"username": "testuser", "password": "wrongpass!"}
        response = api_client.post(url, data, format="json")
        assert response.status_code == 401


@pytest.mark.django_db
class TestMeView:
    def test_get_profile_authenticated(self, api_client, registered_user):
        api_client.force_authenticate(user=registered_user)
        url = reverse("users:me")
        response = api_client.get(url)
        assert response.status_code == 200
        assert response.data["username"] == "testuser"
        assert response.data["email"] == "test@example.com"

    def test_get_profile_unauthenticated(self, api_client):
        url = reverse("users:me")
        response = api_client.get(url)
        assert response.status_code == 401

    def test_update_profile(self, api_client, registered_user):
        api_client.force_authenticate(user=registered_user)
        url = reverse("users:me")
        response = api_client.patch(
            url, {"daily_goal_minutes": 30, "target_level": "B2"}, format="json"
        )
        assert response.status_code == 200
        assert response.data["daily_goal_minutes"] == 30
        assert response.data["target_level"] == "B2"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest apps/users/tests/test_views.py -v
```

Expected: FAIL — views and URLs not defined

- [ ] **Step 3: Write views**

```python
# backend/apps/users/views.py
from rest_framework import generics, permissions
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .serializers import RegisterSerializer, UserSerializer

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=201)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        return self.request.user
```

- [ ] **Step 4: Write URLs**

```python
# backend/apps/users/urls.py
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

app_name = "users"

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", TokenObtainPairView.as_view(), name="token_obtain"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", views.MeView.as_view(), name="me"),
]
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && python -m pytest apps/users/tests/test_views.py -v
```

Expected: all 6 tests PASS

- [ ] **Step 6: Run full test suite**

```bash
cd backend && python -m pytest -v
```

Expected: all 15 tests PASS (5 model + 4 serializer + 6 view)

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add auth endpoints — register, login (JWT), profile"
```

---

### Task 5: Docker Compose Stack

**Files:**
- Create: `backend/Dockerfile`
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml`
- Create: `nginx/nginx.conf`
- Create: `nginx/Dockerfile`

- [ ] **Step 1: Create backend Dockerfile**

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
```

- [ ] **Step 2: Create nginx config and Dockerfile**

```nginx
# nginx/nginx.conf
upstream django {
    server django:8000;
}

server {
    listen 80;
    server_name _;
    client_max_body_size 10M;

    # React frontend
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Django API
    location /api/ {
        proxy_pass http://django;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Django admin
    location /admin/ {
        proxy_pass http://django;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Django static files (admin CSS/JS)
    location /static/ {
        alias /app/staticfiles/;
    }

    # Media files
    location /media/ {
        alias /app/media/;
    }
}
```

```dockerfile
# nginx/Dockerfile
FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/
```

- [ ] **Step 3: Create docker-compose.yml (production)**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    env_file: .env
    environment:
      POSTGRES_DB: ${DB_NAME:-lingaru}
      POSTGRES_USER: ${DB_USER:-lingaru}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-lingaru}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-lingaru}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  django:
    build: ./backend
    env_file: .env
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.prod
    volumes:
      - static_files:/app/staticfiles
      - media_files:/app/media
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3"

  celery:
    build: ./backend
    env_file: .env
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.prod
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: celery -A config worker -l info

  celery-beat:
    build: ./backend
    env_file: .env
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.prod
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: celery -A config beat -l info

  nginx:
    build: ./nginx
    ports:
      - "80:80"
    volumes:
      - static_files:/app/staticfiles:ro
      - media_files:/app/media:ro
    depends_on:
      - django

volumes:
  postgres_data:
  redis_data:
  static_files:
  media_files:
```

- [ ] **Step 4: Create docker-compose.dev.yml (development override)**

```yaml
# docker-compose.dev.yml
services:
  postgres:
    ports:
      - "5432:5432"

  redis:
    ports:
      - "6379:6379"

  django:
    build: ./backend
    env_file: .env
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.dev
    volumes:
      - ./backend:/app
      - static_files:/app/staticfiles
      - media_files:/app/media
    ports:
      - "8000:8000"
    command: python manage.py runserver 0.0.0.0:8000
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  celery:
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.dev
    volumes:
      - ./backend:/app

  celery-beat:
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.dev
    volumes:
      - ./backend:/app

  nginx:
    ports:
      - "80:80"
```

- [ ] **Step 5: Verify Docker Compose config parses**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet
```

Expected: no errors (prints nothing on success)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add Docker Compose stack — django, postgres, redis, nginx, celery"
```

---

### Task 6: React + Vite Frontend Shell

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/index.css`
- Create: `frontend/.env.example`
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Initialize frontend with package.json**

```json
{
  "name": "lingaru-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.7.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create Vite and Tailwind config**

```javascript
// frontend/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

```javascript
// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
      },
    },
  },
  plugins: [],
};
```

```javascript
// frontend/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 3: Create index.html and entry point**

```html
<!-- frontend/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lingaru — Learn French</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

```jsx
// frontend/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

```css
/* frontend/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Create API client with JWT interceptor**

```javascript
// frontend/src/api/client.js
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");

      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/users/token/refresh/`, {
            refresh: refreshToken,
          });
          const { access } = response.data;
          localStorage.setItem("access_token", access);
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return client(originalRequest);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

export default client;
```

- [ ] **Step 5: Create Auth context**

```jsx
// frontend/src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import client from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      client
        .get("/users/me/")
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const response = await client.post("/users/login/", { username, password });
    localStorage.setItem("access_token", response.data.access);
    localStorage.setItem("refresh_token", response.data.refresh);
    const userResponse = await client.get("/users/me/");
    setUser(userResponse.data);
    return userResponse.data;
  };

  const register = async (username, email, password, passwordConfirm) => {
    await client.post("/users/register/", {
      username,
      email,
      password,
      password_confirm: passwordConfirm,
    });
    return login(username, password);
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

- [ ] **Step 6: Create pages and layout**

```jsx
// frontend/src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
```

```jsx
// frontend/src/components/Layout.jsx
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/" className="text-xl font-bold text-primary-600">
              Lingaru
            </Link>
            <div className="flex items-center gap-6">
              <Link to="/topics" className="text-gray-600 hover:text-primary-600">
                Topics
              </Link>
              <Link to="/discover" className="text-gray-600 hover:text-primary-600">
                Discover
              </Link>
              <Link to="/progress" className="text-gray-600 hover:text-primary-600">
                Progress
              </Link>
              {user && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{user.username}</span>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
```

```jsx
// frontend/src/pages/Dashboard.jsx
import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Bonjour, {user?.username}!
      </h1>
      <p className="text-gray-600">
        Welcome to Lingaru. Your French learning journey starts here.
      </p>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700">Target Level</h2>
          <p className="text-3xl font-bold text-primary-600 mt-2">
            {user?.target_level}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700">Daily Goal</h2>
          <p className="text-3xl font-bold text-primary-600 mt-2">
            {user?.daily_goal_minutes} min
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700">Streak</h2>
          <p className="text-3xl font-bold text-primary-600 mt-2">0 days</p>
        </div>
      </div>
    </div>
  );
}
```

```jsx
// frontend/src/pages/Login.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(username, password);
      navigate("/");
    } catch {
      setError("Invalid username or password.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Sign in to Lingaru
        </h1>
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition"
          >
            Sign In
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Don't have an account?{" "}
          <Link to="/register" className="text-primary-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
```

```jsx
// frontend/src/pages/Register.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Register() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    passwordConfirm: "",
  });
  const [error, setError] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await register(form.username, form.email, form.password, form.passwordConfirm);
      navigate("/");
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const messages = Object.values(data).flat().join(" ");
        setError(messages);
      } else {
        setError("Registration failed. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Create your account
        </h1>
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              name="passwordConfirm"
              value={form.passwordConfirm}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
              minLength={8}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition"
          >
            Register
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-primary-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

```jsx
// frontend/src/pages/NotFound.jsx
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
      <p className="text-gray-600 mb-6">Page not found</p>
      <Link
        to="/"
        className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition"
      >
        Go home
      </Link>
    </div>
  );
}
```

- [ ] **Step 7: Create App.jsx with routing**

```jsx
// frontend/src/App.jsx
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          {/* Future routes: /topics, /discover, /progress, /settings */}
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
```

- [ ] **Step 8: Create frontend .env.example and Dockerfile**

```env
# frontend/.env.example
VITE_API_URL=/api
```

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

- [ ] **Step 9: Install dependencies and verify frontend builds**

```bash
cd frontend && npm install && npm run build
```

Expected: build succeeds, creates `frontend/dist/` directory

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: add React + Vite frontend with auth, routing, Tailwind, Docker"
```

---

### Task 7: Integration Test — Full Stack Smoke Test

**Files:**
- Modify: `.gitignore` (add `frontend/node_modules/`)

- [ ] **Step 1: Update .gitignore**

Ensure `.gitignore` has entries for `frontend/node_modules/` and `frontend/dist/` (should already exist from initial setup, verify).

- [ ] **Step 2: Verify Docker Compose builds**

```bash
cp .env.example .env && docker compose -f docker-compose.yml -f docker-compose.dev.yml build
```

Expected: all services build successfully

- [ ] **Step 3: Start the stack**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Expected: postgres, redis, django services start. Check logs:

```bash
docker compose logs django --tail 20
```

Expected: Django dev server running on 0.0.0.0:8000

- [ ] **Step 4: Run migrations inside container**

```bash
docker compose exec django python manage.py migrate
```

Expected: all migrations applied

- [ ] **Step 5: Test API endpoint**

```bash
curl -s http://localhost:8000/api/users/register/ \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"testpass123!","password_confirm":"testpass123!"}' | python -m json.tool
```

Expected: 201 response with user data

- [ ] **Step 6: Test login**

```bash
curl -s http://localhost:8000/api/users/login/ \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"testpass123!"}' | python -m json.tool
```

Expected: 200 response with `access` and `refresh` tokens

- [ ] **Step 7: Stop the stack**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

- [ ] **Step 8: Run backend test suite one final time**

```bash
cd backend && python -m pytest -v --tb=short
```

Expected: all 15 tests PASS

- [ ] **Step 9: Final commit**

```bash
git add -A && git commit -m "chore: finalize Phase 1 foundation — full stack verified"
```
