from django.contrib import admin
from django.utils.html import format_html

from .models import (
    GrammarRule,
    Lesson,
    Question,
    ReadingText,
    Topic,
    VideoExpression,
    VideoLesson,
    VideoVocabulary,
    Vocabulary,
)


class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 1
    fields = ("title", "type", "order", "difficulty")
    ordering = ("order",)


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ("name_fr", "name_en", "order", "difficulty_level")
    list_filter = ("difficulty_level",)
    search_fields = ("name_fr", "name_en", "description")
    ordering = ("order",)
    inlines = [LessonInline]


class VocabularyInline(admin.TabularInline):
    model = Vocabulary
    extra = 1
    fields = ("french", "english", "pronunciation", "gender", "part_of_speech", "example_sentence")


class GrammarRuleInline(admin.StackedInline):
    model = GrammarRule
    extra = 0
    fields = ("title", "explanation", "formula", "examples", "exceptions")


class ReadingTextInline(admin.StackedInline):
    model = ReadingText
    extra = 0
    fields = (
        "title",
        "content_fr",
        "content_en",
        "vocabulary_highlights",
        "comprehension_questions",
    )


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1
    fields = ("type", "prompt", "correct_answer", "wrong_answers", "difficulty")


class VideoLessonInline(admin.StackedInline):
    model = VideoLesson
    extra = 0
    fields = ("youtube_url", "status", "title", "transcript_fr", "transcript_en", "error_message")
    readonly_fields = (
        "status",
        "title",
        "thumbnail_url",
        "duration_seconds",
        "youtube_id",
        "error_message",
    )
    can_delete = True


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("title", "topic", "type", "order", "difficulty", "has_video")
    list_filter = ("type", "difficulty", "topic")
    search_fields = ("title",)
    ordering = ("topic__order", "order")
    inlines = [
        VocabularyInline,
        GrammarRuleInline,
        ReadingTextInline,
        QuestionInline,
        VideoLessonInline,
    ]

    @admin.display(description="Video", boolean=True)
    def has_video(self, obj):
        return hasattr(obj, "video") and obj.video is not None


@admin.register(Vocabulary)
class VocabularyAdmin(admin.ModelAdmin):
    list_display = ("french", "english", "gender", "part_of_speech", "lesson")
    list_filter = ("gender", "part_of_speech")
    search_fields = ("french", "english")


@admin.register(GrammarRule)
class GrammarRuleAdmin(admin.ModelAdmin):
    list_display = ("title", "lesson")
    search_fields = ("title", "explanation")


@admin.register(ReadingText)
class ReadingTextAdmin(admin.ModelAdmin):
    list_display = ("title", "lesson")
    search_fields = ("title", "content_fr", "content_en")


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("prompt_short", "type", "difficulty", "lesson")
    list_filter = ("type", "difficulty")
    search_fields = ("prompt", "correct_answer")

    @admin.display(description="Prompt")
    def prompt_short(self, obj):
        return obj.prompt[:80]


class VideoVocabularyInline(admin.TabularInline):
    model = VideoVocabulary
    extra = 0
    fields = ("french", "english", "pronunciation", "example_sentence", "timestamp_seconds")


class VideoExpressionInline(admin.TabularInline):
    model = VideoExpression
    extra = 0
    fields = ("expression_fr", "expression_en", "context_sentence", "timestamp_seconds")


@admin.register(VideoLesson)
class VideoLessonAdmin(admin.ModelAdmin):
    list_display = ("lesson", "title", "status", "youtube_preview", "created_at")
    list_filter = ("status",)
    search_fields = ("lesson__title", "title", "youtube_url")
    readonly_fields = (
        "youtube_id",
        "title",
        "thumbnail_url",
        "duration_seconds",
        "status",
        "transcript_fr",
        "transcript_en",
        "error_message",
        "youtube_preview",
        "created_at",
        "updated_at",
    )
    fields = (
        "lesson",
        "youtube_url",
        "youtube_preview",
        "youtube_id",
        "title",
        "thumbnail_url",
        "duration_seconds",
        "status",
        "error_message",
        "transcript_fr",
        "transcript_en",
        "created_at",
        "updated_at",
    )
    inlines = [VideoVocabularyInline, VideoExpressionInline]

    @admin.display(description="Preview")
    def youtube_preview(self, obj):
        if obj.youtube_id:
            return format_html(
                '<img src="https://img.youtube.com/vi/{}/mqdefault.jpg" '
                'style="max-width:320px;border-radius:4px;" />',
                obj.youtube_id,
            )
        return "—"

    def save_model(self, request, obj, form, change):
        """Trigger processing task when youtube_url is set or changed."""
        is_new_url = not change or "youtube_url" in form.changed_data
        super().save_model(request, obj, form, change)
        if is_new_url and obj.youtube_url:
            from apps.content.tasks import process_video_lesson

            process_video_lesson.delay(obj.pk)
