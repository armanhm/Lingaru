from django.contrib.auth import get_user_model
from rest_framework import exceptions, generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import RegisterSerializer, UserSerializer

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        # Account is created inactive — admin must approve via Django admin
        # before login is allowed. Don't return tokens or full user fields:
        # the frontend should display a "pending approval" message instead
        # of acting as if the user is signed in.
        return Response(
            {
                "status": "pending_approval",
                "detail": (
                    "Your account has been created and is awaiting admin "
                    "approval. You'll be able to log in once an administrator "
                    "activates it."
                ),
                "username": user.username,
                "email": user.email,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class ApprovalAwareTokenObtainPairSerializer(TokenObtainPairSerializer):
    """SimpleJWT login that returns a friendlier error message when the user
    exists and the password is correct but the account is awaiting admin
    approval (is_active=False). Falls back to default behaviour for every
    other auth-failure case."""

    def validate(self, attrs):
        username_field = self.username_field
        username = attrs.get(username_field)
        password = attrs.get("password", "")
        if username:
            try:
                user = User.objects.get(**{username_field: username})
            except User.DoesNotExist:
                user = None
            if user is not None and not user.is_active and user.check_password(password):
                raise exceptions.AuthenticationFailed(
                    "Your account is awaiting admin approval. "
                    "Try again once an administrator has activated it.",
                    code="pending_approval",
                )
        return super().validate(attrs)


class ApprovalAwareTokenObtainPairView(TokenObtainPairView):
    serializer_class = ApprovalAwareTokenObtainPairSerializer


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.UpdateAPIView):
    permission_classes = (permissions.IsAuthenticated,)

    def update(self, request, *args, **kwargs):
        user = request.user
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")

        if not user.check_password(old_password):
            return Response({"old_password": "Wrong password."}, status=400)

        if len(new_password or "") < 8:
            return Response(
                {"new_password": "Password must be at least 8 characters."},
                status=400,
            )

        user.set_password(new_password)
        user.save()
        return Response({"detail": "Password updated successfully."})
