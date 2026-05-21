from django.contrib import admin

from .models import Note, NoteWord


class NoteWordInline(admin.TabularInline):
    model = NoteWord
    extra = 0
    fields = ("order", "word", "definition", "example")


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = (
        "note_number",
        "date",
        "title_or_blank",
        "language",
        "word_count",
        "is_active",
    )
    list_filter = ("language", "is_active")
    search_fields = ("title", "note_number")
    inlines = [NoteWordInline]

    def title_or_blank(self, obj):
        return obj.title or "(no title)"

    title_or_blank.short_description = "Title"

    def word_count(self, obj):
        return obj.words.count()

    word_count.short_description = "Words"


@admin.register(NoteWord)
class NoteWordAdmin(admin.ModelAdmin):
    list_display = ("word", "note", "order")
    list_filter = ("note__language",)
    search_fields = ("word", "definition")
