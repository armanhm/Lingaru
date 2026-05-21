from rest_framework import serializers

from .models import Note, NoteWord


class NoteWordSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteWord
        fields = ("id", "word", "definition", "example", "order")


class NoteListSerializer(serializers.ModelSerializer):
    word_count = serializers.IntegerField(source="words.count", read_only=True)

    class Meta:
        model = Note
        fields = ("id", "note_number", "date", "title", "word_count")


class NoteDetailSerializer(serializers.ModelSerializer):
    words = NoteWordSerializer(many=True, read_only=True)

    class Meta:
        model = Note
        fields = ("id", "note_number", "date", "title", "words")
