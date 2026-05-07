"""Tests for video lesson task helpers."""

import json
from unittest.mock import MagicMock, patch

import pytest

from apps.content.tasks import _extract_youtube_id, _parse_json_response


class TestExtractYoutubeId:
    def test_standard_watch_url(self):
        assert _extract_youtube_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_short_url(self):
        assert _extract_youtube_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_embed_url(self):
        assert _extract_youtube_id("https://www.youtube.com/embed/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_shorts_url(self):
        assert _extract_youtube_id("https://www.youtube.com/shorts/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_url_with_extra_params(self):
        assert (
            _extract_youtube_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")
            == "dQw4w9WgXcQ"
        )

    def test_invalid_url_returns_none(self):
        assert _extract_youtube_id("https://vimeo.com/123456") is None

    def test_empty_string_returns_none(self):
        assert _extract_youtube_id("") is None


class TestParseJsonResponse:
    def test_plain_json(self):
        result = _parse_json_response('{"key": "value"}')
        assert result == {"key": "value"}

    def test_strips_markdown_fences(self):
        text = '```json\n{"key": "value"}\n```'
        result = _parse_json_response(text)
        assert result == {"key": "value"}

    def test_strips_plain_fences(self):
        text = '```\n{"key": "value"}\n```'
        result = _parse_json_response(text)
        assert result == {"key": "value"}

    def test_json_array(self):
        result = _parse_json_response("[1, 2, 3]")
        assert result == [1, 2, 3]

    def test_invalid_json_raises(self):
        with pytest.raises(json.JSONDecodeError):
            _parse_json_response("not valid json")
