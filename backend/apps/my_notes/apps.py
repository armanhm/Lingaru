from django.apps import AppConfig


class MyNotesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.my_notes"
    label = "my_notes"
    verbose_name = "My Notes"
