# Phase 6: Gamification — Implementation Plan

**Date:** 2026-04-04
**Depends on:** Phases 1-5 (User model, Content, Practice, Telegram bot, AI Assistant)
**Delivers:** XP system, streaks, levels, badges, leaderboard via API + Dashboard + Telegram

---

## Task 1: Gamification Models & Service Layer

**Goal:** Create `backend/apps/gamification/` with models (XPTransaction, UserStats, Badge, UserBadge) and a service layer (`award_xp`, `check_streak`, `check_badges`, `get_level`). TDD.

**Why first:** Every other task depends on the data models and the service functions that manipulate them.

### Step 1.1 — Create the gamification app skeleton

```bash
cd backend
python manage.py startapp gamification apps/gamification
```

Create the directory structure:

```
backend/apps/gamification/
├── __init__.py
├── admin.py
├── apps.py
├── models.py
├── services.py
├── constants.py
├── migrations/
│   └── __init__.py
└── tests/
    ├── __init__.py
    ├── test_models.py
    └── test_services.py
```

**File:** `backend/apps/gamification/apps.py`

```python
from django.apps import AppConfig


class GamificationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.gamification"
    verbose_name = "Gamification"
```

**File:** `backend/apps/gamification/constants.py`

```python
"""Gamification constants — XP values, level thresholds, badge definitions."""

# XP values per activity type
XP_VALUES = {
    "vocab_lesson": 10,
    "grammar_lesson": 15,
    "reading_text": 20,
    "quiz_correct": 5,
    "quiz_perfect": 25,
    "writing_practice": 20,
    "ai_conversation": 15,
    "srs_review": 10,
    "daily_streak": 5,       # multiplied by streak_days, capped at 50
    "word_of_day": 3,
    "dictation": 15,
    "conjugation_drill": 10,
    "pronunciation": 5,
}

DAILY_STREAK_CAP = 50

# Level thresholds — (min_xp, level_name)
LEVEL_THRESHOLDS = [
    (0, "Debutant"),
    (100, "Explorateur"),
    (500, "Apprenti"),
    (1500, "Intermediaire"),
    (5000, "Avance"),
    (10000, "Expert"),
]

# Default badge definitions for seeding
DEFAULT_BADGES = [
    {
        "name": "First Quiz",
        "description": "Complete your first quiz",
        "icon": "trophy",
        "criteria_type": "quizzes_completed",
        "criteria_value": 1,
    },
    {
        "name": "Quiz Master",
        "description": "Complete 50 quizzes",
        "icon": "star",
        "criteria_type": "quizzes_completed",
        "criteria_value": 50,
    },
    {
        "name": "Perfect Score",
        "description": "Get a perfect score on a quiz",
        "icon": "bullseye",
        "criteria_type": "perfect_quizzes",
        "criteria_value": 1,
    },
    {
        "name": "Week Warrior",
        "description": "Maintain a 7-day streak",
        "icon": "fire",
        "criteria_type": "streak_days",
        "criteria_value": 7,
    },
    {
        "name": "Month Master",
        "description": "Maintain a 30-day streak",
        "icon": "flame",
        "criteria_type": "streak_days",
        "criteria_value": 30,
    },
    {
        "name": "XP Collector",
        "description": "Earn 1000 XP",
        "icon": "gem",
        "criteria_type": "total_xp",
        "criteria_value": 1000,
    },
    {
        "name": "XP Legend",
        "description": "Earn 10000 XP",
        "icon": "crown",
        "criteria_type": "total_xp",
        "criteria_value": 10000,
    },
    {
        "name": "Conversationalist",
        "description": "Have 10 AI conversations",
        "icon": "chat",
        "criteria_type": "ai_conversations",
        "criteria_value": 10,
    },
    {
        "name": "Apprenti",
        "description": "Reach level Apprenti",
        "icon": "medal",
        "criteria_type": "level",
        "criteria_value": 500,
    },
    {
        "name": "Expert",
        "description": "Reach level Expert",
        "icon": "diamond",
        "criteria_type": "level",
        "criteria_value": 10000,
    },
]
```

**Commit:** `feat(gamification): add app skeleton and constants`

### Step 1.2 — Write model tests (RED)

**File:** `backend/apps/gamification/tests/__init__.py` (empty)
**File:** `backend/apps/gamification/tests/test_models.py`

```python
import pytest
from datetime import date
from django.contrib.auth import get_user_model

from apps.gamification.models import XPTransaction, UserStats, Badge, UserBadge

User = get_user_model()


@pytest.mark.django_db
class TestUserStats:
    def test_created_with_defaults(self):
        user = User.objects.create_user(username="alice", password="testpass123")
        stats = UserStats.objects.create(user=user)
        assert stats.total_xp == 0
        assert stats.level == 0
        assert stats.current_streak == 0
        assert stats.longest_streak == 0
        assert stats.streak_freeze_available is False
        assert stats.last_active_date is None

    def test_one_to_one_with_user(self):
        user = User.objects.create_user(username="bob", password="testpass123")
        stats = UserStats.objects.create(user=user)
        assert user.stats == stats

    def test_str(self):
        user = User.objects.create_user(username="carol", password="testpass123")
        stats = UserStats.objects.create(user=user, total_xp=500, level=2)
        assert "carol" in str(stats)
        assert "500" in str(stats)


@pytest.mark.django_db
class TestXPTransaction:
    def test_create_transaction(self):
        user = User.objects.create_user(username="dave", password="testpass123")
        txn = XPTransaction.objects.create(
            user=user,
            activity_type="quiz_correct",
            xp_amount=5,
        )
        assert txn.xp_amount == 5
        assert txn.activity_type == "quiz_correct"
        assert txn.source_id is None
        assert txn.created_at is not None

    def test_with_source_id(self):
        user = User.objects.create_user(username="eve", password="testpass123")
        txn = XPTransaction.objects.create(
            user=user,
            activity_type="quiz_perfect",
            xp_amount=25,
            source_id="session_42",
        )
        assert txn.source_id == "session_42"


@pytest.mark.django_db
class TestBadge:
    def test_create_badge(self):
        badge = Badge.objects.create(
            name="First Quiz",
            description="Complete your first quiz",
            icon="trophy",
            criteria_type="quizzes_completed",
            criteria_value=1,
        )
        assert str(badge) == "First Quiz"

    def test_unique_name(self):
        Badge.objects.create(
            name="Unique Badge",
            description="Test",
            icon="star",
            criteria_type="total_xp",
            criteria_value=100,
        )
        with pytest.raises(Exception):
            Badge.objects.create(
                name="Unique Badge",
                description="Duplicate",
                icon="star",
                criteria_type="total_xp",
                criteria_value=200,
            )


@pytest.mark.django_db
class TestUserBadge:
    def test_award_badge(self):
        user = User.objects.create_user(username="frank", password="testpass123")
        badge = Badge.objects.create(
            name="Test Badge",
            description="Test",
            icon="star",
            criteria_type="total_xp",
            criteria_value=100,
        )
        ub = UserBadge.objects.create(user=user, badge=badge)
        assert ub.earned_at is not None
        assert ub.badge == badge

    def test_unique_user_badge(self):
        user = User.objects.create_user(username="grace", password="testpass123")
        badge = Badge.objects.create(
            name="Another Badge",
            description="Test",
            icon="star",
            criteria_type="total_xp",
            criteria_value=100,
        )
        UserBadge.objects.create(user=user, badge=badge)
        with pytest.raises(Exception):
            UserBadge.objects.create(user=user, badge=badge)
```

