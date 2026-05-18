import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.mark.django_db
def test_user_target_language_defaults_to_fr():
    user = User.objects.create_user(username="u1", email="u1@x.com", password="x")
    assert user.target_language == "fr"


@pytest.mark.django_db
def test_user_target_language_accepts_en():
    user = User.objects.create_user(
        username="u2", email="u2@x.com", password="x", target_language="en"
    )
    assert user.target_language == "en"


@pytest.mark.django_db
def test_user_target_language_rejects_invalid_via_full_clean():
    """Models enforce choices at the validator layer, not at __init__.
    full_clean() is what surfaces the constraint."""
    from django.core.exceptions import ValidationError

    user = User(username="u3", email="u3@x.com", target_language="es")
    user.set_password("x")
    with pytest.raises(ValidationError):
        user.full_clean()


@pytest.mark.django_db
def test_user_me_endpoint_includes_target_language():
    user = User.objects.create_user(
        username="me", email="me@x.com", password="x", target_language="en"
    )
    client = APIClient()
    client.force_authenticate(user)
    response = client.get("/api/users/me/")
    assert response.status_code == 200
    assert response.json()["target_language"] == "en"


@pytest.mark.django_db
def test_user_me_patch_target_language():
    user = User.objects.create_user(username="me2", email="me2@x.com", password="x")
    client = APIClient()
    client.force_authenticate(user)
    response = client.patch("/api/users/me/", {"target_language": "en"}, format="json")
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.target_language == "en"
