# Lingaru Wiki

> Lingaru is a self-hosted language-learning app for French (and English) learners at B1 to B2. It combines structured lessons, spaced repetition, games, exam prep, an AI tutor with specialised agents and memory, and a Telegram bot, all on one Django + React stack.

This wiki explains **how Lingaru works and how to work on it**. The source lives in [`docs/wiki/`](https://github.com/armanhm/Lingaru/tree/main/docs/wiki) in the repo and is mirrored here; edit it there. Contracts per domain live in [`docs/specs/`](../README.md#specs).

## Start here

| If you want to... | Read |
|-------------------|------|
| Run it locally | [Getting Started](Getting-Started.md) |
| Understand the big picture | [Architecture](Architecture.md) |
| Contribute a change | [Conventions](Conventions.md), [Testing and CI](Testing-and-CI.md) |
| Deploy or operate it | [Deployment and Operations](Deployment-and-Operations.md), [Configuration and Settings](Configuration-and-Settings.md) |
| See current priorities | [Phase 0 Review and Roadmap](../review/2026-11-phase0-review.md) |

## Learning features

| Page | Covers |
|------|--------|
| [Content and Lessons](Content-and-Lessons.md) | Topics, lessons, vocabulary, reading, video lessons |
| [Practice and Quizzes](Practice-and-Quizzes.md) | Lesson quizzes and answer matching |
| [Progress, SRS and Conjugation](Progress-SRS-and-Conjugation.md) | Flashcards (SM-2), mistake journal, conjugation drills |
| [Grammar Booster](Grammar-Booster.md) | Grammar course, drills, mastery |
| [Exam Prep](Exam-Prep.md) | TCF/TEF practice and AI grading |
| [Mini Games](Mini-Games.md) | Six vocabulary games |
| [Dictionary and Conjugator](Dictionary-and-Conjugator.md) | Lookups and verb tables |
| [Discover and News](Discover-and-News.md) | Explore feed and the News reader |
| [Notes and My Notes](Notes-and-My-Notes.md) | Our Notes vs My Notes vs Memory |
| [Gamification](Gamification.md) | XP, levels, streaks, badges, leaderboard |

## AI

| Page | Covers |
|------|--------|
| [AI Assistant](AI-Assistant.md) | Chat lifecycle: text, voice, image |
| [Agentic Blocks](Agentic-Blocks.md) | Structured cards and widgets inside chat replies |
| [Agents](Agents.md) | Specialised assistants |
| [Memory](Memory.md) | What the assistant remembers about a learner |
| [Documents and RAG](Documents-and-RAG.md) | Learner uploads used as context |
| [LLM Providers and Prompts](LLM-Providers-and-Prompts.md) | Gemini/Groq routing and the prompt inventory |
| [Audio: TTS and STT](Audio-TTS-STT.md) | Speech synthesis, transcription, pronunciation, dictation |

## Platform

| Page | Covers |
|------|--------|
| [Users and Auth](Users-and-Auth.md) | Accounts, approval, JWT, learner profile |
| [Telegram Bot](Telegram-Bot.md) | Bot commands and handlers |
| [Content Data Pipeline](Content-Data-Pipeline.md) | `data/` banks, seed commands, seeding a fresh DB |
| [Frontend Architecture](Frontend-Architecture.md) | Routing, session, API layer, state |
| [Frontend Design System](Frontend-Design-System.md) | Tokens, components, theming |
| [Internationalization](Internationalization.md) | UI language vs target language |
| [Configuration and Settings](Configuration-and-Settings.md) | Settings modules, env vars, Celery |
| [Deployment and Operations](Deployment-and-Operations.md) | Compose stack, deploy, backups, runbook |
| [Testing and CI](Testing-and-CI.md) | Test suites and workflows |
