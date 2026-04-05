from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Custom user model for Lingaru. Extended in Task 2."""

    class Meta:
        db_table = "users"
