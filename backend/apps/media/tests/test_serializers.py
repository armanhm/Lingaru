import pytest
from apps.media.serializers import TTSRequestSerializer


class TestTTSRequestSerializer:
    def test_valid_data(self):
        s = TTSRequestSerializer(data={"text": "Bonjour"})
        assert s.is_valid()
        assert s.validated_data["text"] == "Bonjour"
        assert s.validated_data["language"] == "fr"

    def test_valid_data_with_language(self):
        s = TTSRequestSerializer(data={"text": "Hello", "language": "en"})
        assert s.is_valid()
        assert s.validated_data["language"] == "en"

    def test_empty_text_invalid(self):
        s = TTSRequestSerializer(data={"text": ""})
        assert not s.is_valid()

    def test_whitespace_text_invalid(self):
        s = TTSRequestSerializer(data={"text": "   "})
        assert not s.is_valid()

    def test_missing_text_invalid(self):
        s = TTSRequestSerializer(data={})
        assert not s.is_valid()

    def test_text_too_long(self):
        s = TTSRequestSerializer(data={"text": "a" * 1001})
        assert not s.is_valid()
