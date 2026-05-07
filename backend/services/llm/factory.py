from django.conf import settings

from .gemini import GeminiProvider
from .groq_provider import GroqProvider
from .router import ProviderRouter


def create_llm_router() -> ProviderRouter:
    """Create a ProviderRouter from Django settings.

    Uses Gemini as primary and Groq as fallback.
    If only one API key is configured, that provider is used alone.
    """
    primary = None
    fallback = None

    if settings.GEMINI_API_KEY:
        primary = GeminiProvider(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_MODEL,
        )

    if settings.GROQ_API_KEY:
        fallback = GroqProvider(
            api_key=settings.GROQ_API_KEY,
            model=settings.GROQ_MODEL,
        )

    # If no Gemini key, promote Groq to primary
    if primary is None and fallback is not None:
        primary = fallback
        fallback = None

    if primary is None:
        raise RuntimeError("No LLM API keys configured. Set GEMINI_API_KEY or GROQ_API_KEY.")

    return ProviderRouter(primary=primary, fallback=fallback)
