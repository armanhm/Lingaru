from django.urls import path
from . import views

app_name = "assistant"

urlpatterns = [
    path("chat/", views.ChatView.as_view(), name="chat"),
    path("image-query/", views.ImageQueryView.as_view(), name="image-query"),
    path("conversations/", views.ConversationListView.as_view(), name="conversation-list"),
    path("conversations/<int:pk>/", views.ConversationDetailView.as_view(), name="conversation-detail"),
]
