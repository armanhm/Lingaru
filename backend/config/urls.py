from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", include("apps.users.urls")),
    path("api/content/", include("apps.content.urls")),
    path("api/practice/", include("apps.practice.urls")),
    path("api/assistant/", include("apps.assistant.urls")),
    path("api/gamification/", include("apps.gamification.urls")),
    path("api/media/", include("apps.media.urls")),
    path("api/discover/", include("apps.discover.urls")),
    path("api/progress/", include("apps.progress.urls")),
    path("api/documents/", include("apps.documents.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
