import pytest
from django.contrib.auth import get_user_model
from apps.assistant.models import Conversation, Message

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="aiuser", email="ai@example.com", password="testpass123!",
    )


@pytest.fixture
def conversation(user):
    return Conversation.objects.create(
        user=user,
        title="French practice",
    )


@pytest.mark.django_db
class TestConversation:
    def test_create_conversation(self, user):
        conv = Conversation.objects.create(user=user, title="Test chat")
        assert conv.id is not None
        assert conv.user == user
        assert conv.title == "Test chat"
        assert conv.context is None
        assert conv.created_at is not None

    def test_create_conversation_with_context(self, user):
        conv = Conversation.objects.create(
            user=user, title="Lesson chat", context="lesson:42",
        )
        assert conv.context == "lesson:42"

    def test_conversation_str(self, conversation):
        assert str(conversation) == "French practice"

    def test_conversation_ordering(self, user):
        c1 = Conversation.objects.create(user=user, title="First")
        c2 = Conversation.objects.create(user=user, title="Second")
        convos = list(Conversation.objects.filter(user=user))
        # Most recent first
        assert convos[0] == c2
        assert convos[1] == c1

    def test_conversation_user_cascade(self, user, conversation):
        user.delete()
        assert Conversation.objects.count() == 0


@pytest.mark.django_db
class TestMessage:
    def test_create_user_message(self, conversation):
        msg = Message.objects.create(
            conversation=conversation,
            role="user",
            content="Bonjour!",
        )
        assert msg.id is not None
        assert msg.role == "user"
        assert msg.content == "Bonjour!"
        assert msg.provider is None
        assert msg.tokens_used == 0
        assert msg.created_at is not None

    def test_create_assistant_message(self, conversation):
        msg = Message.objects.create(
            conversation=conversation,
            role="assistant",
            content="Bonjour! Comment allez-vous?",
            provider="gemini",
            tokens_used=25,
        )
        assert msg.role == "assistant"
        assert msg.provider == "gemini"
        assert msg.tokens_used == 25

    def test_message_str(self, conversation):
        msg = Message.objects.create(
            conversation=conversation, role="user", content="Salut!",
        )
        assert "user" in str(msg)

    def test_message_ordering(self, conversation):
        m1 = Message.objects.create(
            conversation=conversation, role="user", content="First",
        )
        m2 = Message.objects.create(
            conversation=conversation, role="assistant", content="Second",
        )
        msgs = list(Message.objects.filter(conversation=conversation))
        # Chronological order (oldest first)
        assert msgs[0] == m1
        assert msgs[1] == m2

    def test_message_conversation_cascade(self, conversation):
        Message.objects.create(
            conversation=conversation, role="user", content="Test",
        )
        conversation.delete()
        assert Message.objects.count() == 0

    def test_role_choices_enforced(self, conversation):
        # Valid roles should work
        for role in ("user", "assistant"):
            msg = Message.objects.create(
                conversation=conversation, role=role, content="test",
            )
            assert msg.role == role
