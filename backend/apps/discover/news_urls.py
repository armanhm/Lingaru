from django.urls import path

from . import views

app_name = "news"

urlpatterns = [
    path("",                        views.NewsListView.as_view(),     name="list"),
    path("generate/",               views.NewsGenerateView.as_view(), name="generate"),
    path("<int:pk>/",               views.NewsDetailView.as_view(),   name="detail"),
    path("<int:card_id>/interact/", views.InteractView.as_view(),     name="interact"),
]
