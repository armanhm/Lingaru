# Phase 13 — Mini Games

**Date:** 2026-04-26
**Status:** Shipped
**Scope:** Frontend (with `submitMiniGameScore` posting to `/api/gamification/mini-game/score/`)

## Why

Practice fatigue is real. Mini-games convert vocabulary and gender drilling into bite-sized loops with a clear win condition, animations, and XP — the same content delivered in a different shape so users keep coming back.

## Six games

| Game | Mechanic | Settings |
|---|---|---|
| Word Scramble | Drag letters or type to unscramble; comma-separated synonyms accepted; 350ms feedback delay; rounded timer ring | `word_scramble_rounds` (3-20), `word_scramble_timer` (10-60s) |
| Match Pairs | French ↔ English memory grid with preview window; matched pairs stay revealed; FR=info, EN=purple, matched=success | `match_pairs_count` (4-10), `match_pairs_preview` (1-10s) |
| Gender Snap | Le / La timed tap challenge; pink for feminine, info for masculine; slowed feedback after each answer | `gender_snap_rounds` (5-20) |
| Missing Letter | Fill in a missing letter; accent-insensitive comparison | `missing_letter_rounds` (3-20) |
| Speed Round | True / False rapid-fire with overall countdown timer | `speed_round_questions` (5-30), `speed_round_timer` (15-120s) |
| Listening Challenge | TTS-driven listen-and-type with hint button | `listening_challenge_rounds` (3-20) |

## Settings

All mini-game tunables live under the **Mini Games** tab on the Settings page (segmented tabs).

## Backend touchpoints

- `POST /api/gamification/mini-game/score/` — `{ game, score, total }` → awards XP based on score ratio
- Vocabulary pulled from `/api/content/vocabulary/random/` with a `gendered` flag for Gender Snap

## Frontend pages

- `MiniGames.jsx` — hub with 6 gradient top-band cards
- `WordScramble.jsx`, `MatchPairs.jsx`, `GenderSnap.jsx`, `MissingLetter.jsx`, `SpeedRound.jsx`, `ListeningChallenge.jsx`