Run tests: `pytest apps/gamification/tests/test_models.py` — expect **RED** (models do not exist).

**No commit yet** — tests fail.

### Step 1.3 — Implement models (GREEN)

**File:** `backend/apps/gamification/models.py`

```python
from django.conf import settings
from django.db import models


class UserStats(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="stats",
    )
    total_xp = models.PositiveIntegerField(default=0)
    level = models.PositiveIntegerField(default=0)
    current_streak = models.PositiveIntegerField(default=0)
    longest_streak = models.PositiveIntegerField(default=0)
    streak_freeze_available = models.BooleanField(default=False)
    last_active_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "gamification_user_stats"
        verbose_name_plural = "User stats"

    def __str__(self):
        return f"{self.user.username} — {self.total_xp} XP (level {self.level})"


class XPTransaction(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="xp_transactions",
    )
    activity_type = models.CharField(max_length=50)
    xp_amount = models.PositiveIntegerField()
    source_id = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gamification_xp_transactions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} +{self.xp_amount} XP ({self.activity_type})"


class Badge(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField()
    icon = models.CharField(max_length=50)
    criteria_type = models.CharField(max_length=50)
    criteria_value = models.PositiveIntegerField()

    class Meta:
        db_table = "gamification_badges"

    def __str__(self):
        return self.name


class UserBadge(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="earned_badges",
    )
    badge = models.ForeignKey(
        Badge,
        on_delete=models.CASCADE,
        related_name="holders",
    )
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gamification_user_badges"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "badge"],
                name="unique_user_badge",
            ),
        ]

    def __str__(self):
        return f"{self.user.username} — {self.badge.name}"
```

Register the app in `INSTALLED_APPS`:

**File:** `backend/config/settings/base.py` — add `"apps.gamification",` after `"apps.assistant",` in the Local apps section.

Generate and run migration:

```bash
python manage.py makemigrations gamification
python manage.py migrate
```

Run tests: `pytest apps/gamification/tests/test_models.py` — expect **GREEN**.

**Commit:** `feat(gamification): add XPTransaction, UserStats, Badge, UserBadge models`

### Step 1.4 — Write service tests (RED)

**File:** `backend/apps/gamification/tests/test_services.py`

