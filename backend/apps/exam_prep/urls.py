from django.urls import path
from . import views

app_name = "exam_prep"

urlpatterns = [
    path("hub/", views.HubView.as_view(), name="hub"),
    path("exercises/", views.ExerciseListView.as_view(), name="exercise-list"),
    path("sessions/start/", views.SessionStartView.as_view(), name="session-start"),
    path("sessions/<int:session_id>/respond/", views.SessionRespondView.as_view(), name="session-respond"),
    path("sessions/<int:session_id>/complete/", views.SessionCompleteView.as_view(), name="session-complete"),
    path("sessions/history/", views.SessionHistoryView.as_view(), name="session-history"),
]
