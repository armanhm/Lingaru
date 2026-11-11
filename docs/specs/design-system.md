# Spec: Design System

Status: Current-state (reverse-engineered from code, 2026-11-11), with **Target** requirements for the planned design overhaul · Owner: @armanhm · Wiki: [Frontend Design System](../wiki/Frontend-Design-System.md)

Items labelled **Target** are not implemented. They describe what a future design system must meet. Everything else describes the code today.

## 1. Purpose & scope

**In scope:**

- Visual tokens: colour, type, radius, elevation, motion.
- Theming: light/dark plus the three audience modes.
- Shared component classes and React primitives.
- Iconography.
- Accessibility rules for visual design.

**Out of scope:**

- Page layouts and information architecture, except shared patterns.
- Copywriting and translation (see [Internationalization](../wiki/Internationalization.md)).

## 2. Requirements

### 2.1 Current state

| ID | Requirement |
|---|---|
| DS-1 | Colour, type, shadow, gradient and animation tokens are defined in `frontend/tailwind.config.js` (`theme.extend`). |
| DS-2 | Semantic component classes are defined in `frontend/src/index.css` under `@layer components` (§3.4). |
| DS-3 | Dark mode is class-based (`html.dark`). It is applied before first paint by an inline script in `index.html` and toggled by `ThemeContext`. |
| DS-4 | Audience mode is exposed as `html[data-mode]`. Chrome classes `.mode-*` read the `--mode-*` CSS variables (§3.2). |
| DS-5 | Shared React primitives live in `frontend/src/components/ui/` and are re-exported from `components/ui/index.js` (except `ComingSoonBadge` and `LearningLanguageFlag`, which are imported directly). |
| DS-6 | All interactive custom controls should apply `.focus-ring` (focus-visible ring, primary at 60%, 2px offset). |

### 2.2 Target requirements

These come from the Phase-0 audit.

| ID | Target |
|---|---|
| T-1 | **Target:** Colours are expressed as role tokens (CSS variables), not palette steps: `bg`, `surface`, `surface-elevated`, `fg`, `fg-muted`, `fg-subtle`, `border`, `brand`, `brand-contrast`, `accent`, `success`, `warn`, `danger`, `info`, `focus`. Tailwind maps to these variables. |
| T-2 | **Target:** Role tokens are defined per theme (light/dark) **and** per mode (general/exam/agentic), so mode re-tinting reaches primary buttons, links, active nav, focus rings and chat bubbles, not only the chrome. |
| T-3 | **Target:** One type scale of about 7 steps, used exclusively. Arbitrary `text-[Npx]` is disallowed by lint. Minimum rendered size is 12px for body and metadata (11px only for uppercase eyebrows). |
| T-4 | **Target:** A radius scale of 3 steps (`sm`, `md`, `lg`) plus `full`, with `md`/`lg` driven by `--mode-radius`. A defined elevation scale of 3 levels. A spacing rhythm documented per component. |
| T-5 | **Target:** Motion tokens (durations of 150/250/400 ms; standard, emphasised and exit easings). Every animation respects `prefers-reduced-motion: reduce`. No infinite decorative animation inside reading or working areas. |
| T-6 | **Target:** All text and UI component colours meet WCAG 2.1 AA contrast (4.5:1 for text, 3:1 for large text and UI boundaries) in both themes and all three modes. |
| T-7 | **Target:** A primitive library that covers: `Button` (variant × size × loading × icon), `IconButton` (required `label`), `Link`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch` (`role="switch"`), `Stepper`, `Field` (label, help and error wired with `useId`), `Card` (optional accent bar), `Dialog`, `Drawer`, `Popover`/`Menu`, `Tabs`, `Tooltip`, `Toast` (with action/undo), `Badge`/`Chip`, `Skeleton`, `EmptyState`, `ErrorState`, `ProgressBar`/`ProgressRing`, `Kbd`, `Eyebrow`. |
| T-8 | **Target:** `Dialog` and `Drawer` trap focus, close on Escape and on backdrop click, restore focus to the trigger, set `aria-modal`, and lock body scroll. |
| T-9 | **Target:** One icon set (for example lucide-react, tree-shaken) with a fixed stroke width and sizes 16/20/24. Emoji are reserved for content (scenario and game identity), not for chrome controls. |
| T-10 | **Target:** Shared patterns are documented and implemented once: page header, card list/grid, game shell (HUD, timer, lives, results), chat bubble and block card, editor split view, settings section. |
| T-11 | **Target:** Layouts tolerate strings about 30% longer than English (French UI) without truncating primary actions. |
| T-12 | **Target:** A component catalogue (Storybook or Ladle) renders every primitive in 2 themes × 3 modes, and visual regression snapshots the catalogue. |
| T-13 | **Target:** Hex literals and non-token Tailwind palettes (`purple-*`, `pink-*`, `amber-*`, ...) are disallowed in JSX by lint. |
| T-14 | **Target:** Fonts are self-hosted with `font-display: swap` and subsetting for Latin and French diacritics. |

## 3. Data model (token inventory, current state)

### 3.1 Colour scales (`tailwind.config.js`)

| Scale | Steps | Key values |
|---|---|---|
| `primary` | 50-950 | 500 `#6366f1`, 600 `#4f46e5`, 700 `#4338ca` |
| `accent` | 50-900 | 500 `#f07d1e`, 600 `#e16314` |
| `success` | 50-900 | 500 `#10b981` |
| `danger` | 50-900 | 500 `#f43f5e` |
| `warn` | 50-900 | 500 `#f59e0b` |
| `info` | 50-900 | 500 `#0ea5e9` |
| `surface` | 50-950 | 50 `#f8fafc`, 400 `#94a3b8`, 500 `#64748b`, 900 `#0f172a`, 950 `#020617` |
| `paper` | 50-600 | 50 `#fbfaf6` to 600 `#5d5848` |
| `ink` | 700-900 | 900 `#0f0f10` |