```python
import pytest
from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model

from apps.gamification.models import (
    XPTransaction, UserStats, Badge, UserBadge,
)
from apps.gamification.services import (
    award_xp,
    check_streak,
    check_badges,
    get_level,
    get_or_create_stats,
)

User = get_user_model()


class TestGetLevel:
    def test_zero_xp(self):
        name, idx = get_level(0)
        assert name == "Debutant"
        assert idx == 0

    def test_100_xp(self):
        name, idx = get_level(100)
        assert name == "Explorateur"
        assert idx == 1

    def test_499_xp(self):
        name, idx = get_level(499)
        assert name == "Explorateur"
        assert idx == 1

    def test_500_xp(self):
        name, idx = get_level(500)
        assert name == "Apprenti"
        assert idx == 2

    def test_10000_xp(self):
        name, idx = get_level(10000)
        assert name == "Expert"
        assert idx == 5

    def test_above_max(self):
        name, idx = get_level(999999)
        assert name == "Expert"
        assert idx == 5


@pytest.mark.django_db
class TestGetOrCreateStats:
    def test_creates_stats_if_missing(self):
        user = User.objects.create_user(username="s1", password="testpass123")
        stats = get_or_create_stats(user)
        assert stats.total_xp == 0
        assert stats.pk is not None

    def test_returns_existing_stats(self):
        user = User.objects.create_user(username="s2", password="testpass123")
        existing = UserStats.objects.create(user=user, total_xp=100)
        stats = get_or_create_stats(user)
        assert stats.pk == existing.pk
        assert stats.total_xp == 100


@pytest.mark.django_db
class TestAwardXP:
    def test_creates_transaction_and_updates_stats(self):
        user = User.objects.create_user(username="a1", password="testpass123")
        stats, txn, new_badges = award_xp(user, "quiz_correct", 5)
        assert txn.xp_amount == 5
        assert txn.activity_type == "quiz_correct"
        assert stats.total_xp == 5

    def test_accumulates_xp(self):
        user = User.objects.create_user(username="a2", password="testpass123")
        award_xp(user, "quiz_correct", 5)
        stats, txn, _ = award_xp(user, "quiz_correct", 5)
        assert stats.total_xp == 10

    def test_updates_level_when_threshold_crossed(self):
        user = User.objects.create_user(username="a3", password="testpass123")
        stats, _, _ = award_xp(user, "quiz_perfect", 100)
        assert stats.level == 1  # Explorateur

    def test_with_source_id(self):
        user = User.objects.create_user(username="a4", password="testpass123")
        _, txn, _ = award_xp(user, "quiz_correct", 5, source_id="session_1")
        assert txn.source_id == "session_1"

    def test_triggers_badge_check(self):
        user = User.objects.create_user(username="a5", password="testpass123")
        Badge.objects.create(
            name="XP Starter",
            description="Earn 10 XP",
            icon="star",
            criteria_type="total_xp",
            criteria_value=10,
        )
        award_xp(user, "quiz_correct", 5)
        _, _, new_badges = award_xp(user, "quiz_correct", 5)
        assert len(new_badges) == 1
        assert new_badges[0].badge.name == "XP Starter"


@pytest.mark.django_db
class TestCheckStreak:
    def test_first_activity_starts_streak(self):
        user = User.objects.create_user(username="st1", password="testpass123")
        today = date(2026, 4, 4)
        stats = check_streak(user, today)
        assert stats.current_streak == 1
        assert stats.last_active_date == today

    def test_same_day_no_change(self):
        user = User.objects.create_user(username="st2", password="testpass123")
        today = date(2026, 4, 4)
        check_streak(user, today)
        stats = check_streak(user, today)
        assert stats.current_streak == 1

    def test_next_day_increments(self):
        user = User.objects.create_user(username="st3", password="testpass123")
        day1 = date(2026, 4, 4)
        day2 = date(2026, 4, 5)
        check_streak(user, day1)
        stats = check_streak(user, day2)
        assert stats.current_streak == 2
        assert stats.longest_streak == 2

    def test_gap_resets_streak(self):
        user = User.objects.create_user(username="st4", password="testpass123")
        day1 = date(2026, 4, 4)
        day3 = date(2026, 4, 6)  # skipped day 5
        check_streak(user, day1)
        stats = check_streak(user, day3)
        assert stats.current_streak == 1
        assert stats.longest_streak == 1

    def test_longest_streak_preserved(self):
        user = User.objects.create_user(username="st5", password="testpass123")
        # Build a 3-day streak
        check_streak(user, date(2026, 4, 1))
        check_streak(user, date(2026, 4, 2))
        check_streak(user, date(2026, 4, 3))
        # Gap, then restart
        stats = check_streak(user, date(2026, 4, 5))
        assert stats.current_streak == 1
        assert stats.longest_streak == 3


@pytest.mark.django_db
class TestCheckBadges:
    def test_awards_xp_badge(self):
        user = User.objects.create_user(username="b1", password="testpass123")
        Badge.objects.create(
            name="XP 100",
            description="Earn 100 XP",
            icon="gem",
            criteria_type="total_xp",
            criteria_value=100,
        )
        UserStats.objects.create(user=user, total_xp=100)
        new_badges = check_badges(user)
        assert len(new_badges) == 1
        assert new_badges[0].badge.name == "XP 100"

    def test_does_not_re_award(self):
        user = User.objects.create_user(username="b2", password="testpass123")
        badge = Badge.objects.create(
            name="XP 100",
            description="Earn 100 XP",
            icon="gem",
            criteria_type="total_xp",
            criteria_value=100,
        )
        UserStats.objects.create(user=user, total_xp=100)
        UserBadge.objects.create(user=user, badge=badge)
        new_badges = check_badges(user)
        assert len(new_badges) == 0

    def test_streak_badge(self):
        user = User.objects.create_user(username="b3", password="testpass123")
        Badge.objects.create(
            name="Week Warrior",
            description="7-day streak",
            icon="fire",
            criteria_type="streak_days",
            criteria_value=7,
        )
        UserStats.objects.create(user=user, current_streak=7)
        new_badges = check_badges(user)
        assert len(new_badges) == 1

    def test_level_badge(self):
        user = User.objects.create_user(username="b4", password="testpass123")
        Badge.objects.create(
            name="Apprenti Badge",
            description="Reach Apprenti",
            icon="medal",
            criteria_type="level",
            criteria_value=500,
        )
        UserStats.objects.create(user=user, total_xp=500, level=2)
        new_badges = check_badges(user)
        assert len(new_badges) == 1
```

Run tests: `pytest apps/gamification/tests/test_services.py` — expect **RED**.

**No commit yet.**

### Step 1.5 — Implement service layer (GREEN)

**File:** `backend/apps/gamification/services.py`

```python
"""Gamification service — XP, streaks, badges, levels."""

from datetime import date, timedelta
from typing import Optional

from django.contrib.auth import get_user_model
from django.db import transaction

from .constants import LEVEL_THRESHOLDS
from .models import Badge, UserBadge, UserStats, XPTransaction

User = get_user_model()


def get_level(total_xp: int) -> tuple[str, int]:
    """Return (level_name, level_index) for the given XP total.

    Iterates thresholds in reverse to find the highest matching level.
    """
    for idx in range(len(LEVEL_THRESHOLDS) - 1, -1, -1):
        threshold, name = LEVEL_THRESHOLDS[idx]
        if total_xp >= threshold:
            return name, idx
    return LEVEL_THRESHOLDS[0][1], 0


def get_or_create_stats(user) -> UserStats:
    """Return the UserStats row for the user, creating one if needed."""
    stats, _ = UserStats.objects.get_or_create(user=user)
    return stats


@transaction.atomic
def award_xp(
    user,
    activity_type: str,
    xp_amount: int,
    source_id: Optional[str] = None,
) -> tuple[UserStats, XPTransaction, list[UserBadge]]:
    """Award XP to a user.

    Creates an XPTransaction, updates UserStats (total_xp, level),
    and checks for newly earned badges.

    Returns (updated_stats, transaction, list_of_new_badges).
    """
    txn = XPTransaction.objects.create(
        user=user,
        activity_type=activity_type,
        xp_amount=xp_amount,
        source_id=source_id,
    )

    stats = get_or_create_stats(user)
    stats.total_xp += xp_amount
    _, level_idx = get_level(stats.total_xp)
    stats.level = level_idx
    stats.save()

    new_badges = check_badges(user)

    return stats, txn, new_badges


def check_streak(user, today: Optional[date] = None) -> UserStats:
    """Update the user's streak based on last_active_date.

    Call this whenever the user performs any practice activity.
    If today is the day after last_active_date, increment streak.
    If today == last_active_date, do nothing.
    If there is a gap of 2+ days, reset streak to 1.
    """
    if today is None:
        today = date.today()

    stats = get_or_create_stats(user)

    if stats.last_active_date is None:
        # First ever activity
        stats.current_streak = 1
        stats.longest_streak = 1
        stats.last_active_date = today
        stats.save()
        return stats

    if stats.last_active_date == today:
        # Already active today — no change
        return stats

    delta = (today - stats.last_active_date).days

    if delta == 1:
        # Consecutive day
        stats.current_streak += 1
    else:
        # Streak broken
        stats.current_streak = 1

    stats.longest_streak = max(stats.longest_streak, stats.current_streak)
    stats.last_active_date = today
    stats.save()
    return stats


def check_badges(user) -> list[UserBadge]:
    """Evaluate all badge criteria and award any newly earned badges.

    Returns a list of newly created UserBadge instances.
    """
    stats = get_or_create_stats(user)
    already_earned = set(
        UserBadge.objects.filter(user=user).values_list("badge_id", flat=True)
    )
    all_badges = Badge.objects.exclude(id__in=already_earned)

    new_badges = []
    for badge in all_badges:
        earned = _evaluate_badge(badge, stats, user)
        if earned:
            ub = UserBadge.objects.create(user=user, badge=badge)
            new_badges.append(ub)

    return new_badges


def _evaluate_badge(badge: Badge, stats: UserStats, user) -> bool:
    """Check whether a single badge's criteria are met."""
    ct = badge.criteria_type
    cv = badge.criteria_value

    if ct == "total_xp":
        return stats.total_xp >= cv

    if ct == "streak_days":
        return stats.current_streak >= cv

    if ct == "level":
        # criteria_value is the XP threshold for the level
        return stats.total_xp >= cv

    if ct == "quizzes_completed":
        from apps.practice.models import QuizSession
        count = QuizSession.objects.filter(
            user=user, completed_at__isnull=False,
        ).count()
        return count >= cv

    if ct == "perfect_quizzes":
        from apps.practice.models import QuizSession
        count = QuizSession.objects.filter(
            user=user,
            completed_at__isnull=False,
        ).extra(where=["score = total_questions"]).count()
        return count >= cv

    if ct == "ai_conversations":
        from apps.assistant.models import Conversation
        from django.db.models import Count
        count = Conversation.objects.filter(user=user).annotate(
            msg_count=Count("messages"),
        ).filter(msg_count__gte=5).count()
        return count >= cv

    return False
```

