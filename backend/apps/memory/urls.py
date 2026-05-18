from django.urls import path

from . import views

app_name = "memory"

urlpatterns = [
    path("notes/", views.MemoryNoteListCreateView.as_view(), name="note-list"),
    path("notes/<int:pk>/", views.MemoryNoteDetailView.as_view(), name="note-detail"),
]
