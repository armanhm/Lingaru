from django.urls import path
from . import views

app_name = "practice"

urlpatterns = [
    path("quiz/start/", views.QuizStartView.as_view(), name="quiz-start"),
    path("quiz/<int:session_id>/answer/", views.QuizAnswerView.as_view(), name="quiz-answer"),
    path("quiz/<int:session_id>/complete/", views.QuizCompleteView.as_view(), name="quiz-complete"),
    path("quiz/history/", views.QuizHistoryView.as_view(), name="quiz-history"),
]
