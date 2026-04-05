from django.urls import path
from . import views

app_name = "media"

urlpatterns = [
    path("tts/", views.TTSView.as_view(), name="tts"),
]
