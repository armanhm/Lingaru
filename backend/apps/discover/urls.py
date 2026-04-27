from django.urls import path

from . import views

app_name = "discover"

urlpatterns = [
    path("feed/", views.FeedView.as_view(), name="feed"),
    path("generate-more/", views.GenerateMoreView.as_view(), name="generate-more"),
    path(
        "cards/<int:card_id>/interact/",
        views.InteractView.as_view(),
        name="interact",
    ),
]

