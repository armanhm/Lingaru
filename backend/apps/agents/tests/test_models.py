import pytest

from apps.agents.models import Agent


@pytest.mark.django_db
def test_agent_system_prompt_en_defaults_to_empty():
    agent = Agent.objects.create(
        slug="g", name="Grammar", system_prompt="Tu es un tuteur de grammaire."
    )
    assert agent.system_prompt_en == ""


@pytest.mark.django_db
def test_agent_can_have_en_prompt():
    agent = Agent.objects.create(
        slug="g2",
        name="Grammar",
        system_prompt="Tu es un tuteur de grammaire.",
        system_prompt_en="You are a grammar tutor.",
    )
    assert agent.system_prompt_en == "You are a grammar tutor."
