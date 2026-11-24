# Paper design foundation: design

Date: 2026-11-23 · Status: look direction and scope agreed with the owner; doc pending approval · Build order: first of the Phase 2 projects (after security and the deploy fix), before the targeted daily session

Mockups the owner chose from: https://claude.ai/artifact/8woguVkuRgwuivJxYuEVda (direction "A · Paper").

## 1. Intent and why

Lingaru should feel **"calm and focused, like Duolingo but more grown-up"** (the owner's words). Today every page invents its own look: three per-mode gradient themes (indigo, red, amber), purple gradient headings, emoji icons, a dark hero card, about 400 one-off pixel font sizes. The new targeted daily session is the app's new centre and should be the first feature built in a coherent design, so the design system comes first.

The foundation is one shared visual system (tokens, components, app shell) that every screen is built from. It is not the page-by-page redesign; that is a separate, later project.

## 2. Goals, non-goals, anti-goals

**Goals**

- Paper tokens (colour, type, spacing, radius, elevation, motion) in one place, light and dark.
- Existing pages shift to the Paper palette and type immediately, without being rewritten, by re-pointing the colour scales and shared classes they already use.
- A small set of accessible, documented components that new screens (starting with the daily session) are built from.
- The app shell (desktop sidebar, phone top bar) restyled in Paper.
- A visual reference the owner can view and comment on: a Lingaru Paper design-system page made with Claude's design tool, kept in sync with the code.

**Non-goals**

- Redesigning individual pages (Dashboard, Topics, Grammar, ...): later project.
- Regrouping navigation items: later project (the shell is restyled, its contents unchanged).
- Illustrations, a mascot, sound design.

**Anti-goals**

- A long-lived half-and-half app where old gradients clash with Paper (the token re-point must land as one step).
- Any page that stops working or becomes unreadable (contrast, overflow) after the re-point.
- Worse accessibility or a bigger bundle than today.
- Copying another product's visual identity: Duolingo is a reference for qualities (calm, one thing at a time, friendly feedback), not for its look.

## 3. Constraints

- React 19, Vite 8, Tailwind 3.4 today (`frontend/tailwind.config.js`, `frontend/src/index.css`). Tailwind 4 majors are deferred in Dependabot until this project.
- Pages use semantic Tailwind scales (`primary-*`, `accent-*`, `surface-*`, `success-*`, `danger-*`, `warn-*`, `info-*`, plus existing `paper-*`, `ink-*`) and shared component classes (`.card`, `.btn-*`, `.badge-*`, `.input`, `.section-label`, `.mode-*`). Many pages also hard-code pixel sizes and colours; those only change in the page redesign.
- Per-mode CSS variables (`--mode-grad-from`, `--mode-accent`, ...) drive gradients for the general/exam/agentic modes.
- Fonts already loaded: Inter, Instrument Serif (`font-editorial`), JetBrains Mono.
- Visual regression baselines (login, register) will change intentionally; they are regenerated with the `update_snapshots` workflow input.
- The app has a light/dark switch (`ThemeContext`, `darkMode: "class"`).

## 4. Approaches considered

1. **Tailwind 4, tokens as CSS variables, own components on accessible primitives (Radix; the shadcn/ui pattern).** Accessible dialogs, drawers, menus and tabs; tokens in one CSS file. Cost: Tailwind 3 to 4 touches class names app-wide (official upgrade tool does most of it).
2. **Stay on Tailwind 3, hand-build components.** Least churn now; accessible overlays hand-made (today's weak spot); the Tailwind 4 upgrade still comes later.
3. **Adopt a full component library (MUI, Mantine) themed Paper.** Fast start; fights a custom look, heavier bundle, clashes with Tailwind.

**Picked: 1, in stages** (controller's call; the owner handed over the how).

## 5. Design (decided)

### 5.1 Colour tokens

One palette for every mode (the mode changes content, not colours). Light values are from the chosen mockup; dark values are the controller's proposal, to be confirmed on the design-system page.

| Token | Light | Dark ("ink paper") | Use |
|---|---|---|---|
| `bg` | `#F6F3EC` | `#1A1916` | Page background |
| `surface` | `#FFFDF8` | `#23211D` | Cards, inputs |
| `line` | `#E4DDCF` | `#34312B` | Borders |
| `line-soft` | `#ECE6DA` | `#2B2925` | Row dividers |
| `text` | `#1D1B18` | `#EDE8DE` | Primary text |
| `text-2` | `#4A463F` | `#C9C2B5` | Secondary text |
| `text-3` | `#66615A` | `#A8A193` | Labels, captions (minimum for text) |
| `accent` | `#2340B8` | `#8FA6FF` | Primary actions, focus, the one highlight |
| `accent-strong` | `#1B3290` | `#B3C2FF` | Hover/pressed |
| `ok` / `ok-bg` / `ok-line` | `#2D5A3A` / `#EEF3EC` / `#CFDDCB` | `#7CC49A` / `#1F2A22` / `#2F4535` | Correct feedback only |
| `err` / `err-bg` | `#8A3B2E` / `#F7ECE8` | `#E58C74` / `#2E201C` | Wrong feedback, destructive |
| `warn` / `warn-bg` | `#7A5A12` / `#F6EFDD` | `#E2C06B` / `#2B261A` | Cautions |

All text/background pairs must meet WCAG AA (4.5:1 body, 3:1 large); the builder verifies each pair and adjusts shades, not the roles.

**Re-pointing the existing scales** so current pages turn Paper without edits: `primary-*` becomes a ramp around `accent`; `surface-*` and `paper-*` become the warm neutral ramp; `success-*`, `danger-*`, `warn-*`, `info-*` map to `ok`, `err`, `warn` and `accent`; the old coral `accent-*` scale maps to the blue `accent` ramp; the per-mode gradient variables resolve to flat Paper values (no gradients). Shared classes (`.card`, `.btn-*`, `.badge-*`, `.input`, `.section-label`, `.eyebrow-*`, `.mode-*`) are rewritten to Paper.

### 5.2 Type

- Display and headings: **Instrument Serif**, regular weight (italic allowed for a secondary line). Body and UI: **Inter** 400/500/600. Numbers in tables may use tabular Inter; JetBrains Mono stays for code-like labels only.
- Scale (px, line-height): `display` 40/1.05, `h1` 34/1.1, `h2` 26/1.15, `h3` 22/1.2 (serif); `body` 16/1.5, `body-lg` 17/1.5 for answers and prompts, `small` 14/1.45, `caption` 13/1.4, `overline` 11-12 uppercase, tracking 0.12-0.14em (Inter).

### 5.3 Space, shape, depth, motion

- Spacing on a 4 px base: 4, 8, 12, 16, 20, 24, 32, 48, 64.
- Radius: 10 (small controls, pills), 12 (buttons, inputs, feedback panels), 16 (cards), full (round icon buttons).
- Depth from borders, not shadows; one soft shadow reserved for overlays (dialogs, drawers, toasts).
- Motion: 150-200 ms ease-out for state changes and panels; no bounce, shake or confetti in everyday UI (one subtle celebration is allowed at session completion). Everything honours `prefers-reduced-motion`.
- Touch targets at least 44 px. Visible focus ring: 2 px `accent`, 2 px offset.

### 5.4 Components (built once, in `frontend/src/components/ui/`)

Button (primary, secondary, quiet, danger; sizes; loading; icon-only with label), IconButton, Card, Field (label, hint, error) with Input, Textarea, Select, Checkbox/Switch, Tabs, Dialog, Drawer (phone sheets), Toast, ProgressBar (single and segmented), FeedbackPanel (correct, nearly, wrong), Badge/Pill, EmptyState, Skeleton, PageHeader, and one icon set (line icons, `lucide-react`; controller's call). Interactive overlays and tabs use Radix primitives.

Each component has documented props, all states (hover, focus, disabled, loading, error), light and dark, and is shown on a dev-only gallery route (`/dev/ui`, not in production builds) instead of a separate Storybook (controller's call: lighter).

### 5.5 App shell

Desktop sidebar and phone top bar restyled in Paper: warm background, serif wordmark, quiet nav items with an accent indicator for the active one, the mode chip as a neutral pill. Nav contents and grouping unchanged in this project.

### 5.6 Stages

1. **Tailwind 4 upgrade** with the official upgrade tool; intended to be visually identical. Checked with a screenshot sweep of the key pages (light and dark) before and after.
2. **Tokens and re-point:** single token source (JSON) generating CSS variables, Tailwind theme mapping, shared classes, per-mode gradients flattened, plus the targeted edits listed in 5.8. A tokens-only design-system page is published first for the owner to confirm the dark palette. The whole app shifts to Paper in one change. Screenshot sweep again; fix contrast or breakage.
3. **Components and gallery.**
4. **Shell.**
5. **Reference and docs:** the Lingaru Paper design-system page (Claude's design tool) shows tokens and components; `docs/specs/design-system.md` and `docs/wiki/Frontend-Design-System.md` are updated; visual-regression baselines regenerated.

### 5.7 Success criteria

- Key pages (Dashboard, Topics, Flashcards, Assistant, Agents, Discover, News, Dictionary, Grammar, Exam Prep, Mini Games, Our Notes, My Notes, Progress, Settings, Login) render in Paper in light and dark with no broken layouts and no unreadable text (screenshot sweep reviewed).
- Lighthouse accessibility score not lower than today; every component keyboard-operable with visible focus.
- JS bundle not larger than today (Radix pieces are per-component).
- No per-mode gradients left; mode changes content only.

### 5.8 Decisions after the builder review (controller's calls)

- **Reach of the stage-2 re-point:** config-first. Besides the semantic scales, the theme also re-points Tailwind's default `purple`, `pink`, `violet`, `indigo`, `rose`, `amber` and the `ink` scale to Paper ramps, so the ~145 gradient utilities resolve to near-flat Paper tones without page edits. Targeted page edits in stage 2 are limited to: the Login/Register brand panel (a key page and visual-regression baseline), the `MODE_CARDS` and mode-switch celebration in `Settings.jsx`, and the per-mode favicons (one favicon for all modes). Everything else hard-coded (e.g. the Dashboard dark hero) waits for the page redesign. This supersedes the "hard-coded colours change only in the page redesign" line in section 3 for those three places.
- **Serif headings in stage 2:** only the `text-display`, `text-h1`, `text-h2`, `text-h3` tokens and `PageHeader` switch to Instrument Serif at weight 400 (bold classes on those are overridden to 400; no faux-bold). The global `h1`-`h6` base rule and smaller headings (`text-h4`, card titles) stay Inter. Old token names take the new sizes from 5.2 (e.g. body 15 to 16 px).
- **The design-system page:** a Claude "Design System" artifact for Lingaru Paper. Tokens have a single source in the repo (a JSON file that generates the CSS variables and the artifact's `tokens.json`), so future page-redesign mockups made with Claude's design tool use the real tokens. Components on that page are reference previews, not a bundled library (avoids a separate build and the canvas's React 18 vs the app's React 19). A Claude session republishes it whenever tokens change; the plan includes the command that regenerates `tokens.json`.
- **Approval gates:** a tokens-only first version of the design-system page (light and dark swatches, type scale, and the two chosen screens in dark) is published before stage 2 for the owner to confirm the dark palette. Each stage lands as its own PR with before/after screenshots in the description; the owner's merge is the gate.
- **FeedbackPanel states:** "correct" and "nearly" both use the `ok` panel, as in the chosen mockup ("Nearly. One word to check." in green, the wrong word struck through in `err`, the right word in bold `ok`); "wrong" uses `err-bg` with `err` text.

## 6. Left to the builder

- Exact ramp shades for re-pointed scales (within the token roles and AA contrast).
- Component APIs and file layout; which Radix packages.
- How the dev-only gallery is excluded from production.
- Order of shared-class rewrites and any compatibility aliases kept during the transition.
- The screenshot-sweep tooling (Playwright script against the local seeded app is enough).

## 7. Related

- Targeted daily session design: `docs/superpowers/specs/2026-11-23-targeted-daily-session-design.md` (built on this foundation).
- Current state: `docs/wiki/Frontend-Design-System.md`, `docs/specs/design-system.md` (targets T-1..T-14), issue #120 (design tokens and core components), #112 (accessible Dialog/Drawer), #113 (a11y fixes), #144 (React Compiler lint rules).
