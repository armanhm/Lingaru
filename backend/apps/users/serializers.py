from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("username", "email", "password", "password_confirm")

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        # New sign-ups are inactive by default. An admin must approve them
        # in Django admin (toggle `is_active`) before they can log in.
        # Superusers / accounts created via createsuperuser are already
        # active because that bypasses this serializer.
        user = User.objects.create_user(**validated_data)
        user.is_active = False
        user.save(update_fields=["is_active"])
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "telegram_id",
            "native_language",
            "target_level",
            "daily_goal_minutes",
            "preferences",
            "date_joined",
            "is_staff",
        )
        read_only_fields = ("id", "date_joined", "is_staff")
