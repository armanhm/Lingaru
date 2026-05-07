"""Append the structured-payloads instruction to every existing agent's
``system_prompt``. Idempotent — see ``apps.agents.prompts`` for the
shared instruction text and marker."""

from django.db import migrations


def _import_helpers():
    """Late import so the migration can be replayed even if ``prompts.py``
    has been refactored — Django imports migrations independently of apps."""
    from apps.agents.prompts import BLOCK_FENCE_INSTRUCTION_MARK, ensure_block_instruction

    return BLOCK_FENCE_INSTRUCTION_MARK, ensure_block_instruction


def append_instruction(apps, schema_editor):
    _, ensure = _import_helpers()
    Agent = apps.get_model("agents", "Agent")
    for agent in Agent.objects.all():
        new_prompt = ensure(agent.system_prompt)
        if new_prompt != agent.system_prompt:
            agent.system_prompt = new_prompt
            agent.save(update_fields=["system_prompt"])


def remove_instruction(apps, schema_editor):
    mark, _ = _import_helpers()
    Agent = apps.get_model("agents", "Agent")
    for agent in Agent.objects.all():
        prompt = agent.system_prompt or ""
        if mark not in prompt:
            continue
        head, _sep, _tail = prompt.partition(mark)
        agent.system_prompt = head.rstrip()
        agent.save(update_fields=["system_prompt"])


class Migration(migrations.Migration):
    dependencies = [
        ("agents", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(append_instruction, remove_instruction),
    ]