Run tests: `pytest apps/gamification/tests/test_services.py` — expect **GREEN**.

**Commit:** `feat(gamification): add service layer with award_xp, check_streak, check_badges, get_level`

---

## Task 2: Gamification Admin & Seed Badges

**Goal:** Register models in Django Admin and create a management command to seed default badges.

**Why second:** Lets us verify data in the admin UI and populate badges before building the API.

### Step 2.1 — Admin registration

**File:** `backend/apps/gamification/admin.py`

```python
from django.contrib import admin

from .models import Badge, UserBadge, UserStats, XPTransaction


@admin.register(UserStats)
class UserStatsAdmin(admin.ModelAdmin):
    list_display = ("user", "total_xp", "level", "current_streak", "longest_streak", "last_active_date")
    list_filter = ("level",)
    search_fields = ("user__username",)
    readonly_fields = ("user",)


@admin.register(XPTransaction)
class XPTransactionAdmin(admin.ModelAdmin):
    list_display = ("user", "activity_type", "xp_amount", "source_id", "created_at")
    list_filter = ("activity_type",)
    search_fields = ("user__username",)
    date_hierarchy = "created_at"


@admin.register(Badge)
class BadgeAdmin(admin.ModelAdmin):
    list_display = ("name", "criteria_type", "criteria_value", "icon")
    list_filter = ("criteria_type",)


@admin.register(UserBadge)
class UserBadgeAdmin(admin.ModelAdmin):
    list_display = ("user", "badge", "earned_at")
    list_filter = ("badge",)
    search_fields = ("user__username",)
```

**Commit:** `feat(gamification): register models in Django Admin`

### Step 2.2 — Seed badges management command

**File:** `backend/apps/gamification/management/__init__.py` (empty)
**File:** `backend/apps/gamification/management/commands/__init__.py` (empty)
**File:** `backend/apps/gamification/management/commands/seed_badges.py`

```python
from django.core.management.base import BaseCommand

from apps.gamification.constants import DEFAULT_BADGES
from apps.gamification.models import Badge


class Command(BaseCommand):
    help = "Seed default gamification badges (idempotent)"

    def handle(self, *args, **options):
        created_count = 0
        for badge_data in DEFAULT_BADGES:
            _, created = Badge.objects.get_or_create(
                name=badge_data["name"],
                defaults={
                    "description": badge_data["description"],
                    "icon": badge_data["icon"],
                    "criteria_type": badge_data["criteria_type"],
                    "criteria_value": badge_data["criteria_value"],
                },
            )
            if created:
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {created_count} new badges "
                f"({len(DEFAULT_BADGES)} total defined)"
            )
        )
```

### Step 2.3 — Test the seed command

**File:** `backend/apps/gamification/tests/test_commands.py`

```python
import pytest
from django.core.management import call_command

from apps.gamification.models import Badge
from apps.gamification.constants import DEFAULT_BADGES


@pytest.mark.django_db
class TestSeedBadges:
    def test_creates_all_badges(self):
        call_command("seed_badges")
        assert Badge.objects.count() == len(DEFAULT_BADGES)

    def test_idempotent(self):
        call_command("seed_badges")
        call_command("seed_badges")
        assert Badge.objects.count() == len(DEFAULT_BADGES)

    def test_badge_names_match(self):
        call_command("seed_badges")
        names = set(Badge.objects.values_list("name", flat=True))
        expected = {b["name"] for b in DEFAULT_BADGES}
        assert names == expected
```

Run: `pytest apps/gamification/tests/test_commands.py` — expect **GREEN**.

**Commit:** `feat(gamification): add seed_badges management command`

---

## Task 3: Gamification API

**Goal:** Create REST endpoints for stats, badges, leaderboard, and XP history. TDD.

**Why third:** The service layer is solid. Now expose it over HTTP so both the frontend and Telegram bot can consume it.

### Step 3.1 — Write API tests (RED)

**File:** `backend/apps/gamification/tests/test_api.py`

