from django.contrib import admin
from .models import Topic, Lesson, Vocabulary, GrammarRule, ReadingText, Question


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
    fields = ("title", "content_fr", "content_en", "vocabulary_highlights", "comprehension_questions")


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1
    fields = ("type", "prompt", "correct_answer", "wrong_answers", "difficulty")


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("title", "topic", "type", "order", "difficulty")
    list_filter = ("type", "difficulty", "topic")
    search_fields = ("title",)
    ordering = ("topic__order", "order")
    inlines = [VocabularyInline, GrammarRuleInline, ReadingTextInline, QuestionInline]


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
