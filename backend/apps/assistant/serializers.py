from rest_framework import serializers
from .models import Conversation, Message


class ChatRequestSerializer(serializers.Serializer):
    MODE_CHOICES = [
        ("conversation", "Conversation"),
        ("grammar_correction", "Grammar Correction"),
        ("grammar_explanation", "Grammar Explanation"),
    ]

    message = serializers.CharField(min_length=1)
    mode = serializers.ChoiceField(choices=MODE_CHOICES, default="conversation")
    conversation_id = serializers.IntegerField(required=False, allow_null=True)


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ("id", "role", "content", "provider", "tokens_used", "created_at")


class ConversationListSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Conversation
        fields = ("id", "title", "context", "created_at", "message_count")


class ImageQueryRequestSerializer(serializers.Serializer):
    image = serializers.ImageField()
    question = serializers.CharField(required=False, default="", allow_blank=True)
    conversation_id = serializers.IntegerField(required=False, allow_null=True)


class ConversationDetailSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ("id", "title", "context", "created_at", "messages")