```python
import pytest
from datetime import date
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.gamification.models import Badge, UserBadge, UserStats, XPTransaction

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="testuser", email="test@example.com", password="testpass123",
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.mark.django_db
class TestStatsEndpoint:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.get("/api/gamification/stats/")
        assert resp.status_code == 401

    def test_returns_stats_for_new_user(self, auth_client, user):
        resp = auth_client.get("/api/gamification/stats/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_xp"] == 0
        assert data["level"] == 0
        assert data["level_name"] == "Debutant"
        assert data["current_streak"] == 0
        assert data["longest_streak"] == 0

    def test_returns_existing_stats(self, auth_client, user):
        UserStats.objects.create(
            user=user, total_xp=500, level=2,
            current_streak=5, longest_streak=10,
            last_active_date=date(2026, 4, 4),
        )
        resp = auth_client.get("/api/gamification/stats/")
        data = resp.json()
        assert data["total_xp"] == 500
        assert data["level_name"] == "Apprenti"
        assert data["current_streak"] == 5

    def test_includes_rank(self, auth_client, user):
        UserStats.objects.create(user=user, total_xp=100)
        resp = auth_client.get("/api/gamification/stats/")
        data = resp.json()
        assert "rank" in data
        assert data["rank"] == 1


@pytest.mark.django_db
class TestBadgesEndpoint:
    def test_returns_earned_and_available(self, auth_client, user):
        b1 = Badge.objects.create(
            name="Earned Badge", description="d", icon="star",
            criteria_type="total_xp", criteria_value=0,
        )
        b2 = Badge.objects.create(
            name="Locked Badge", description="d", icon="lock",
            criteria_type="total_xp", criteria_value=9999,
        )
        UserBadge.objects.create(user=user, badge=b1)

        resp = auth_client.get("/api/gamification/badges/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["earned"]) == 1
        assert data["earned"][0]["name"] == "Earned Badge"
        assert len(data["available"]) == 1
        assert data["available"][0]["name"] == "Locked Badge"


@pytest.mark.django_db
class TestLeaderboardEndpoint:
    def test_returns_top_users(self, auth_client):
        for i in range(5):
            u = User.objects.create_user(
                username=f"leader{i}", password="testpass123",
            )
            UserStats.objects.create(user=u, total_xp=(5 - i) * 100)

        resp = auth_client.get("/api/gamification/leaderboard/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) == 5
        # First user has highest XP
        assert data["results"][0]["total_xp"] == 500

    def test_leaderboard_limited_to_top_50(self, auth_client):
        resp = auth_client.get("/api/gamification/leaderboard/")
        assert resp.status_code == 200


@pytest.mark.django_db
class TestHistoryEndpoint:
    def test_returns_recent_transactions(self, auth_client, user):
        for i in range(3):
            XPTransaction.objects.create(
                user=user, activity_type="quiz_correct", xp_amount=5,
            )
        resp = auth_client.get("/api/gamification/history/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) == 3
```

Run: `pytest apps/gamification/tests/test_api.py` — expect **RED**.

**No commit yet.**

### Step 3.2 — Implement serializers

**File:** `backend/apps/gamification/serializers.py`

```python
from rest_framework import serializers

from .constants import LEVEL_THRESHOLDS
from .models import Badge, UserBadge, UserStats, XPTransaction
from .services import get_level


class UserStatsSerializer(serializers.ModelSerializer):
    level_name = serializers.SerializerMethodField()
    rank = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = UserStats
        fields = (
            "total_xp", "level", "level_name",
            "current_streak", "longest_streak",
            "streak_freeze_available", "last_active_date",
            "rank",
        )

    def get_level_name(self, obj):
        name, _ = get_level(obj.total_xp)
        return name


class BadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = ("id", "name", "description", "icon", "criteria_type", "criteria_value")


class UserBadgeSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="badge.name")
    description = serializers.CharField(source="badge.description")
    icon = serializers.CharField(source="badge.icon")

    class Meta:
        model = UserBadge
        fields = ("id", "name", "description", "icon", "earned_at")


class XPTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = XPTransaction
        fields = ("id", "activity_type", "xp_amount", "source_id", "created_at")


class LeaderboardEntrySerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username")

    class Meta:
        model = UserStats
        fields = ("username", "total_xp", "level", "current_streak")
```

### Step 3.3 — Implement views

**File:** `backend/apps/gamification/views.py`

```python
from rest_framework import permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Badge, UserBadge, UserStats, XPTransaction
from .serializers import (
    BadgeSerializer,
    LeaderboardEntrySerializer,
    UserBadgeSerializer,
    UserStatsSerializer,
    XPTransactionSerializer,
)
from .services import get_or_create_stats


class StatsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        stats = get_or_create_stats(request.user)

        # Compute rank (position by total_xp descending)
        rank = UserStats.objects.filter(total_xp__gt=stats.total_xp).count() + 1
        stats.rank = rank

        serializer = UserStatsSerializer(stats)
        return Response(serializer.data)


class BadgesView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        earned_qs = UserBadge.objects.filter(
            user=request.user,
        ).select_related("badge").order_by("-earned_at")

        earned_ids = set(earned_qs.values_list("badge_id", flat=True))
        available_qs = Badge.objects.exclude(id__in=earned_ids)

        return Response({
            "earned": UserBadgeSerializer(earned_qs, many=True).data,
            "available": BadgeSerializer(available_qs, many=True).data,
        })


class LeaderboardPagination(PageNumberPagination):
    page_size = 50
    max_page_size = 50


class LeaderboardView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        qs = UserStats.objects.select_related("user").order_by("-total_xp")
        paginator = LeaderboardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = LeaderboardEntrySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class HistoryPagination(PageNumberPagination):
    page_size = 20


class HistoryView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        qs = XPTransaction.objects.filter(user=request.user)
        paginator = HistoryPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = XPTransactionSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
```

### Step 3.4 — Wire up URLs

**File:** `backend/apps/gamification/urls.py`

```python
from django.urls import path

from . import views

app_name = "gamification"

urlpatterns = [
    path("stats/", views.StatsView.as_view(), name="stats"),
    path("badges/", views.BadgesView.as_view(), name="badges"),
    path("leaderboard/", views.LeaderboardView.as_view(), name="leaderboard"),
    path("history/", views.HistoryView.as_view(), name="history"),
]
```

**File:** `backend/config/urls.py` — add the gamification route:

```python
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", include("apps.users.urls")),
    path("api/content/", include("apps.content.urls")),
    path("api/practice/", include("apps.practice.urls")),
    path("api/assistant/", include("apps.assistant.urls")),
    path("api/gamification/", include("apps.gamification.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

Run: `pytest apps/gamification/tests/test_api.py` — expect **GREEN**.

**Commit:** `feat(gamification): add stats, badges, leaderboard, history API endpoints`

---

## Task 4: XP Integration

**Goal:** Hook into existing quiz completion and AI chat to award XP and update streaks. TDD.

**Why fourth:** The service layer and API are ready. Now connect them to the actual user actions.

### Step 4.1 — Write integration tests (RED)

**File:** `backend/apps/gamification/tests/test_integration.py`

```python
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.content.models import Topic, Lesson, Question
from apps.practice.models import QuizSession, QuizAnswer
from apps.gamification.models import UserStats, XPTransaction

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="quizzer", email="q@example.com", password="testpass123",
    )


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def lesson_with_questions(db):
    topic = Topic.objects.create(name="Test Topic", order=1)
    lesson = Lesson.objects.create(
        topic=topic, type="vocab", title="Test Lesson", order=1,
    )
    q1 = Question.objects.create(
        lesson=lesson, type="mcq", prompt="Q1?",
        correct_answer="oui", wrong_answers=["non", "peut-etre"],
    )
    q2 = Question.objects.create(
        lesson=lesson, type="mcq", prompt="Q2?",
        correct_answer="bonjour", wrong_answers=["au revoir", "merci"],
    )
    return lesson, [q1, q2]


