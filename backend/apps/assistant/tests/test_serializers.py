import pytest
from django.contrib.auth import get_user_model
from apps.assistant.models import Conversation, Message
from apps.assistant.serializers import (
    ChatRequestSerializer,
    MessageSerializer,
    ConversationListSerializer,
    ConversationDetailSerializer,
)

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="seruser", email="ser@example.com", password="testpass123!",
    )


@pytest.fixture
def conversation(user):
    return Conversation.objects.create(user=user, title="Test")


@pytest.mark.django_db
class TestChatRequestSerializer:
    def test_valid_conversation_mode(self):
        data = {"message": "Bonjour!", "mode": "conversation"}
        ser = ChatRequestSerializer(data=data)
        assert ser.is_valid(), ser.errors

    def test_valid_grammar_correction_mode(self):
        data = {"message": "Je suis alle au magasin", "mode": "grammar_correction"}
        ser = ChatRequestSerializer(data=data)
        assert ser.is_valid(), ser.errors

    def test_valid_grammar_explanation_mode(self):
        data = {"message": "Explain passe compose", "mode": "grammar_explanation"}
        ser = ChatRequestSerializer(data=data)
        assert ser.is_valid(), ser.errors

    def test_with_conversation_id(self, conversation):
        data = {
            "message": "Continue",
            "mode": "conversation",
            "conversation_id": conversation.id,
        }
        ser = ChatRequestSerializer(data=data)
        assert ser.is_valid(), ser.errors

    def test_invalid_mode(self):
        data = {"message": "Hi", "mode": "invalid"}
        ser = ChatRequestSerializer(data=data)
        assert not ser.is_valid()

    def test_empty_message(self):
        data = {"message": "", "mode": "conversation"}
        ser = ChatRequestSerializer(data=data)
        assert not ser.is_valid()

    def test_missing_message(self):
        data = {"mode": "conversation"}
        ser = ChatRequestSerializer(data=data)
        assert not ser.is_valid()

    def test_default_mode_is_conversation(self):
        data = {"message": "Bonjour!"}
        ser = ChatRequestSerializer(data=data)
        assert ser.is_valid(), ser.errors
        assert ser.validated_data["mode"] == "conversation"


@pytest.mark.django_db
class TestMessageSerializer:
    def test_serializes_message(self, conversation):
        msg = Message.objects.create(
            conversation=conversation, role="assistant",
            content="Bonjour!", provider="gemini", tokens_used=10,
        )
        data = MessageSerializer(msg).data
        assert data["role"] == "assistant"
        assert data["content"] == "Bonjour!"
        assert data["provider"] == "gemini"
        assert data["tokens_used"] == 10
        assert "created_at" in data
        assert "id" in data


@pytest.mark.django_db
class TestConversationListSerializer:
    def test_serializes_list(self, conversation):
        data = ConversationListSerializer(conversation).data
        assert data["id"] == conversation.id
        assert data["title"] == "Test"
        assert "created_at" in data
        assert "message_count" in data
        assert data["message_count"] == 0

    def test_message_count(self, conversation):
        Message.objects.create(
            conversation=conversation, role="user", content="Hi",
        )
        Message.objects.create(
            conversation=conversation, role="assistant", content="Hello",
        )
        # Must annotate for message_count — test via view or manual annotation
        from django.db.models import Count
        conv = Conversation.objects.annotate(
            message_count=Count("messages"),
        ).get(pk=conversation.pk)
        data = ConversationListSerializer(conv).data
        assert data["message_count"] == 2


@pytest.mark.django_db
class TestConversationDetailSerializer:
    def test_includes_messages(self, conversation):
        Message.objects.create(
            conversation=conversation, role="user", content="Bonjour",
        )
        Message.objects.create(
            conversation=conversation, role="assistant", content="Salut!",
            provider="gemini", tokens_used=15,
        )
        data = ConversationDetailSerializer(conversation).data
        assert data["id"] == conversation.id
        assert data["title"] == "Test"
        assert len(data["messages"]) == 2
        assert data["messages"][0]["role"] == "user"
        assert data["messages"][1]["role"] == "assistant"
