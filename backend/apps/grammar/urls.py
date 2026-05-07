from django.urls import path

from . import views

app_name = "grammar"

urlpatterns = [
    path("hub/", views.HubView.as_view(), name="hub"),
    path("categories/", views.CategoryListView.as_view(), name="categories"),
    path("topics/", views.TopicListView.as_view(), name="topics"),
    path("topics/<slug:slug>/", views.TopicDetailView.as_view(), name="topic-detail"),
    path("sessions/start/", views.StartSessionView.as_view(), name="session-start"),
    path(
        "sessions/<int:session_id>/answer/", views.SubmitAnswerView.as_view(), name="session-answer"
    ),
    path(
        "sessions/<int:session_id>/complete/",
        views.CompleteSessionView.as_view(),
        name="session-complete",
    ),
]
