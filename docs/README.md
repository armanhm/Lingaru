# Lingaru Documentation

Everything about how Lingaru works, what it promises, and where it is going. These files are the source of truth; `docs/wiki/` is mirrored to the [GitHub Wiki](https://github.com/armanhm/Lingaru/wiki) by `scripts/sync_wiki.sh`.

| Folder | Purpose | Kept current? |
|--------|---------|---------------|
| [`wiki/`](wiki/Home.md) | How each part works and how to work on it | Yes: update with the code |
| [`specs/`](#specs) | The contract each domain honours: requirements, data model, API, rules | Yes: update in the PR that changes behaviour |
| [`review/`](review/2026-11-phase0-review.md) | Review reports and the phased roadmap | Snapshot in time |
| [`superpowers/`](superpowers/) | Original system design and per-phase implementation plans (phases 1 to 22) | Historical, not maintained |

Start with the [wiki Home](wiki/Home.md), or [Getting Started](wiki/Getting-Started.md) if you just want it running.

## Specs

Each spec follows the same shape: purpose and scope, requirements (FR-n), data model, API contract, business rules, background jobs, dependencies, and deviations (places where today's code falls short of the intended contract). The specs were reverse-engineered from the code on 2026-11-11.

| Domain | Spec | Wiki |
|--------|------|------|
| Users and auth | [users-auth.md](specs/users-auth.md) | [Users and Auth](wiki/Users-and-Auth.md) |
| Content | [content.md](specs/content.md) | [Content and Lessons](wiki/Content-and-Lessons.md) |
| Content data and seeding | [content-data.md](specs/content-data.md) | [Content Data Pipeline](wiki/Content-Data-Pipeline.md) |
| Practice (quizzes) | [practice.md](specs/practice.md) | [Practice and Quizzes](wiki/Practice-and-Quizzes.md) |
| Progress and SRS | [progress-srs.md](specs/progress-srs.md) | [Progress, SRS and Conjugation](wiki/Progress-SRS-and-Conjugation.md) |
| Gamification | [gamification.md](specs/gamification.md) | [Gamification](wiki/Gamification.md) |
| Grammar Booster | [grammar-booster.md](specs/grammar-booster.md) | [Grammar Booster](wiki/Grammar-Booster.md) |
| Exam Prep | [exam-prep.md](specs/exam-prep.md) | [Exam Prep](wiki/Exam-Prep.md) |
| Dictionary | [dictionary.md](specs/dictionary.md) | [Dictionary and Conjugator](wiki/Dictionary-and-Conjugator.md) |
| Discover and News | [discover-news.md](specs/discover-news.md) | [Discover and News](wiki/Discover-and-News.md) |
| Notes and My Notes | [notes.md](specs/notes.md) | [Notes and My Notes](wiki/Notes-and-My-Notes.md) |
| LLM layer | [llm-layer.md](specs/llm-layer.md) | [LLM Providers and Prompts](wiki/LLM-Providers-and-Prompts.md) |
| Assistant (incl. block protocol) | [assistant.md](specs/assistant.md) | [AI Assistant](wiki/AI-Assistant.md), [Agentic Blocks](wiki/Agentic-Blocks.md) |
| Agents | [agents.md](specs/agents.md) | [Agents](wiki/Agents.md) |
| Memory | [memory.md](specs/memory.md) | [Memory](wiki/Memory.md) |
| Documents and RAG | [documents-rag.md](specs/documents-rag.md) | [Documents and RAG](wiki/Documents-and-RAG.md) |
| Media and audio | [media-audio.md](specs/media-audio.md) | [Audio: TTS and STT](wiki/Audio-TTS-STT.md) |
| Telegram bot | [telegram-bot.md](specs/telegram-bot.md) | [Telegram Bot](wiki/Telegram-Bot.md) |
| Frontend | [frontend.md](specs/frontend.md) | [Frontend Architecture](wiki/Frontend-Architecture.md) |
| Design system | [design-system.md](specs/design-system.md) | [Frontend Design System](wiki/Frontend-Design-System.md) |
| Infrastructure | [infrastructure.md](specs/infrastructure.md) | [Deployment and Operations](wiki/Deployment-and-Operations.md) |

## Writing docs

- Wiki page shape: summary, overview, key concepts, how it works, data model, configuration, working on it, known gaps.
- Use relative links between wiki pages (`[X](Other-Page.md)`); the sync script rewrites them for the GitHub Wiki.
- No em-dashes. Tables over prose. Cite file paths, not line numbers.
- Do not describe unfixed security weaknesses in public docs; see [`SECURITY.md`](../SECURITY.md).
