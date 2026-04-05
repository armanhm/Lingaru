from rest_framework import serializers
from .models import AudioClip, PronunciationAttempt


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


class PronunciationCheckSerializer(serializers.Serializer):
    audio = serializers.FileField()
    expected_text = serializers.CharField(max_length=1000)
    vocabulary_id = serializers.IntegerField(required=False, allow_null=True)


class PronunciationResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = PronunciationAttempt
        fields = (
            "id", "expected_text", "transcription",
            "accuracy_score", "feedback", "created_at",
        )


class DictationStartSerializer(serializers.Serializer):
    """Response serializer for starting a dictation exercise."""
    audio_clip = AudioClipSerializer()
    sentence_id = serializers.IntegerField()


class DictationCheckRequestSerializer(serializers.Serializer):
    audio_clip_id = serializers.IntegerField()
    user_text = serializers.CharField(max_length=2000)


class DictationCheckResponseSerializer(serializers.Serializer):
    correct = serializers.BooleanField()
    expected = serializers.CharField()
    user_text = serializers.CharField()
    accuracy = serializers.FloatField()
    feedback = serializers.CharField()
