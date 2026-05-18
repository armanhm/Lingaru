"""Footer appended to system prompts when the user's mode is 'agentic'.

The footer documents the action / feature_widget block types so the
LLM knows it can invoke features inline. Per-language because the
footer's instructions are in the user's target_language.

Centralised here so the chat view, the voice view, and any future entry
point can opt in with a single import.
"""

from __future__ import annotations

_FR_FOOTER = """

## En mode agent : invoque les fonctionnalités plutôt que d'en parler

CRITIQUE, FORMAT OBLIGATOIRE : tout JSON DOIT être placé dans une fence
``` ```blocks ``` à la FIN de ta réponse. Jamais de JSON nu dans la prose.
Si tu n'utilises pas la fence, le bloc ne s'affiche pas et l'utilisateur
voit du texte brut.

Règle de ponctuation : n'utilise JAMAIS le tiret long dans ta
prose. Préfère « : », « , », « ; » ou « . » selon le contexte.

Format strict. Pour une invocation simple, la fence SEULE suffit :

    ```blocks
    [{"type": "feature_widget", "widget": "word_scramble"}]
    ```

Pour news, une mini-intro courte est OK car elle peut situer le sujet :

    Voici l'actualité du jour :
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
- "un petit jeu" SANS précision                    → `feature_widget` minigame
- "ouvre la grammaire", "go to exams"              → `action` block

### Règles dures (priorité absolue)

1. N'invoque PAS de widget pour les salutations ou la conversation
   ordinaire. "salut", "bonjour", "ça va ?", "merci", "ok", "d'accord"
   → réponds en prose, sans fence. Tu peux DEMANDER si l'utilisateur
   veut s'entraîner, mais n'envoie le widget que quand il dit oui ou
   nomme explicitement une activité.

2. Si l'utilisateur NOMME un jeu spécifique (word scramble, gender
   snap, missing letter, speed round, match pairs, listening challenge,
   dictation, flashcards, conjugation), utilise la clé spécifique.
   JAMAIS `minigame`. La clé `minigame` n'est qu'un fallback quand
   l'utilisateur demande "un jeu" sans préciser lequel.

3. Si la requête correspond clairement à une fonctionnalité (dictée,
   flashcards, conjugaison, mini-jeu nommé), AUCUNE prose superflue.
   PAS de "C'est une excellente idée !", PAS de "Bien sûr, voici…",
   PAS de phrases d'introduction. Soit la prose est utile au sens
   (explique brièvement le sujet, donne le mot du jour, etc.), soit on
   l'omet et on emet juste la fence avec le widget.

4. Préfère envoyer la fence ```blocks SANS prose au-dessus quand le
   widget se suffit à lui-même (mini-jeux, flashcards, dictée). Le
   widget a son propre titre et son propre encart, donc une ligne
   d'intro est redondante.

La fence ```blocks reste OBLIGATOIRE quand tu emets un bloc structuré.
"""

_FOOTERS = {
    "fr": _FR_FOOTER,
    "en": (
        "\n\nWhen the user asks to practice or play, you may emit a fenced "
        "```blocks JSON segment with action or feature_widget objects. "
        'Action: `{"type": "action", "route": "/path", "label": "Label"}`. '
        'Feature widget: `{"type": "feature_widget", "widget": "name", "config": {}}`. '
        "Use them when the user explicitly asks for the feature."
    ),
}


def append_agentic_footer(system_prompt: str, language: str = "fr") -> str:
    """Append the language-specific agentic footer to a system prompt.

    Idempotent -- the appended text is keyed by a marker so calling this
    twice in a single request path is harmless. Caller chooses whether
    to apply (typically: only when ``user.mode == 'agentic'``).
    """
    footer = _FOOTERS.get(language) or _FOOTERS["fr"]
    # Use a stable marker from the FR footer for idempotency check;
    # for EN we use a shorter unique prefix.
    if language == "en":
        marker = "you may emit a fenced"
    else:
        marker = "## En mode agent : invoque les fonctionnalités"
    if marker in (system_prompt or ""):
        return system_prompt
    return (system_prompt or "").rstrip() + footer
