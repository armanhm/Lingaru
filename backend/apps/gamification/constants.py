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
