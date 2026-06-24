from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import MyNoteAIActionView, MyNoteViewSet, PublicMyNoteView

router = DefaultRouter()
router.register(r"", MyNoteViewSet, basename="my-notes")

urlpatterns = [
    path("public/<int:pk>/", PublicMyNoteView.as_view(), name="my-notes-public"),
    path("<int:pk>/ai-action/", MyNoteAIActionView.as_view(), name="my-notes-ai-action"),
    path("", include(router.urls)),
]
