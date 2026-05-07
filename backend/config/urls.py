from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    """Liveness + readiness probe. Returns 200 if Django can reach the DB,
    503 otherwise. Used by GitHub Actions post-deploy smoke test and any
    future uptime monitoring (UptimeRobot, BetterUptime, etc.)."""
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        return JsonResponse({"status": "ok", "db": "ok"})
    except Exception as exc:
        return JsonResponse(
            {"status": "error", "db": str(exc)[:200]},
            status=503,
        )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/users/", include("apps.users.urls")),
    path("api/content/", include("apps.content.urls")),
    path("api/practice/", include("apps.practice.urls")),
    path("api/assistant/", include("apps.assistant.urls")),
    path("api/gamification/", include("apps.gamification.urls")),
    path("api/media/", include("apps.media.urls")),
    path("api/discover/", include("apps.discover.urls")),
    path("api/news/", include("apps.discover.news_urls")),
    path("api/progress/", include("apps.progress.urls")),
    path("api/documents/", include("apps.documents.urls")),
    path("api/dictionary/", include("apps.dictionary.urls")),
    path("api/exam-prep/", include("apps.exam_prep.urls")),
    path("api/grammar/", include("apps.grammar.urls")),
    path("api/agents/", include("apps.agents.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
