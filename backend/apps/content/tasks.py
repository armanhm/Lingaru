"""Celery tasks for content processing — specifically YouTube video lessons."""

import json
import logging
import re

from celery import shared_task

logger = logging.getLogger(__name__)


def _extract_youtube_id(url: str) -> str | None:
    """Extract the 11-char video ID from any YouTube URL format."""
    patterns = [
        r"(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


class TranscriptFetchError(Exception):
    """Raised when YouTube refuses to give us captions for an environment-
    level reason (IP blocked, video private, rate limit). Distinct from
    `NoTranscriptFound` which means the video genuinely has no FR/EN captions."""


def _fetch_transcript(video_id: str) -> tuple[str, str]:
    """Fetch the French transcript (and English if available).

    Returns (transcript_fr, transcript_en).

    Raises TranscriptFetchError with a user-friendly message if YouTube
    blocks us (common on datacenter IPs like Hetzner) or if the video is
    private/unavailable. Returns empty strings only when the video
    legitimately has no captions in either language.
    """
    from youtube_transcript_api import (
        NoTranscriptFound,
        TranscriptsDisabled,
        VideoUnavailable,
        YouTubeTranscriptApi,
    )

    transcript_fr = ""
    transcript_en = ""

    try:
        api = YouTubeTranscriptApi()
        transcript_list = api.list(video_id)
    except TranscriptsDisabled:
        raise TranscriptFetchError(
            "Captions are disabled for this video. Try one with captions enabled."
        )
    except VideoUnavailable:
        raise TranscriptFetchError(
            "This video is unavailable (private, removed, or region-locked)."
        )
    except Exception as exc:
        # Most commonly: RequestBlocked / IpBlocked / TooManyRequests when
        # YouTube detects datacenter IP. Surface the real error class so
        # admins can spot the pattern in /admin/ → VideoLesson.
        msg = str(exc) or exc.__class__.__name__
        raise TranscriptFetchError(
            f"YouTube refused the request — likely datacenter IP block "
            f"or rate limit. Underlying error: {exc.__class__.__name__}: {msg[:200]}"
        )

    # Try French first (manual, then auto-generated)
    fr_transcript = None
    try:
        fr_transcript = transcript_list.find_transcript(["fr"])
    except NoTranscriptFound:
        try:
            fr_transcript = transcript_list.find_generated_transcript(["fr"])
        except NoTranscriptFound:
            pass

    if fr_transcript:
        try:
            segments = fr_transcript.fetch()
            transcript_fr = " ".join(seg.text for seg in segments)
        except Exception as exc:
            raise TranscriptFetchError(
                f"Could not download FR transcript: {exc.__class__.__name__}: {str(exc)[:200]}"
            )

    # Try English (for translation reference)
    try:
        en_transcript = transcript_list.find_transcript(["en"])
        try:
            segments = en_transcript.fetch()
            transcript_en = " ".join(seg.text for seg in segments)
        except Exception:
            # English is optional — log but don't fail the whole task
            logger.warning("Could not download EN transcript for %s", video_id)
    except NoTranscriptFound:
        pass

    return transcript_fr, transcript_en


def _call_llm(prompt: str) -> str:
    """Call the configured LLM and return the text response."""
    from services.llm.factory import create_llm_router

    router = create_llm_router()
    response = router.generate(
        messages=[{"role": "user", "content": prompt}],
        system_prompt=(
            "You are a French language teacher assistant. "
            "You extract learning content from French video transcripts. "
            "Always respond with valid JSON only — no markdown, no code fences."
        ),
    )
    return response.content


def _parse_json_response(text: str) -> dict | list:
    """Strip any accidental markdown fences and parse JSON."""
    text = text.strip()
    # Remove ```json ... ``` wrappers if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def _extract_content_from_transcript(transcript_fr: str, lesson_title: str) -> dict:
    """Ask the LLM to extract vocabulary, expressions, and quiz questions."""

    # Trim very long transcripts to avoid token limits
    excerpt = transcript_fr[:6000] if len(transcript_fr) > 6000 else transcript_fr

    prompt = f"""
Analyse this French video transcript for a lesson called "{lesson_title}".

TRANSCRIPT:
{excerpt}

Extract the following and return ONLY valid JSON in this exact structure:
{{
  "vocabulary": [
    {{
      "french": "le mot",
      "english": "the word",
      "pronunciation": "lə mo",
      "example_sentence": "sentence from transcript using this word",
      "timestamp_hint": "approximate position: beginning/middle/end"
    }}
  ],
  "expressions": [
    {{
      "expression_fr": "avoir du mal à",
      "expression_en": "to have difficulty with",
      "context_sentence": "sentence from transcript using this expression"
    }}
  ],
  "questions": [
    {{
      "type": "mcq",
      "prompt": "question text",
      "correct_answer": "correct option",
      "wrong_answers": ["wrong1", "wrong2", "wrong3"],
      "explanation": "why this answer is correct"
    }},
    {{
      "type": "translate",
      "prompt": "Translate: [French sentence from video]",
      "correct_answer": "English translation",
      "wrong_answers": [],
      "explanation": ""
    }},
    {{
      "type": "fill_blank",
      "prompt": "Complete: [sentence with ___ for the missing word]",
      "correct_answer": "missing word",
      "wrong_answers": [],
      "explanation": ""
    }}
  ]
}}

Rules:
- Extract 5-10 vocabulary items that are B1-B2 level useful words
- Extract 3-5 idiomatic expressions or collocations
- Create 5-8 questions mixing mcq, translate, and fill_blank types
- Base everything strictly on what appears in the transcript
- Keep JSON valid — no trailing commas, no comments
"""

    raw = _call_llm(prompt)
    return _parse_json_response(raw)


@shared_task(name="content.process_video_lesson", bind=True, max_retries=2)
def process_video_lesson(self, video_lesson_id: int) -> None:
    """Process a VideoLesson: fetch transcript, extract content via LLM, save records."""
    from apps.content.models import Question, VideoExpression, VideoLesson, VideoVocabulary

    try:
        video = VideoLesson.objects.select_related("lesson").get(pk=video_lesson_id)
    except VideoLesson.DoesNotExist:
        logger.error("VideoLesson %d not found", video_lesson_id)
        return

    logger.info("Processing VideoLesson %d: %s", video_lesson_id, video.youtube_url)

    # Mark as processing
    video.status = "processing"
    video.error_message = ""
    video.save(update_fields=["status", "error_message"])

    try:
        # Step 1: Extract video ID
        video_id = _extract_youtube_id(video.youtube_url)
        if not video_id:
            raise ValueError(f"Could not extract YouTube video ID from: {video.youtube_url}")

        video.youtube_id = video_id
        video.thumbnail_url = f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"
        video.save(update_fields=["youtube_id", "thumbnail_url"])

        # Step 2: Fetch transcript
        logger.info("Fetching transcript for video %s", video_id)
        transcript_fr, transcript_en = _fetch_transcript(video_id)

        if not transcript_fr:
            raise ValueError(
                "No French transcript available for this video. "
                "Make sure the video has French captions (manual or auto-generated)."
            )

        video.transcript_fr = transcript_fr
        video.transcript_en = transcript_en
        video.save(update_fields=["transcript_fr", "transcript_en"])

        # Step 3: Extract content via LLM
        logger.info("Extracting content via LLM for VideoLesson %d", video_lesson_id)
        extracted = _extract_content_from_transcript(transcript_fr, video.lesson.title)

        # Step 4: Clear old extracted content and save new
        VideoVocabulary.objects.filter(video_lesson=video).delete()
        VideoExpression.objects.filter(video_lesson=video).delete()
        Question.objects.filter(lesson=video.lesson, prompt__startswith="[VIDEO]").delete()

        # Save vocabulary
        for item in extracted.get("vocabulary", []):
            VideoVocabulary.objects.create(
                video_lesson=video,
                french=item.get("french", ""),
                english=item.get("english", ""),
                pronunciation=item.get("pronunciation", ""),
                example_sentence=item.get("example_sentence", ""),
                timestamp_seconds=0,
            )

        # Save expressions
        for item in extracted.get("expressions", []):
            VideoExpression.objects.create(
                video_lesson=video,
                expression_fr=item.get("expression_fr", ""),
                expression_en=item.get("expression_en", ""),
                context_sentence=item.get("context_sentence", ""),
                timestamp_seconds=0,
            )

        # Save questions (prefixed so they can be identified/removed later)
        for item in extracted.get("questions", []):
            q_type = item.get("type", "mcq")
            if q_type not in (
                "mcq",
                "fill_blank",
                "translate",
                "match",
                "listen",
                "cloze",
                "conjugation",
            ):
                q_type = "mcq"
            Question.objects.create(
                lesson=video.lesson,
                type=q_type,
                prompt=f"[VIDEO] {item.get('prompt', '')}",
                correct_answer=item.get("correct_answer", ""),
                wrong_answers=item.get("wrong_answers", []),
                explanation=item.get("explanation", ""),
                difficulty=2,
            )

        # Mark as ready
        video.status = "ready"
        video.save(update_fields=["status"])
        logger.info("VideoLesson %d processed successfully", video_lesson_id)

    except Exception as exc:
        logger.exception("Failed to process VideoLesson %d: %s", video_lesson_id, exc)
        video.status = "failed"
        video.error_message = str(exc)
        video.save(update_fields=["status", "error_message"])

        # Retry on transient errors (not ValueError which is a bad URL/config)
        if not isinstance(exc, ValueError):
            raise self.retry(exc=exc, countdown=60)
