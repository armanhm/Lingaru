from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import MyNoteViewSet, PublicMyNoteView

router = DefaultRouter()
router.register(r"", MyNoteViewSet, basename="my-notes")

urlpatterns = [
    path("public/<int:pk>/", PublicMyNoteView.as_view(), name="my-notes-public"),
    path("", include(router.urls)),
]
