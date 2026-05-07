from django.conf import settings
from django.db import models


class Agent(models.Model):
    """A specialised assistant tool — admin-editable system prompt and surface metadata.

    Each agent backs a card in the /agents gallery and a dedicated /agents/<slug>
    run page. The chat composer's @-mention popover also routes through this
    table so the slug list is the single source of truth.
    """

    MODE_CHOICES = [
        ("conversation", "Conversation"),
        ("grammar_correction", "Grammar Correction"),
        ("grammar_explanation", "Grammar Explanation"),
    ]

    OUTPUT_SHAPE_CHOICES = [
        ("free_text", "Free text"),
        ("structured", "Structured"),
    ]

    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=80)
    emoji = models.CharField(max_length=8, default="✨")
    tint = models.CharField(
        max_length=120,
        default="from-primary-500 to-purple-600",
        help_text="Tailwind gradient pair for the avatar / top band.",
    )
    tagline = models.CharField(max_length=160, blank=True, default="")
    description = models.TextField(blank=True, default="")
    best_for = models.JSONField(default=list, blank=True)
    capabilities = models.JSONField(default=list, blank=True)
    suggested_questions = models.JSONField(default=list, blank=True)

    system_prompt = models.TextField(
        help_text="System prompt sent to the LLM for every turn of this agent.",
    )
    mode = models.CharField(max_length=24, choices=MODE_CHOICES, default="conversation")
    output_shape = models.CharField(
        max_length=12, choices=OUTPUT_SHAPE_CHOICES, default="free_text"
    )

    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "agents_agent"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class AgentRun(models.Model):
    """Pins an assistant Conversation to a specific agent.

    A user can have many AgentRuns per agent — each is a fresh conversation
    thread, listed under the agent's "Recent runs" panel.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="agent_runs",
    )
    agent = models.ForeignKey(
        Agent,
        on_delete=models.CASCADE,
        related_name="runs",
    )
    conversation = models.ForeignKey(
        "assistant.Conversation",
        on_delete=models.CASCADE,
        related_name="agent_runs",
    )
    started_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "agents_run"
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["user", "agent", "-started_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} · {self.agent.slug}"