### 3.2 Mode variables (`index.css`, `@layer base`)

| Variable | general (default) | exam | agentic |
|---|---|---|---|
| `--mode-grad-from` | `#6366f1` | `#e11d48` | `#d97706` |
| `--mode-grad-to` | `#7c3aed` | `#b91c1c` | `#b45309` |
| `--mode-accent` | `#f07d1e` | `#dc2626` | `#ca8a04` |
| `--mode-shell-tint` | `rgba(99,102,241,.05)` | `rgba(225,29,72,.06)` | `rgba(217,119,6,.07)` |
| `--mode-radius` | `1rem` | `0.5rem` | `1.25rem` |

Consumers: `.mode-grad-bg`, `.mode-grad-band`, `.mode-grad-text`, `.mode-accent-text`, `.mode-shell`, `.mode-chip`, and the inline style in the Dashboard greeting. `--mode-radius` has no consumer.

### 3.3 Typography

| Token | Font size | Line height | Tracking | Weight |
|---|---|---|---|---|
| `display-xl` | 3.5rem | 1.05 | -0.03em | 800 |
| `display` | 2.75rem | 1.08 | -0.025em | 800 |
| `h1` | 2rem | 1.15 | -0.02em | 800 |
| `h2` | 1.5rem | 1.25 | -0.015em | 700 |
| `h3` | 1.25rem | 1.3 | -0.01em | 700 |
| `h4` | 1.0625rem | 1.35 | n/a | 600 |
| `body-lg` | 1rem | 1.6 | n/a | n/a |
| `body` | 0.9375rem | 1.55 | n/a | n/a |
| `caption` | 0.8125rem | 1.45 | n/a | n/a |
| `eyebrow` | 0.6875rem | 1 | 0.08em | 600 |

Families:

| Family | Stack |
|---|---|
| `sans`, `display` | Inter, then the system stack |
| `editorial` | Instrument Serif (ligatures off via `.font-editorial`) |
| `mono` | JetBrains Mono |

Fonts load from Google Fonts in `index.html`.

### 3.4 Component classes (`index.css`)

| Class | Definition summary |
|---|---|
| `.card` | `bg-white` / `dark:bg-surface-900/80`, `rounded-2xl`, `shadow-card`, `border-surface-100` |
| `.card-hover` | hover `shadow-card-hover`, `-translate-y-0.5` |
| `.card-elevated` | `rounded-3xl`, `shadow-card-elevated`, `backdrop-blur-xl` |
| `.btn` | inline-flex, `rounded-xl`, semibold, `focus-ring`, `active:scale-[.98]`, disabled 50% opacity |
| `.btn-primary` / `-accent` / `-danger` / `-success` | Gradient fills plus a glow shadow on hover |
| `.btn-secondary` / `-ghost` | Neutral fills |
| `.btn-sm` / `-md` / `-lg` / `-xl` | Padding and text size |
| `.badge` + 7 tones | `rounded-full`, `text-xs`, semibold |
| `.input`, `.input-error` | `rounded-xl`, `px-4 py-2.5`, primary focus ring |
| `.section-label`, `.eyebrow-primary` | `text-eyebrow uppercase` |
| `.stat-pill`, `.kbd`, `.divider-label`, `.focus-ring` | Helpers |

### 3.5 Elevation, radius, gradients

| Group | Tokens |
|---|---|
| Shadows | `card`, `card-hover`, `card-elevated`, `glow-primary`, `glow-success`, `glow-danger`, `glow-accent`, `inner-highlight` |
| Radius overrides | `2xl` 1rem, `3xl` 1.25rem, `4xl` 2rem |
| Background images | `gradient-primary`, `gradient-accent`, `gradient-success`, `gradient-mesh`, `shimmer` |

