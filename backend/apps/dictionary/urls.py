from django.urls import path
from . import views

app_name = "dictionary"

urlpatterns = [
    path("lookup/", views.DictionaryLookupView.as_view(), name="lookup"),
    path("conjugate/", views.VerbConjugatorView.as_view(), name="conjugate"),
]
