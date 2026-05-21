from django.urls import path

from .views import (
    NoteAddToSrsView,
    NoteAskView,
    NoteDetailView,
    NoteGenerateQuizView,
    NoteListView,
)

app_name = "notes"

urlpatterns = [
    path("", NoteListView.as_view(), name="notes-list"),
    path("<int:pk>/", NoteDetailView.as_view(), name="notes-detail"),
    path("<int:pk>/ask/", NoteAskView.as_view(), name="notes-ask"),
    path("<int:pk>/add-to-srs/", NoteAddToSrsView.as_view(), name="notes-add-to-srs"),
    path(
        "<int:pk>/generate-quiz/",
        NoteGenerateQuizView.as_view(),
        name="notes-generate-quiz",
    ),
]