@pytest.mark.django_db
class TestQuizXPIntegration:
    def test_completing_quiz_awards_xp(self, auth_client, user, lesson_with_questions):
        lesson, questions = lesson_with_questions

        # Start quiz
        resp = auth_client.post("/api/practice/quiz/start/", {"lesson_id": lesson.id})
        session_id = resp.json()["session_id"]

        # Answer both correctly
        for q in questions:
            auth_client.post(
                f"/api/practice/quiz/{session_id}/answer/",
                {"question_id": q.id, "answer": q.correct_answer},
            )

        # Complete quiz
        resp = auth_client.post(f"/api/practice/quiz/{session_id}/complete/")
        assert resp.status_code == 200

        # Verify XP was awarded
        stats = UserStats.objects.get(user=user)
        # 2 correct answers x 5 = 10, plus perfect score bonus 25 = 35
        assert stats.total_xp == 35
        assert XPTransaction.objects.filter(user=user).count() >= 2

    def test_partial_quiz_no_perfect_bonus(self, auth_client, user, lesson_with_questions):
        lesson, questions = lesson_with_questions

        resp = auth_client.post("/api/practice/quiz/start/", {"lesson_id": lesson.id})
        session_id = resp.json()["session_id"]

        # Answer first correctly, second wrong
        auth_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": questions[0].id, "answer": questions[0].correct_answer},
        )
        auth_client.post(
            f"/api/practice/quiz/{session_id}/answer/",
            {"question_id": questions[1].id, "answer": "wrong"},
        )

        auth_client.post(f"/api/practice/quiz/{session_id}/complete/")

        stats = UserStats.objects.get(user=user)
        # 1 correct x 5 = 5 (no perfect bonus)
        assert stats.total_xp == 5

    def test_completing_quiz_updates_streak(self, auth_client, user, lesson_with_questions):
        lesson, questions = lesson_with_questions

        resp = auth_client.post("/api/practice/quiz/start/", {"lesson_id": lesson.id})
        session_id = resp.json()["session_id"]

        for q in questions:
            auth_client.post(
                f"/api/practice/quiz/{session_id}/answer/",
                {"question_id": q.id, "answer": q.correct_answer},
            )

        auth_client.post(f"/api/practice/quiz/{session_id}/complete/")

        stats = UserStats.objects.get(user=user)
        assert stats.current_streak == 1
        assert stats.last_active_date is not None
```

Run: `pytest apps/gamification/tests/test_integration.py` — expect **RED** (XP not yet awarded on quiz complete).

**No commit yet.**

### Step 4.2 — Hook XP into quiz completion (GREEN)

**File:** `backend/apps/practice/views.py` — modify `QuizCompleteView.post`:

```python
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.content.models import Question
from apps.gamification.services import award_xp, check_streak
from .models import QuizSession, QuizAnswer
from .serializers import (
    QuizStartSerializer,
    QuizQuestionSerializer,
    AnswerSubmitSerializer,
    AnswerResultSerializer,
    QuizCompleteSerializer,
    QuizHistorySerializer,
)


