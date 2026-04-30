from django.urls import path

from . import views

app_name = "agents"

urlpatterns = [
    path("",                  views.AgentListView.as_view(),     name="list"),
    path("<slug:slug>/",      views.AgentDetailView.as_view(),   name="detail"),
    path("<slug:slug>/start/", views.AgentStartRunView.as_view(), name="start"),
    path("<slug:slug>/runs/",  views.AgentRunsView.as_view(),     name="runs"),
]
