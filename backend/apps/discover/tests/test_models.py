import pytest
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.utils import timezone

from apps.discover.models import DiscoverCard, UserDiscoverHistory

User = get_user_model()


@pytest.mark.django_db
class TestDiscoverCard:
    def test_create_word_card(self):
        card = DiscoverCard.objects.create(
            type="word",
            title="Bonjour",
            summary="A common French greeting",
            content_json={
                "french": "bonjour",
                "english": "hello",
                "pronunciation": "/bo\u0303.\u0292u\u0281/",
                "example": "Bonjour, comment allez-vous?",
            },
        )
        assert card.pk is not None
        assert card.type == "word"
        assert card.content_json["french"] == "bonjour"

    def test_create_grammar_card(self):
        card = DiscoverCard.objects.create(
            type="grammar",
            title="Le pass\u00e9 compos\u00e9",
            summary="How to form the past tense",
            content_json={
                "explanation": "Use avoir/\u00eatre + past participle",
                "formula": "sujet + avoir/\u00eatre + participe pass\u00e9",
            },
        )
        assert card.type == "grammar"

    def test_create_trivia_card(self):
        card = DiscoverCard.objects.create(
            type="trivia",
            title="French in Africa",
            summary="French is spoken in 29 countries in Africa",
            content_json={"fact": "More people speak French in Africa than in Europe."},
        )
        assert card.type == "trivia"

    def test_create_news_card(self):
        card = DiscoverCard.objects.create(
            type="news",
            title="Les Jeux Olympiques 2028",
            summary="Les prochains JO auront lieu \u00e0 Los Angeles",
            content_json={
                "article_fr": "Les Jeux Olympiques de 2028...",
                "article_en": "The 2028 Olympic Games...",
                "key_vocabulary": ["jeux", "olympiques"],
            },
            source_url="https://www.france24.com/example",
        )
        assert card.source_url is not None

    def test_str_representation(self):
        card = DiscoverCard.objects.create(
            type="word", title="Bonjour", content_json={},
        )
        assert "[word] Bonjour" in str(card)

    def test_is_expired_false_when_no_expiry(self):
        card = DiscoverCard.objects.create(
            type="trivia", title="Fact", content_json={},
        )
        assert card.is_expired is False

    def test_is_expired_false_when_future(self):
        card = DiscoverCard.objects.create(
            type="trivia", title="Fact", content_json={},
            expires_at=timezone.now() + timedelta(days=1),
        )
        assert card.is_expired is False

    def test_is_expired_true_when_past(self):
        card = DiscoverCard.objects.create(
            type="trivia", title="Fact", content_json={},
            expires_at=timezone.now() - timedelta(hours=1),
        )
        assert card.is_expired is True

    def test_ordering_is_newest_first(self):
        c1 = DiscoverCard.objects.create(
            type="word", title="First", content_json={},
            generated_at=timezone.now() - timedelta(hours=2),
        )
        c2 = DiscoverCard.objects.create(
            type="word", title="Second", content_json={},
            generated_at=timezone.now() - timedelta(hours=1),
        )
        cards = list(DiscoverCard.objects.all())
        assert cards[0].pk == c2.pk
        assert cards[1].pk == c1.pk


@pytest.mark.django_db
class TestUserDiscoverHistory:
    @pytest.fixture
    def user(self):
        return User.objects.create_user(
            username="discover_user", password="testpass123",
        )

    @pytest.fixture
    def card(self):
        return DiscoverCard.objects.create(
            type="word", title="Bonjour", content_json={},
        )

    def test_create_history_entry(self, user, card):
        history = UserDiscoverHistory.objects.create(
            user=user, card=card,
        )
        assert history.pk is not None
        assert history.interacted is False
        assert history.seen_at is not None

    def test_mark_as_interacted(self, user, card):
        history = UserDiscoverHistory.objects.create(
            user=user, card=card,
        )
        history.interacted = True
        history.save()
        history.refresh_from_db()
        assert history.interacted is True

    def test_unique_user_card_constraint(self, user, card):
        UserDiscoverHistory.objects.create(user=user, card=card)
        with pytest.raises(IntegrityError):
            UserDiscoverHistory.objects.create(user=user, card=card)

    def test_str_representation(self, user, card):
        history = UserDiscoverHistory.objects.create(user=user, card=card)
        assert user.username in str(history)
        assert card.title in str(history)
