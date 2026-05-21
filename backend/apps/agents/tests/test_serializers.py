import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory

from apps.agents.models import Agent
from apps.agents.serializers import AgentDetailSerializer, AgentListSerializer

User = get_user_model()


def _make_request(user):
    factory = APIRequestFactory()
    request = factory.get("/api/agents/")
    request.user = user
    return request


@pytest.fixture
def agent_fr_only(db):
    return Agent.objects.create(
        slug="fr-only",
        name="Grammar Coach",
        tagline="Explique un point de grammaire.",
        description="Le coach de grammaire.",
        best_for=["Subjonctif"],
        capabilities=["Explique une regle"],
        suggested_questions=["Quand utiliser le subjonctif ?"],
        system_prompt="Tu es un tuteur.",
    )


@pytest.fixture
def agent_with_en(db):
    return Agent.objects.create(
        slug="bilingual",
        name="Grammar Coach",
        name_en="Grammar Coach EN",
        tagline="Explique un point de grammaire.",
        tagline_en="Walks you through a grammar point.",
        description="Le coach de grammaire.",
        description_en="The grammar coach.",
        best_for=["Subjonctif"],
        best_for_en=["Present perfect"],
        capabilities=["Explique une regle"],
        capabilities_en=["Explains a rule"],
        suggested_questions=["Quand utiliser le subjonctif ?"],
        suggested_questions_en=["When do I use the present perfect?"],
        system_prompt="Tu es un tuteur.",
    )


@pytest.fixture
def fr_user(db):
    return User.objects.create_user(
        username="fr", email="fr@test.com", password="x", target_language="fr"
    )


@pytest.fixture
def en_user(db):
    return User.objects.create_user(
        username="en", email="en@test.com", password="x", target_language="en"
    )


@pytest.mark.django_db
def test_detail_en_user_with_en_data_sees_english(agent_with_en, en_user):
    data = AgentDetailSerializer(agent_with_en, context={"request": _make_request(en_user)}).data
    assert data["name"] == "Grammar Coach EN"
    assert data["tagline"] == "Walks you through a grammar point."
    assert data["description"] == "The grammar coach."
    assert data["best_for"] == ["Present perfect"]
    assert data["capabilities"] == ["Explains a rule"]
    assert data["suggested_questions"] == ["When do I use the present perfect?"]


@pytest.mark.django_db
def test_detail_en_user_with_empty_en_falls_back_to_fr(agent_fr_only, en_user):
    data = AgentDetailSerializer(agent_fr_only, context={"request": _make_request(en_user)}).data
    assert data["name"] == "Grammar Coach"
    assert data["tagline"] == "Explique un point de grammaire."
    assert data["description"] == "Le coach de grammaire."
    assert data["best_for"] == ["Subjonctif"]
    assert data["capabilities"] == ["Explique une regle"]
    assert data["suggested_questions"] == ["Quand utiliser le subjonctif ?"]


@pytest.mark.django_db
def test_detail_fr_user_always_sees_fr(agent_with_en, fr_user):
    data = AgentDetailSerializer(agent_with_en, context={"request": _make_request(fr_user)}).data
    assert data["name"] == "Grammar Coach"
    assert data["tagline"] == "Explique un point de grammaire."
    assert data["description"] == "Le coach de grammaire."
    assert data["best_for"] == ["Subjonctif"]
    assert data["capabilities"] == ["Explique une regle"]
    assert data["suggested_questions"] == ["Quand utiliser le subjonctif ?"]


@pytest.mark.django_db
def test_list_en_user_sees_en_overrides(agent_with_en, en_user):
    data = AgentListSerializer(agent_with_en, context={"request": _make_request(en_user)}).data
    assert data["name"] == "Grammar Coach EN"
    assert data["tagline"] == "Walks you through a grammar point."
    assert data["best_for"] == ["Present perfect"]


@pytest.mark.django_db
def test_list_fr_user_sees_fr(agent_with_en, fr_user):
    data = AgentListSerializer(agent_with_en, context={"request": _make_request(fr_user)}).data
    assert data["name"] == "Grammar Coach"
    assert data["tagline"] == "Explique un point de grammaire."
    assert data["best_for"] == ["Subjonctif"]


@pytest.mark.django_db
def test_serializer_without_request_context_falls_back_to_fr(agent_with_en):
    data = AgentDetailSerializer(agent_with_en).data
    assert data["name"] == "Grammar Coach"
    assert data["tagline"] == "Explique un point de grammaire."