### 3.6 Motion

| Group | Keyframes |
|---|---|
| Entrance | `fade-in` (0.3 s), `fade-in-up` (0.4 s), `slide-in-{left,right}` (0.35 s), `slide-in-down`, `scale-in`, `pop-in`, `soft-zoom`, `bounce-in` |
| Feedback | `shake`, `confetti-pop`, `confetti-fall`, `count-up`, `progress-fill` |
| Infinite | `pulse-glow`, `recording-pulse`, `shimmer`, `float`, `gradient-shift`, `spin-slow` (22 s), `flame`, `pulse-soft` |
| Mode switch | `mode-pop`, `mode-ripple-1`, `mode-ripple-2`, `mode-wash` |

JS helpers in `hooks/useAnimations.js`: `useCountUp`, `staggerDelay`.

### 3.7 React primitives (`components/ui/`)

| Component | Props |
|---|---|
| `PageHeader` | `eyebrow, title, subtitle, backTo, backLabel="Back", actions, icon, gradient` |
| `EmptyState` | `icon="✨", title, subtitle, action, tone="neutral"\|"success"\|"info"\|"warn"` |
| `Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonCircle`, `SkeletonGrid` | size and count props |
| `Confetti` | `count=40, duration=1500` |
| `TriumphHero` | `emoji, headline, subline, stats[], actions, celebrate, tone="celebratory"\|"neutral"\|"retry"` |
| `ComingSoonBadge` | `available, children` |
| `LearningLanguageFlag` | `language` |

Related components outside `ui/`: `Toast` (via `ToastContext`), `AudioPlayButton`, `InlineRoundWidget`.

## 4. API contract

Not applicable. The design system has no server API. The only runtime inputs are `user.mode` (via `ModeContext` → `data-mode`) and the saved theme.

## 5. Business rules & invariants

- Theme and mode are orthogonal. Any mode can render in light or dark.
- Mode colours must stay consistent between `index.css` (`--mode-*`) and any UI that previews them. Today `Settings.jsx` `MODE_CARDS` duplicates them as hex, so they must be kept in sync by hand.
- New colours and sizes go into `tailwind.config.js` or `index.css`, not inline in JSX (current convention; to be enforced by T-13).
- Emoji identity is fixed per concept (for example 🔤 Word Scramble, 🃏 Match Pairs, ⚡ Gender Snap).

### Measured adoption (Phase-0 audit, 2026-11-11)

| Metric | Value |
|---|---|
| Arbitrary `text-[Npx]` sizes | 406 uses, 23 distinct values |
| Type tokens (`text-h*`, `text-body`, `text-caption`, ...) | 169 uses |
| `.btn-*` class uses | 87 |
| Hand-rolled `bg-primary-600 text-white` buttons | 17+ |
| Off-token palette classes | ~180 (`purple` 127, `pink` 27, `amber` 14, others) in 26 files |
| Hex literals in JSX | 18 (3 files) |
| `rounded-*` usage | xl 188, full 169, lg 136, 2xl 83, md 37, 3xl 17 |
| Emoji used as icons | ~310 |
| Inline `<svg>` icons | 152 (plus 3 local icon maps) |
| `text-surface-300/400` usages | ~540 |
| Animation class usages | 263; reduced-motion handling: none |
| Full-screen overlays | 12; with dialog semantics: 4 |

## 6. Background jobs

None.

## 7. Dependencies

| Dependency | Use |
|---|---|
| tailwindcss 3.4 | Tokens and utilities |
| @tailwindcss/typography | `prose` for Markdown |
| postcss, autoprefixer | CSS pipeline |
| Google Fonts | Inter, Instrument Serif, JetBrains Mono |
| `ThemeContext`, `ModeContext` | Runtime theme and mode switching |

## 8. Deviations / open questions

- Two parallel type systems (tokens vs arbitrary pixel sizes). Assistant, Dashboard and Settings use mostly pixel sizes.
- `purple`/`pink` act as an undeclared second brand colour (user chat bubble, Login panel, Assistant send button).
- Mode theming stops at the chrome. `--mode-radius` is unused, and primary actions stay indigo in exam and agentic modes.
- At least four visual variants of a "primary button" coexist.
- No shared Dialog, Drawer, Switch, Field or Icon primitives. Settings and Assistant define private versions.
- No `prefers-reduced-motion` support, despite infinite animations on the Dashboard (`spin-slow`, `flame`, `pulse`).
- Small low-contrast metadata (`surface-400` at 9-10px) appears widely.
- `ComingSoonBadge` uses non-token `amber-*` classes.
- `tailwind.config.js` uses `require()` inside an ESM module. It works only because Tailwind loads configs via jiti.
- **Open question:** keep the gradient-heavy "glow" aesthetic, or move to flatter surfaces in the overhaul?
- **Open question:** should modes differ only in colour and radius, or also in density and typography?
