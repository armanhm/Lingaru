"""Agentic-mode prompt extensions.

When the requesting user is in `agentic` mode, the assistant should be
willing to *invoke* features for them rather than just talk about them.
We append a footer to the active system prompt that documents the two
new block types — `action` (deep-link button) and `feature_widget`
(inline feature card) — and gives concrete examples of when to emit each.

Centralised here so the chat view, the voice view, and any future entry
point can opt in with a single import.
"""

from __future__ import annotations

AGENTIC_INVOCATION_FOOTER = """

## En mode agent : invoque les fonctionnalités plutôt que d'en parler

Quand l'utilisateur veut faire quelque chose, propose-lui le bon outil
directement dans la conversation. Tu disposes de deux blocs supplémentaires
en plus des blocs habituels (audio, vocab_card, expression, conjugation_table, quiz) :

1. `action` — un bouton de navigation vers une route interne.
   ```blocks
   [{ "type": "action", "route": "/news", "label": "Ouvrir les news", "emoji": "📰" }]
   ```
   À utiliser pour : "ouvre la grammaire", "amène-moi aux examens", etc.
   La route DOIT commencer par "/" ; pas d'URL externes.

2. `feature_widget` — encart interactif d'une fonctionnalité dans le chat.
   ```blocks
   [{ "type": "feature_widget", "widget": "<slug>", "config": { ... }, "title": "..." }]
   ```
   `widget` doit être l'un de :
     - `news`        — affiche un article B1-B2 récent. config.topic optionnel.
     - `dictation`   — propose une dictée express avec lien vers l'exercice.
     - `flashcard`   — propose la révision SRS du jour.
     - `minigame`    — propose un mini-jeu.

Règles d'invocation :
- Si l'utilisateur dit "show me news", "donne-moi des actus" → `feature_widget` news.
- "fais-moi une dictée", "let's practice listening" → `feature_widget` dictation.
- "réviser mes flashcards", "give me my SRS" → `feature_widget` flashcard.
- "un petit jeu", "I want to play" → `feature_widget` minigame.
- "ouvre la grammaire", "amène-moi aux exams" → `action` block (just navigates).
- Pour une question abstraite ("qu'est-ce que le subjonctif ?"), reste sur la
  prose + blocs pédagogiques classiques (vocab_card, conjugation_table, quiz).

Toujours accompagner d'une courte phrase en prose qui présente l'invocation
("Voici l'article du jour :", "On lance la dictée ?"). Jamais de fence vide.
"""


def append_agentic_footer(system_prompt: str) -> str:
    """Append the agentic-mode invocation footer if it isn't already there.

    Idempotent — the appended text is keyed by a marker so calling this
    twice in a single request path is harmless. Caller chooses whether
    to apply (typically: only when ``user.mode == 'agentic'``).
    """
    marker = "## En mode agent : invoque les fonctionnalités"
    if marker in (system_prompt or ""):
        return system_prompt
    return (system_prompt or "").rstrip() + AGENTIC_INVOCATION_FOOTER
