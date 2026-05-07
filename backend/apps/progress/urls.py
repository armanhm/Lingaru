from django.urls import path

from . import views

app_name = "progress"

urlpatterns = [
    path("srs/due/", views.SRSDueCardsView.as_view(), name="srs-due"),
    path("srs/review/", views.SRSReviewView.as_view(), name="srs-review"),
    path("mistakes/", views.MistakeListView.as_view(), name="mistake-list"),
    path(
        "mistakes/reviewed/", views.MistakeMarkReviewedView.as_view(), name="mistake-mark-reviewed"
    ),
    path("conjugation/check/", views.ConjugationCheckView.as_view(), name="conjugation-check"),
    path("conjugation/verbs/", views.ConjugationListView.as_view(), name="conjugation-verbs"),
    path(
        "lessons/<int:lesson_id>/complete/",
        views.LessonCompleteView.as_view(),
        name="lesson-complete",
    ),
    path("topics/<int:topic_id>/", views.TopicProgressView.as_view(), name="topic-progress"),
]
