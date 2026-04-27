# Phase 17 — UI Overhaul

**Date:** 2026-04-26 → 2026-04-27
**Status:** Shipped (ongoing polish)
**Scope:** Frontend only

## Why

The original UI was clean but generic — Tailwind defaults, no clear typographic hierarchy, dashboard didn't feel like a focused product. The user asked for a senior-product-design pass with sophisticated/Notion-Linear sensibility. This phase establishes a real design system and rebuilds the highest-traffic surfaces around it.

## Design tokens (Tailwind config + index.css)

- **Colors** — `primary` (indigo-violet), `accent` (coral), `success`, `danger`, `warn`, `info`, `surface` (slate), `paper`, `ink`. All semantic, never raw palette names in components.
- **Typography scale** — `display-xl, display, h1, h2, h3, h4, body-lg, body, caption, eyebrow` with baked-in line-height and tracking
- **Fonts** — Inter (UI), Instrument Serif via `font-editorial` utility (display headlines + pull quotes; ligatures disabled for cleaner French diacritics), JetBrains Mono via `font-mono` (numerics)
- **Shadows** — `card, card-hover, card-elevated, glow-primary, glow-success, glow-danger, glow-accent`
- **Keyframes** — `fade-in, fade-in-up, slide-in-*, scale-in, pop-in, bounce-in, shake, confetti-pop, confetti-fall, pulse-glow, recording-pulse, count-up, shimmer, float, gradient-shift, spin-slow, flame, pulse-soft`
- **Component layer** — `.card, .card-hover, .card-elevated, .btn-primary/secondary/ghost/accent/danger/success, .btn-sm/md/lg/xl, .badge-*, .input, .input-error, .focus-ring, .section-label, .eyebrow-primary, .stat-pill, .kbd, .glass, .skeleton, .underline-wavy, .num`
- **Shared UI components** — `PageHeader, EmptyState, Confetti, TriumphHero, Skeleton/SkeletonText/SkeletonCard/SkeletonCircle/SkeletonGrid`

## Dashboard — Hybride direction (compass + recommended session)

From the Claude Design handoff. Layout the user landed on after iterating through Atelier / Jardin / Boussole.

- Header: French date · 24h clock, time-of-day greeting (Bonjour / Bon après-midi / Bonsoir) with username as gradient accent, streak-flame + XP pill
- Hero: dark ink + primary panel (recommended subjunctif drill) on the **left** (col-span 7); `CompassDial` SVG radar with 6 skill axes on the **right** (col-span 5). Today's plan trio inside the hero (Échauffement / Séance ciblée / Parler).
- Bottom row: TCF countdown / Mot du jour (real `/content/vocabulary/random/` lookup) / Quick rail (4 tiles)
- Citation du jour card — 13 curated French quotes (Apollinaire, Hugo, Saint-Exupéry, Descartes, Einstein, Wilde, Schweitzer, Abbé Pierre + proverbs), daily rotation, FR ↔ EN toggle, AudioPlayButton, shuffle
- Recent activity — sourced from `trend.top_activities` + `trend.sample_mistakes` with French timeAgo

## Assistant — single-column chat with drawers

From the same Claude Design handoff. The user flagged the original 3-column layout as crowded; the design's Conversation direction reduces to one breathable column with the rails moved into drawers.

- Sticky header: history-drawer toggle (☰), "Nouvelle" pill, scenario/mode title with level badge, Tuteur avatar button, Erreurs flag button (with mistake count)
- HistoryDrawer (left): mode picker (4 tiles), scenario tile grid (10 roleplays, shown only in roleplay mode), search, real conversation history wired to `getConversations` / `getConversation`
- TuteurDrawer (right): persona card (Claire), mode + scenario pickers
- ErreursDrawer (right): per-message correction list with strike-through `from`, green `→ to`, pedagogical note. Empty state encouraging continued writing.
- Single max-w-3xl chat column with gradient user bubbles, white tutor bubbles, wavy red underlines on inline corrections (hover tooltip with → correction)
- Composer: rounded card with focus ring; image / voice / translate / gradient send button; recording-pulse mic
- Each of 10 roleplay scenarios carries its own `placeholder`, `starters[]`, `blurb` (header tagline), and `sub` (mise-en-situation sentence) so copy stays coherent end-to-end
- Bypasses the Layout's `max-w-7xl` wrapper for an edge-to-edge feel

## Layout

- Sidebar: Practice section is collapsible (chevron header, persisted to `localStorage` under `lingaru.sidebar.collapsedSections.v1`). Auto-expands when the active route lives inside a collapsed section.
- Mistakes was demoted to a Progress page header action; Documents was demoted to a Settings → Security card. Both routes still work directly.
- Layout's `max-w-6xl` content wrapper widened to `max-w-7xl`. Assistant route is special-cased to render full-bleed (no max-width clamp).

## News

See Phase 16. Article body is full-width on top; Pratique guidée tabs (Vocabulaire / Expressions / Grammaire) sit below as their own full-width section with large equal-width tab buttons and multi-column content grids.
