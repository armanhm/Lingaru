from rest_framework import serializers
from .models import AudioClip


class TTSRequestSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=1000)
    language = serializers.CharField(max_length=10, default="fr", required=False)

    def validate_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Text cannot be empty.")
        return value


class AudioClipSerializer(serializers.ModelSerializer):
    audio_url = serializers.SerializerMethodField()

    class Meta:
        model = AudioClip
        fields = ("id", "text_content", "language", "provider", "audio_url", "created_at")

    def get_audio_url(self, obj):
        request = self.context.get("request")
        if request and obj.audio_file:
            return request.build_absolute_uri(obj.audio_file.url)
        if obj.audio_file:
            return obj.audio_file.url
        return None