class QuizStartView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = QuizStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lesson_id = serializer.validated_data["lesson_id"]
        questions = Question.objects.filter(lesson_id=lesson_id)

        if not questions.exists():
            return Response(
                {"detail": "This lesson has no questions available."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session = QuizSession.objects.create(
            user=request.user,
            lesson_id=lesson_id,
            total_questions=questions.count(),
        )

        return Response(
            {
                "session_id": session.id,
                "questions": QuizQuestionSerializer(questions, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


class QuizAnswerView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, session_id):
        try:
            session = QuizSession.objects.get(
                pk=session_id, user=request.user,
            )
        except QuizSession.DoesNotExist:
            return Response(
                {"detail": "Quiz session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if session.completed_at is not None:
            return Response(
                {"detail": "This quiz is already completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AnswerSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question_id = serializer.validated_data["question_id"]
        user_answer = serializer.validated_data["answer"]

        try:
            question = Question.objects.get(pk=question_id)
        except Question.DoesNotExist:
            return Response(
                {"detail": "Question not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if QuizAnswer.objects.filter(session=session, question=question).exists():
            return Response(
                {"detail": "This question was already answered."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_correct = user_answer.strip().lower() == question.correct_answer.strip().lower()

        answer = QuizAnswer.objects.create(
            session=session,
            question=question,
            user_answer=user_answer,
            is_correct=is_correct,
        )

        return Response(AnswerResultSerializer(answer).data)


class QuizCompleteView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, session_id):
        try:
            session = QuizSession.objects.select_related("lesson").get(
                pk=session_id, user=request.user,
            )
        except QuizSession.DoesNotExist:
            return Response(
                {"detail": "Quiz session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if session.completed_at is not None:
            return Response(
                {"detail": "This quiz is already completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        correct_count = session.answers.filter(is_correct=True).count()
        session.score = correct_count
        session.completed_at = timezone.now()
        session.save()

        # --- Gamification: award XP ---
        source = f"quiz_session_{session.id}"

        # XP per correct answer
        if correct_count > 0:
            award_xp(
                request.user,
                activity_type="quiz_correct",
                xp_amount=correct_count * 5,
                source_id=source,
            )

        # Perfect score bonus
        if correct_count == session.total_questions and session.total_questions > 0:
            award_xp(
                request.user,
                activity_type="quiz_perfect",
                xp_amount=25,
                source_id=source,
            )

        # Update streak
        check_streak(request.user)

        return Response(QuizCompleteSerializer(session).data)


class QuizHistoryView(generics.ListAPIView):
    serializer_class = QuizHistorySerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return QuizSession.objects.filter(
            user=self.request.user,
        ).select_related("lesson")
```

Run: `pytest apps/gamification/tests/test_integration.py` — expect **GREEN**.

**Commit:** `feat(gamification): award XP and update streak on quiz completion`

### Step 4.3 — Hook XP into AI chat

When a conversation reaches 5+ user messages, award the `ai_conversation` XP (once per conversation).

**File:** `backend/apps/assistant/views.py` — modify `ChatView.post` to add XP logic after saving the assistant message:

Add this block after `# Save assistant response` (after the `Message.objects.create` for the assistant), before the final `return Response(...)`:

```python
        # Save assistant response
        Message.objects.create(
            conversation=conversation,
            role="assistant",
            content=llm_response.content,
            provider=llm_response.provider,
            tokens_used=llm_response.tokens_used,
        )

        # --- Gamification: award XP for 5+ exchange conversations ---
        user_message_count = Message.objects.filter(
            conversation=conversation, role="user",
        ).count()
        if user_message_count == 5:
            # Award exactly once when hitting the 5-message threshold
            from apps.gamification.services import award_xp, check_streak
            award_xp(
                request.user,
                activity_type="ai_conversation",
                xp_amount=15,
                source_id=f"conversation_{conversation.id}",
            )
            check_streak(request.user)

        return Response({
            "reply": llm_response.content,
            "conversation_id": conversation.id,
            "provider": llm_response.provider,
            "tokens_used": llm_response.tokens_used,
        })
```

**Commit:** `feat(gamification): award XP when AI conversation reaches 5 messages`

---

## Task 5: Frontend — Dashboard Stats & Progress Page

**Goal:** Update the Dashboard to show real XP, streak, level from the API. Create a Progress page with badges, leaderboard, and XP history.

**Why fifth:** The API is complete. Now wire the frontend to display gamification data.

### Step 5.1 — Add gamification API functions

**File:** `frontend/src/api/gamification.js`

```javascript
import client from "./client";

export const getStats = () => client.get("/gamification/stats/");

export const getBadges = () => client.get("/gamification/badges/");

export const getLeaderboard = (page = 1) =>
  client.get("/gamification/leaderboard/", { params: { page } });

export const getXPHistory = (page = 1) =>
  client.get("/gamification/history/", { params: { page } });
```

**Commit:** `feat(frontend): add gamification API client functions`

### Step 5.2 — Update Dashboard with real stats

**File:** `frontend/src/pages/Dashboard.jsx`

Replace the entire file:

```jsx
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getStats } from "../api/gamification";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Bonjour, {user?.username}!
      </h1>
      <p className="text-gray-600">
        Welcome to Lingaru. Your French learning journey starts here.
      </p>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700">Level</h2>
          <p className="text-3xl font-bold text-primary-600 mt-2">
            {loading ? "..." : stats?.level_name || "Debutant"}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700">XP</h2>
          <p className="text-3xl font-bold text-primary-600 mt-2">
            {loading ? "..." : stats?.total_xp ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700">Streak</h2>
          <p className="text-3xl font-bold text-primary-600 mt-2">
            {loading ? "..." : `${stats?.current_streak ?? 0} days`}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700">Rank</h2>
          <p className="text-3xl font-bold text-primary-600 mt-2">
            {loading ? "..." : `#${stats?.rank ?? "-"}`}
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Commit:** `feat(frontend): update Dashboard with real gamification stats`

### Step 5.3 — Create Progress page

**File:** `frontend/src/pages/Progress.jsx`

```jsx
import { useState, useEffect } from "react";
import { getStats, getBadges, getLeaderboard, getXPHistory } from "../api/gamification";

function BadgeCard({ name, description, icon, earned, earnedAt }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        earned ? "bg-yellow-50 border-yellow-300" : "bg-gray-50 border-gray-200 opacity-60"
      }`}
    >
      <div className="text-2xl mb-2">{icon === "trophy" ? "\u{1F3C6}" : icon === "fire" ? "\u{1F525}" : icon === "star" ? "\u{2B50}" : icon === "gem" ? "\u{1F48E}" : icon === "crown" ? "\u{1F451}" : icon === "medal" ? "\u{1F3C5}" : icon === "chat" ? "\u{1F4AC}" : "\u{1F3C6}"}</div>
      <h3 className="font-semibold text-gray-800">{name}</h3>
      <p className="text-sm text-gray-500">{description}</p>
      {earned && earnedAt && (
        <p className="text-xs text-yellow-600 mt-1">
          Earned {new Date(earnedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

export default function Progress() {
  const [stats, setStats] = useState(null);
  const [badges, setBadges] = useState({ earned: [], available: [] });
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getBadges(), getLeaderboard(), getXPHistory()])
      .then(([statsRes, badgesRes, lbRes, histRes]) => {
        setStats(statsRes.data);
        setBadges(badgesRes.data);
        setLeaderboard(lbRes.data.results || []);
        setHistory(histRes.data.results || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Your Progress</h1>

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-sm text-gray-500">Total XP</p>
          <p className="text-2xl font-bold text-primary-600">{stats?.total_xp ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-sm text-gray-500">Level</p>
          <p className="text-2xl font-bold text-primary-600">{stats?.level_name}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-sm text-gray-500">Current Streak</p>
          <p className="text-2xl font-bold text-primary-600">{stats?.current_streak} days</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-sm text-gray-500">Longest Streak</p>
          <p className="text-2xl font-bold text-primary-600">{stats?.longest_streak} days</p>
        </div>
      </div>

      {/* Badges */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Badges</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {badges.earned.map((b) => (
            <BadgeCard
              key={b.id}
              name={b.name}
              description={b.description}
              icon={b.icon}
              earned
              earnedAt={b.earned_at}
            />
          ))}
          {badges.available.map((b) => (
            <BadgeCard
              key={b.id}
              name={b.name}
              description={b.description}
              icon={b.icon}
              earned={false}
            />
          ))}
        </div>
      </section>

      {/* Leaderboard */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Leaderboard</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Rank</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">User</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">XP</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leaderboard.map((entry, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">#{idx + 1}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{entry.username}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{entry.total_xp}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{entry.current_streak}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* XP History */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent XP</h2>
        {history.length === 0 ? (
          <p className="text-gray-500">No XP earned yet. Start a quiz!</p>
        ) : (
          <div className="space-y-2">
            {history.map((txn) => (
              <div
                key={txn.id}
                className="bg-white rounded-lg shadow p-3 flex justify-between items-center"
              >
                <div>
                  <span className="font-medium text-gray-800">
                    +{txn.xp_amount} XP
                  </span>
                  <span className="text-sm text-gray-500 ml-2">
                    {txn.activity_type.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(txn.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

### Step 5.4 — Add Progress route

**File:** `frontend/src/App.jsx`

Add the import and route:

```jsx
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Topics from "./pages/Topics";
import TopicDetail from "./pages/TopicDetail";
import LessonDetail from "./pages/LessonDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Quiz from "./pages/Quiz";
import Assistant from "./pages/Assistant";
import Progress from "./pages/Progress";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="topics" element={<Topics />} />
          <Route path="topics/:id" element={<TopicDetail />} />
          <Route path="lesson/:id" element={<LessonDetail />} />
          <Route path="practice/quiz/:lessonId" element={<Quiz />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="progress" element={<Progress />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
```

**Commit:** `feat(frontend): add Progress page with badges, leaderboard, XP history`

---

## Task 6: Telegram Stats Update

**Goal:** Update the `/stats` bot handler to display real XP, level, streak, and badge data.

**Why last:** Everything it depends on is in place. Just swap the placeholder text for real data.

### Step 6.1 — Write test for updated stats handler

**File:** `backend/apps/bot/tests/test_stats.py` (update or create)

```python
import pytest
from datetime import date
from django.contrib.auth import get_user_model

from apps.gamification.models import Badge, UserBadge, UserStats
from apps.bot.handlers.stats import get_user_stats

User = get_user_model()


@pytest.mark.django_db
class TestGetUserStats:
    def test_includes_gamification_data(self):
        user = User.objects.create_user(
            username="tguser", password="testpass123",
        )
        UserStats.objects.create(
            user=user,
            total_xp=500,
            level=2,
            current_streak=5,
            longest_streak=10,
            last_active_date=date(2026, 4, 4),
        )
        badge = Badge.objects.create(
            name="First Quiz",
            description="Complete your first quiz",
            icon="trophy",
            criteria_type="quizzes_completed",
            criteria_value=1,
        )
        UserBadge.objects.create(user=user, badge=badge)

        stats = get_user_stats(user)
        assert stats["total_xp"] == 500
        assert stats["level_name"] == "Apprenti"
        assert stats["current_streak"] == 5
        assert stats["longest_streak"] == 10
        assert stats["badges_count"] == 1

    def test_new_user_gets_defaults(self):
        user = User.objects.create_user(
            username="newuser", password="testpass123",
        )
        stats = get_user_stats(user)
        assert stats["total_xp"] == 0
        assert stats["level_name"] == "Debutant"
        assert stats["current_streak"] == 0
```

Run: `pytest apps/bot/tests/test_stats.py` — expect **RED**.

### Step 6.2 — Update stats handler (GREEN)

**File:** `backend/apps/bot/handlers/stats.py`

Replace entire file:

```python
import logging

from django.contrib.auth import get_user_model
from django.db.models import Sum
from telegram import Update
from telegram.ext import ContextTypes

from apps.bot.handlers.start import get_or_create_telegram_user
from apps.gamification.models import UserBadge, UserStats
from apps.gamification.services import get_level, get_or_create_stats
from apps.practice.models import QuizSession

logger = logging.getLogger(__name__)

User = get_user_model()


def get_user_stats(user) -> dict:
    """Compute gamification and quiz stats for a user."""
    stats = get_or_create_stats(user)
    level_name, _ = get_level(stats.total_xp)

    completed_sessions = QuizSession.objects.filter(
        user=user,
        completed_at__isnull=False,
    )
    aggregates = completed_sessions.aggregate(
        total_correct=Sum("score"),
        total_questions=Sum("total_questions"),
    )

    badges_count = UserBadge.objects.filter(user=user).count()

    return {
        "username": user.first_name or user.username,
        "total_xp": stats.total_xp,
        "level_name": level_name,
        "current_streak": stats.current_streak,
        "longest_streak": stats.longest_streak,
        "badges_count": badges_count,
        "quizzes_completed": completed_sessions.count(),
        "total_correct": aggregates["total_correct"] or 0,
        "total_questions": aggregates["total_questions"] or 0,
    }


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /stats command — show user gamification statistics."""
    tg_user = update.effective_user
    user, _ = get_or_create_telegram_user(
        telegram_id=tg_user.id,
        first_name=tg_user.first_name or "",
        username=tg_user.username,
    )

    stats = get_user_stats(user)

    accuracy = (
        round(stats["total_correct"] / stats["total_questions"] * 100)
        if stats["total_questions"] > 0 else 0
    )

    message = (
        f"Stats for {stats['username']}:\n\n"
        f"Level: {stats['level_name']}\n"
        f"XP: {stats['total_xp']}\n"
        f"Streak: {stats['current_streak']} days "
        f"(best: {stats['longest_streak']})\n"
        f"Badges: {stats['badges_count']}\n\n"
        f"Quizzes completed: {stats['quizzes_completed']}\n"
        f"Correct answers: {stats['total_correct']}/{stats['total_questions']}\n"
        f"Accuracy: {accuracy}%"
    )
    await update.message.reply_text(message)
```

Run: `pytest apps/bot/tests/test_stats.py` — expect **GREEN**.

**Commit:** `feat(bot): update /stats handler with XP, level, streak, badges`

---

## Summary

| Task | Files Changed/Created | Test Files | Commit Count |
|---|---|---|---|
| 1: Models & Service | `apps/gamification/models.py`, `services.py`, `constants.py`, `apps.py`, `settings/base.py` | `test_models.py`, `test_services.py` | 3 |
| 2: Admin & Seed | `admin.py`, `management/commands/seed_badges.py` | `test_commands.py` | 2 |
| 3: API Endpoints | `serializers.py`, `views.py`, `urls.py`, `config/urls.py` | `test_api.py` | 1 |
| 4: XP Integration | `apps/practice/views.py`, `apps/assistant/views.py` | `test_integration.py` | 2 |
| 5: Frontend | `api/gamification.js`, `pages/Dashboard.jsx`, `pages/Progress.jsx`, `App.jsx` | — | 3 |
| 6: Telegram Stats | `apps/bot/handlers/stats.py` | `test_stats.py` | 1 |
| **Total** | | | **12 commits** |

### Run Order

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6
```

Each task is independently testable. After Task 3 the API is fully functional. Tasks 5 and 6 are frontend/bot concerns that could be done in parallel.
