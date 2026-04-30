from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assistant.models import Conversation

from .models import Agent, AgentRun
from .serializers import (
    AgentDetailSerializer,
    AgentListSerializer,
    AgentRunSerializer,
)


class AgentListView(APIView):
    """GET /api/agents/ — gallery payload (lean, public-ish, no system prompt)."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        qs = Agent.objects.filter(is_active=True).order_by("order", "name")
        return Response(AgentListSerializer(qs, many=True).data)


class AgentDetailView(APIView):
    """GET /api/agents/<slug>/ — full payload for the run page."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, slug):
        agent = get_object_or_404(Agent, slug=slug, is_active=True)
        return Response(AgentDetailSerializer(agent).data)


class AgentStartRunView(APIView):
    """POST /api/agents/<slug>/start/ — create a fresh conversation pinned to this agent."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, slug):
        agent = get_object_or_404(Agent, slug=slug, is_active=True)
        conversation = Conversation.objects.create(
            user=request.user,
            title=f"{agent.name} — nouvelle session",
            context=f"agent:{agent.slug}",
        )
        run = AgentRun.objects.create(
            user=request.user, agent=agent, conversation=conversation,
        )
        return Response(
            {
                "agent": AgentDetailSerializer(agent).data,
                "conversation_id": conversation.id,
                "run_id": run.id,
            },
            status=status.HTTP_201_CREATED,
        )


class AgentRunsView(APIView):
    """GET /api/agents/<slug>/runs/ — user's past conversations with this agent."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, slug):
        agent = get_object_or_404(Agent, slug=slug, is_active=True)
        runs = (
            AgentRun.objects
            .filter(user=request.user, agent=agent)
            .select_related("conversation")
            .order_by("-started_at")[:20]
        )
        return Response(AgentRunSerializer(runs, many=True).data)
