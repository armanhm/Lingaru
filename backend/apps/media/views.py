from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from services.tts.service import get_or_create_audio
from .serializers import TTSRequestSerializer, AudioClipSerializer


class TTSView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = TTSRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        text = serializer.validated_data["text"]
        language = serializer.validated_data.get("language", "fr")

        clip = get_or_create_audio(text=text, language=language)

        return Response(
            AudioClipSerializer(clip, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )
