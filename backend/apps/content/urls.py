from django.urls import path

from . import views

app_name = "content"

urlpatterns = [
    path("topics/", views.TopicListView.as_view(), name="topic-list"),
    path("topics/<int:pk>/", views.TopicDetailView.as_view(), name="topic-detail"),
    path("lessons/<int:pk>/", views.LessonDetailView.as_view(), name="lesson-detail"),
    path("lessons/<int:pk>/video/", views.LessonVideoView.as_view(), name="lesson-video"),
    path("vocabulary/random/", views.RandomVocabularyView.as_view(), name="vocabulary-random"),
]
