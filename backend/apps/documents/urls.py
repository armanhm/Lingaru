from django.urls import path
from . import views

app_name = "documents"

urlpatterns = [
    path("upload/", views.DocumentUploadView.as_view(), name="upload"),
    path("", views.DocumentListView.as_view(), name="list"),
    path("<int:pk>/", views.DocumentDeleteView.as_view(), name="delete"),
    path(
        "<int:document_id>/chunks/",
        views.DocumentChunkListView.as_view(),
        name="chunk-list",
    ),
]
