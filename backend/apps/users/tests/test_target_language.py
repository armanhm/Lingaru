import pytest
from django.contrib.auth import get_user_model

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
