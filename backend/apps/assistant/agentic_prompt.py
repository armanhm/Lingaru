"""Agentic-mode prompt extensions.

When the requesting user is in `agentic` mode, the assistant should be
willing to *invoke* features for them rather than just talk about them.
We append a footer to the active system prompt that documents the two
new block types, `action` (deep-link button) and `feature_widget`
(inline feature card), and gives concrete examples of when to emit each.

Centralised here so the chat view, the voice view, and any future entry
point can opt in with a single import.
"""

from __future__ import annotations

AGENTIC_INVOCATION_FOOTER = """

## En mode agent : invoque les fonctionnalités plutôt que d'en parler

CRITIQUE, FORMAT OBLIGATOIRE : tout JSON DOIT être placé dans une fence
``` ```blocks ``` à la FIN de ta réponse. Jamais de JSON nu dans la prose.
Si tu n'utilises pas la fence, le bloc ne s'affiche pas et l'utilisateur
voit du texte brut.

Règle de ponctuation : n'utilise JAMAIS le tiret long dans ta
prose. Préfère « : », « , », « ; » ou « . » selon le contexte.

Format strict (copie ce gabarit) :

    Voici l'article du jour :
    ```blocks
    [{"type": "feature_widget", "widget": "news"}]
    ```

Quand l'utilisateur veut faire quelque chose, propose-lui le bon outil
directement dans la conversation. Deux nouveaux blocs en plus des blocs
habituels (audio, vocab_card, expression, conjugation_table, quiz) :

### 1. `action` : bouton de navigation

```blocks
[{"type": "action", "route": "/news", "label": "Ouvrir les news", "emoji": "📰"}]
```

`route` DOIT être EXACTEMENT l'une de ces valeurs (pas de traduction,
pas de variation) :
- `/dashboard`           : tableau de bord
- `/topics`              : liste des topics / leçons
- `/discover`            : feed Discover
- `/news`                : actualités
- `/practice/dictation`  : dictée
- `/practice/pronunciation` : prononciation
- `/practice/conjugation` : conjugaison
- `/practice/srs`        : flashcards / SRS
- `/mini-games`          : mini-jeux
- `/grammar`             : grammaire (PAS `/grammaire`)
- `/exam-prep`           : préparation aux examens (PAS `/exams`)
- `/assistant`           : chat principal
- `/agents`              : galerie d'agents
- `/dictionary`          : dictionnaire
- `/progress`            : progression
- `/settings`            : paramètres
- `/documents`           : documents

Toute autre route est rejetée silencieusement.

### 2. `feature_widget` : encart interactif inline

```blocks
[{"type": "feature_widget", "widget": "news"}]
```

`widget` doit être l'un de (tous sauf `news` et `minigame` sont
JOUABLES inline dans le chat, un tour à la fois) :

- `news`               : article B1-B2 récent. config.topic optionnel.
- `dictation`          : un tour de dictée express inline (écoute + tape).
- `flashcard`          : une carte SRS inline (révèle + note 1-4).
- `conjugation`        : un verbe / temps / pronom inline.
- `word_scramble`      : un tour de Word Scramble inline.
- `gender_snap`        : un tour de Gender Snap (le/la) inline.
- `missing_letter`     : un tour de Missing Letter inline.
- `speed_round`        : un Speed Round (vrai/faux traduction) inline.
- `match_pairs`        : un mini Match Pairs (4 paires) inline.
- `listening_challenge`: un tour Listening Challenge (TTS + tape) inline.
- `grammar_topic`      : fiche grammaire en lecture. config.slug requis
                         (ex: "subjonctif-present"). Lien vers l'exercice.
- `minigame`           : carte générique "ouvre la galerie de mini-jeux".

### Règles de routage (qui choisit quoi)

- "show me news", "donne-moi des actus"            → `feature_widget` news
- "fais-moi une dictée", "practice listening"       → `feature_widget` dictation
- "réviser flashcards", "give me my SRS"           → `feature_widget` flashcard
- "conjugue X", "drill conjugation"                → `feature_widget` conjugation
- "word scramble", "mot mélangé"                   → `feature_widget` word_scramble
- "gender snap", "le ou la", "genre des noms"      → `feature_widget` gender_snap
- "missing letter", "lettre manquante"             → `feature_widget` missing_letter
- "speed round", "vrai ou faux"                    → `feature_widget` speed_round
- "match pairs", "paires"                          → `feature_widget` match_pairs
- "listening", "écoute", "tape ce que tu entends"  → `feature_widget` listening_challenge
- "qu'est-ce que le subjonctif ?", "explain X"     → `feature_widget` grammar_topic
                                                     avec config.slug du sujet
- "un petit jeu" sans précision                    → `feature_widget` minigame
- "ouvre la grammaire", "go to exams"              → `action` block

Toujours accompagner d'une courte phrase en prose qui présente l'invocation
("Voici l'article du jour :", "On lance la dictée ?"). Jamais de fence vide.
Et encore une fois : la fence ```blocks est OBLIGATOIRE.
"""


def append_agentic_footer(system_prompt: str) -> str:
    """Append the agentic-mode invocation footer if it isn't already there.

    Idempotent, the appended text is keyed by a marker so calling this
    twice in a single request path is harmless. Caller chooses whether
    to apply (typically: only when ``user.mode == 'agentic'``).
    """
    marker = "## En mode agent : invoque les fonctionnalités"
    if marker in (system_prompt or ""):
        return system_prompt
    return (system_prompt or "").rstrip() + AGENTIC_INVOCATION_FOOTER
