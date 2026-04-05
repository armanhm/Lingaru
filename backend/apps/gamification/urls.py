from django.urls import path

from . import views

app_name = "gamification"

urlpatterns = [
    path("stats/", views.StatsView.as_view(), name="stats"),
    path("badges/", views.BadgesView.as_view(), name="badges"),
    path("leaderboard/", views.LeaderboardView.as_view(), name="leaderboard"),
    path("history/", views.HistoryView.as_view(), name="history"),
]
