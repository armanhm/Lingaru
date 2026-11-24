# Spec: Design System

Status: Current (the "Paper" design foundation, delivered in five stacked stages, 2026-11) · Owner: @armanhm · Wiki: [Frontend Design System](../wiki/Frontend-Design-System.md)

This spec describes the design system as it exists in code. Section 2.2 records what happened to each target (T-1 to T-14) that the Phase-0 audit set before the overhaul. The audit's original measurements are kept in section 5 as the "before" picture.

## 1. Purpose & scope

**In scope:**

- Visual tokens: colour, type, radius, spacing, motion.
- Theming: light/dark, and how the audience modes relate to it.
- The React component library in `frontend/src/components/ui/`.
- The app shell (`Layout`).
- Accessibility rules for visual design.

**Out of scope:**

- Page layouts and information architecture, except shared patterns.
- Copywriting and translation (see [Internationalization](../wiki/Internationalization.md)).

## 2. Requirements

### 2.1 Current state

| ID | Requirement |
|---|---|
| DS-1 | There is one token source, `frontend/src/design/tokens.json`. `npm run tokens` generates `frontend/src/design/tokens.css` (Tailwind 4 `@theme` ramps, fonts and type sizes, the `--pp-*` role variables, the serif heading utilities) and `frontend/design/paper.tokens.json` (the input of the design-system page). Generated files are never edited by hand; CI runs `npm run tokens -- --check`. |
| DS-2 | Tailwind 4 is configured in CSS, not in `tailwind.config.js` (which no longer exists). `frontend/src/index.css` imports the tokens, declares the animation and shadow tokens, and holds the legacy component classes and the base layer (§3.7). |
| DS-3 | Dark mode is class-based (`html.dark`). It is applied before first paint by an inline script in `index.html` and toggled by `ThemeContext`. Role utilities (`bg-canvas`, `text-fg`, ...) flip through the `--pp-*` variables, so they need no `dark:` variant. |
| DS-4 | There is one palette for every audience mode (general, exam, agentic). Modes change content (navigation, landing page), never colours. `ModeContext` still sets `html[data-mode]`; the `--mode-*` variables and `.mode-*` classes remain only so old markup keeps working and are flat Paper colours (§3.7). |
| DS-5 | Shared primitives live in `frontend/src/components/ui/` and are exported from `components/ui/index.js` (except `ComingSoonBadge` and `LearningLanguageFlag`, which are imported directly from their files). |
| DS-6 | All interactive controls show the focus ring: 2 px `accent`, 2 px offset (`ring-offset-canvas`; the offset is canvas-coloured even on cards and dialogs, a known cosmetic gap). Inside clipped scroll containers the ring is drawn inset. |
| DS-7 | `prefers-reduced-motion: reduce` is honoured globally by an unlayered rule at the end of `index.css`: animation and transition durations drop to 0.01 ms and iteration counts to 1. Components also add `motion-reduce:` utilities. |
| DS-8 | A dev-only gallery at `/dev/ui` renders every `ui/` component in every state, light and dark side by side. It exists only on the dev server (§3.9). |

### 2.2 Status of the Phase-0 targets

| ID | Target (short) | Status | What exists, or what remains |
|---|---|---|---|
| T-1 | Colours as role tokens that Tailwind maps to | **Delivered** | 18 semantic roles in `tokens.json` (`canvas`, `card`, `line`, `fg`, `accent`, `ok`, `err`, `warn`, ...). Names differ from the original proposal (`canvas` not `bg`, `fg-2`/`fg-3` not `fg-muted`/`fg-subtle`). Old palette names are aliased onto the new ramps (§3.2), so unmigrated pages still render in Paper colours. |
| T-2 | Role tokens per theme and per mode | **Superseded** | Per theme: delivered (light and dark values for every role). Per mode: replaced by the decision "one palette for every mode; modes change content, not colours", so no per-mode tinting exists or is planned. |
| T-3 | One type scale of about 7 steps; lint against `text-[Npx]` | **Partly delivered** | The scale exists (§3.3) and the shell and `ui/` components use it exclusively. Page code still contains arbitrary `text-[Npx]` sizes, and no lint rule forbids them. Remains: the page redesign, then the lint rule. |
| T-4 | 3-step radius scale driven by `--mode-radius`; 3-level elevation scale; spacing rhythm | **Partly delivered, partly superseded** | Radius (10/12/16/full) and the 4 px spacing scale are in `tokens.json` (§3.4). `--mode-radius` is superseded (no per-mode shape; the variable stays at `1rem`, unused). The 3-level elevation scale is superseded: depth comes from borders, with one soft overlay shadow (§3.4). Per-component spacing is documented only through the components themselves. |
| T-5 | Motion tokens; all animation honours reduced motion; no decorative infinite animation in working areas | **Partly delivered** | Motion is 150 ms (controls) and 200 ms (bars, colour), `ease-out`; the global reduced-motion rule and `motion-reduce:` utilities are in place; the library has no bounce, shake or confetti. The old keyframes (`pulse-glow`, `flame`, `spin-slow`, ...) still exist for page code, so decorative loops remain on some pages until the redesign. |
| T-6 | WCAG AA contrast in both themes and all modes | **Delivered** (for tokens) | `tokens.json` lists 23 `contrastPairs` and 12 `rampContrastPairs`; `scripts/tokens/contrast.test.mjs` fails the unit tests when one drops below its minimum (4.5:1 text, 3:1 input borders). The sweep counts axe `color-contrast` violations per page. Page-level hard-coded colours are checked only by the sweep (§8). |
| T-7 | Primitive library | **Partly delivered** | Delivered: `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Field`, `Card`, `Dialog`, `Drawer`, `Tabs`, toast (`ToastContext`), `Badge`, `Skeleton*`, `EmptyState`, `ProgressBar`, `SegmentedProgress`, `FeedbackPanel`, `PageHeader`. Not built: `Link`, `Stepper`, `Popover`/`Menu`, `Tooltip`, `ErrorState`, `ProgressRing`, `Kbd`, `Eyebrow` (the `.kbd` and `.eyebrow-primary` CSS classes cover the last two), and toast action/undo. |
| T-8 | Dialog and Drawer trap focus, close on Escape and backdrop, restore focus, `aria-modal`, lock scroll | **Delivered** (components) | Both are built on Radix Dialog with focus restore for controlled use (`overlay.js`) and are tested. Migration has not started: no page uses them yet, and six overlays are still hand-built (`OnboardingModal`, `AIResultModal`, `MyNotesEdit`, `Settings`, `AgentRun`, and a local `Drawer` defined inside `Assistant.jsx`). The shell's phone menu is a hand-built modal dialog (§8). |
| T-9 | One icon set; emoji only for content | **Partly delivered** | `lucide-react` is the icon set; the shell and the `ui/` components use it with `aria-hidden`. The shell has no emoji in its chrome. Pages still use emoji and inline SVG icons. |
| T-10 | Shared patterns (page header, game shell, chat bubble, editor split, settings section) | **Open** | Only `PageHeader` and `TriumphHero` exist. The rest waits for the page redesign. |
| T-11 | Layouts tolerate strings about 30 % longer | **Open** | No explicit work or check. The sweep's horizontal-overflow count catches the worst cases only at 390 px width in English. |
| T-12 | Component catalogue (Storybook or Ladle), with visual regression | **Superseded** | Replaced by the dev-only gallery route `/dev/ui` (no Storybook or Ladle), guarded out of production builds by `npm run check:build`. Visual regression is Playwright snapshots of `/login` and `/register` plus the manual screenshot sweep (`npm run sweep`); the gallery itself is not snapshotted. |
| T-13 | Lint against hex literals and off-token palette classes | **Open** | No such lint rule. The aliases (§3.2) make off-token palette classes render in Paper colours instead of being forbidden. |
| T-14 | Self-hosted, subsetted fonts with `font-display: swap` | **Open** | Fonts still load from Google Fonts through `<link>` tags in `index.html` (with `display=swap` in the URL). |

## 3. Data model (token inventory)

### 3.1 Semantic roles

Defined in `tokens.json` under `semantic`, emitted as `--pp-<role>` on `:root` and `.dark`, and exposed to Tailwind as `--color-<role>` (so `bg-canvas`, `text-fg-2`, `border-line`, ...).

| Role | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#F6F3EC` | `#1A1916` | Page background |
| `card` | `#FFFDF8` | `#23211D` | Cards, panels, inputs |
| `line` | `#E4DDCF` | `#34312B` | Default borders and dividers |
| `line-soft` | `#ECE6DA` | `#2B2925` | Subtle dividers inside cards, bar tracks |
| `line-strong` | `#8A8374` | `#7D766A` | Input borders and strong outlines (3:1) |
| `fg` | `#1D1B18` | `#EDE8DE` | Primary text |
| `fg-2` | `#4A463F` | `#C9C2B5` | Secondary text |
| `fg-3` | `#66615A` | `#A8A193` | Tertiary text, hints, captions |
| `accent` | `#2340B8` | `#8FA6FF` | Links, primary actions, focus rings |
| `accent-strong` | `#1B3290` | `#B3C2FF` | Hover and pressed state of accent |
| `on-accent` | `#FFFFFF` | `#14130F` | Text and icons on accent fills |
| `ok` | `#2D5A3A` | `#7CC49A` | Success text and icons |
| `ok-bg` | `#EEF3EC` | `#1F2A22` | Success panel background |
| `ok-line` | `#CFDDCB` | `#2F4535` | Success panel border |
| `err` | `#8A3B2E` | `#E58C74` | Error text and icons |
| `err-bg` | `#F7ECE8` | `#2E201C` | Error panel background |
| `warn` | `#7A5A12` | `#E2C06B` | Warning text and icons |
| `warn-bg` | `#F6EFDD` | `#2B261A` | Warning panel background |

### 3.2 Generated ramps and old-scale aliases

`tokens.json` `ramps` define five 50-950 ramps: `surface` (warm neutrals), `accent`, `ok`, `err` and `warn`, emitted as `--color-<ramp>-<step>`. Step 600 or 700 equals the light role value and step 300 the dark one (`accent-600` `#2340B8`, `accent-300` `#8FA6FF`). The ramps share their names with the roles, so ramp utilities such as `bg-ok-100` sit next to `bg-ok`.

`aliases` keep the previous palette names working by pointing each step at a Paper ramp, so pages that were never migrated still render in Paper colours:

| Old name | Points at |
|---|---|
| `primary`, `info`, `purple`, `violet`, `indigo`, `pink` | `accent` |
| `paper`, `ink` | `surface` |
| `success` | `ok` |
| `danger`, `rose` | `err` |
| `amber` | `warn` |

New code uses the role utilities, not ramps or aliases. Dark-mode ramp steps are still used by unmigrated pages through `dark:` variants.

### 3.3 Typography

Source: `tokens.json` `type`.

| Token | Size / line-height | Family | Weight |
|---|---|---|---|
| `text-display`, `text-display-xl` | 40 px / 1.05 | Instrument Serif | 400 |
| `text-h1` | 34 px / 1.1 | Instrument Serif | 400 |
| `text-h2` | 26 px / 1.15 | Instrument Serif | 400 |
| `text-h3` | 22 px / 1.2 | Instrument Serif | 400 |
| `text-h4` | 17 px / 1.35 | Inter | 600 |
| `text-body-lg` | 17 px / 1.5 | Inter | 400 |
| `text-body` | 16 px / 1.5 | Inter | 400 |
| `text-small` | 14 px / 1.45 | Inter | 400 |
| `text-caption` | 13 px / 1.4 | Inter | 400 |
| `text-eyebrow` | 11.5 px / 1.2, tracking 0.13em | Inter | 600 |

Rules:

- The serif applies only through `text-display`, `text-display-xl`, `text-h1`, `text-h2` and `text-h3`. Those utilities force weight 400 (`!important`), so a stray `font-bold` cannot fake a bold serif.
- Plain `h1` to `h6` elements are Inter with tight tracking; they are not serif unless a heading utility is applied.
- Fonts: `font-sans` and `font-display` are Inter; `font-editorial` is Instrument Serif; `font-mono` is JetBrains Mono, used only for code-like labels.
- Eyebrows are uppercase (`text-eyebrow uppercase`).

### 3.4 Radius, spacing, depth, motion

| Group | Values |
|---|---|
| Radius | `sm` 10 px (small controls, pills), `md` 12 px (buttons, inputs, feedback panels; `rounded-xl`), `lg` 16 px (cards, dialogs; `rounded-2xl`), `full` (round icon buttons). `index.css` also keeps `rounded-3xl` 1.25rem and `rounded-4xl` 2rem for old page markup. |
| Spacing | 4 px base: 4, 8, 12, 16, 20, 24, 32, 48, 64 px. |
| Depth | Borders (`border-line`). One soft shadow, `shadow-card-elevated`, only on overlays: `Dialog`, `Drawer`, toasts and the user dropdown. The scrim is `rgb(20 18 15 / 0.55)` (`SCRIM` in `ui/overlay.js`). `shadow-card*` and `shadow-glow-*` tokens are retained for old page markup, recoloured to warm ink. |
| Motion | 150 ms for controls, 200 ms for bars and colour, `ease-out`. No bounce, shake or confetti in the library. |

### 3.5 Components (`components/ui/`)

See §4 for the accessibility guarantees. Wiki page [Frontend Design System](../wiki/Frontend-Design-System.md) has props and examples.

| Component | Purpose |
|---|---|
| `Button` | Variants `primary`, `secondary`, `quiet`, `danger`; sizes `sm`, `md`, `lg`; `loading`, `iconLeft`, `iconRight`, `asChild`. |
| `IconButton` | Round icon-only button; `label` is required. |
| `Input`, `Textarea`, `Select` | Text controls on a shared base (44 px high, 16 px text). `Select` is a native `<select>` with a chevron. |
| `Checkbox`, `Switch` | Native tinted checkbox; Radix switch with optional visible label. |
| `Field` | Wires label, hint and error to one control. |
| `Card` | Flat bordered surface; `padding`, `as`, `interactive`. |
| `Badge` | Status pill; tones `neutral`, `accent`, `ok`, `err`, `warn`. |
| `Dialog`, `Drawer` | Radix-based modal and edge panel (`side="bottom"` or `"right"`). |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Radix tabs. |
| `ProgressBar`, `SegmentedProgress` | Single and weighted multi-segment progress. |
| `FeedbackPanel` | Answer feedback (`correct`, `nearly`, `wrong`) with a polite live announcement. |
| `EmptyState`, `PageHeader`, `TriumphHero`, `Confetti`, `Skeleton*` | Screen-level and loading patterns, carried over and restyled. |
| `ComingSoonBadge`, `LearningLanguageFlag` | Small helpers imported directly, not through `index.js`. |
| `cx` | Class-name joiner (exported from `index.js`). |

Toasts are not in `ui/`: `ToastContext` (`useToast().showToast(message, type, duration)`) renders a bordered card with the overlay shadow and separate always-mounted screen-reader regions (polite for most, assertive for errors).

### 3.6 App shell (`components/Layout.jsx`)

- Desktop (`md`, 48 rem, and up): a sidebar on `canvas` with a right border, 15 rem wide or a 4 rem icon rail when collapsed. The wordmark "Lingaru" is serif (`text-h3`). Navigation items are 40 px high on desktop and 44 px on phones; the active item has a 2 px accent bar and `aria-current="page"`. The collapsible "Practice" section remembers its state in `localStorage` (`lingaru.sidebar.collapsedSections.v1`). The user menu holds the dark-mode switch, Settings and Log out.
- Phone: a header with a menu button and the wordmark. The menu opens a modal dialog (hand-built `MobilePanel`): the rest of the app is `inert`, focus is trapped, Escape and the scrim close it, body scroll is locked, focus returns to the opener, and it closes if the viewport grows to desktop width.
- A skip link ("skip to content") focuses `<main id="main-content">`. The Assistant route renders edge to edge; other routes sit in a `max-w-7xl` container.
- The mode appears as a neutral `Badge` next to the wordmark; it does not tint the shell.

### 3.7 Legacy classes and the CSS structure

`index.css` keeps the old component classes (`.card`, `.btn-*`, `.badge-*`, `.input`, `.eyebrow-primary`, `.mode-*`, `.glass`, `.skeleton`, ...) re-pointed at Paper colours: flat fills, no gradients, no glow. They exist so unmigrated pages work and are not for new code. The `--mode-*` variables are flat copies of `--pp-accent`, `--mode-shell-tint` is `transparent` and `--mode-radius` is unused.

The order of `index.css` matters (Tailwind 4 layer set-up, preflight, tokens, `@theme`, the `space-y` and dark variant shims, then the `@layer utilities` block that stands in for Tailwind 3's component layer, then `@layer base`, then the unlayered reduced-motion rule). The file's comments explain each step; do not reorder it.

### 3.8 Tooling

| Command (in `frontend/`) | Purpose |
|---|---|
| `npm run tokens` | Regenerate `tokens.css` and `paper.tokens.json` from `tokens.json`. |
| `npm run tokens -- --check` | Fail if generated files are stale. Run in CI. |
| `npm run check:build` | Fail if the gallery marker `data-ui-gallery` is in `dist/assets/*.js` (run after `npm run build`). |
| `npm run sweep` | Screenshot, contrast and style-probe sweep (see [Testing and CI](../wiki/Testing-and-CI.md)). |

### 3.9 Dev gallery

`/dev/ui` is registered in `App.jsx` only when `import.meta.env.DEV` is true, as a lazy chunk, so production builds drop it. It shows each component in light and dark columns. Dialogs, drawers and toasts portal to the body, so they follow the page theme, not a column.

## 4. Rules and accessibility guarantees

Rules for all new UI code:

- Use role utilities (`bg-canvas`, `bg-card`, `text-fg`, `text-fg-2`, `text-fg-3`, `border-line`, `text-accent`, ...). Do not use `dark:` variants together with semantic tokens: the tokens already flip with `.dark`.
- No gradients and no coloured glows. Depth comes from borders; only overlays carry a shadow.
- No emoji in chrome (navigation, buttons, controls). Emoji are allowed as content (for example a game's identity). Icons come from `lucide-react`, marked `aria-hidden` when decorative.
- Touch targets are at least 44 px. Where a control looks smaller (`Button` and `IconButton` `size="sm"` are 36 px, `Switch` is 28 px tall), an invisible overlay extends the hit area to 44 px.
- Focus ring: 2 px `accent` with a 2 px offset on every interactive element, keyboard focus only (`focus-visible`).
- Text colours meet 4.5:1 and input borders and focus rings 3:1 against their background; token pairs are checked by unit tests.
- No arbitrary font sizes: use the type scale. Serif only through the heading utilities.
- Respect reduced motion: animations use `motion-reduce:` variants or rely on the global rule.

Guarantees by component:

| Component | Guarantee |
|---|---|
| `Button` | 44 px hit area; `loading` keeps the width, sets `aria-busy` and disables the button; with `asChild`, a disabled or loading button is `aria-disabled`, inert and swallows clicks. |
| `IconButton` | `label` is the accessible name; the dev build logs an error when it is missing. |
| `Field` | Generates ids; `aria-describedby` points to the hint and error; `aria-invalid` follows `error`. |
| `Input`, `Textarea`, `Select` | 16 px text (no iOS zoom on focus), 3:1 border, `aria-invalid` turns the border to `err`. |
| `Checkbox`, `Switch` | 44 px target (the Checkbox wrapper is a `<label>`, so a tap anywhere in it toggles the box; its focus indicator is an outline); `Switch` is a Radix `role="switch"` with `aria-checked`. |
| `Dialog`, `Drawer` | Focus trap, Escape and outside click close, scroll lock, focus restore to the opener, `title` is the accessible name, clicks on toasts do not close them. |
| `Tabs` | Roving focus and arrow keys (Radix); 44 px triggers; the focus ring is drawn inset because the list clips vertically. |
| `ProgressBar`, `SegmentedProgress` | `role="progressbar"` with `aria-valuemin`, `aria-valuemax` and `aria-valuenow`; values are clamped to 0..1. |
| `FeedbackPanel` | Verdict announced once through a polite live region that is set after mount and cleared; use `announceKey` to repeat an identical verdict for a new question. |
| `Skeleton` | `aria-hidden`; the pulse stops under reduced motion. |
| `EmptyState` | Icon is `aria-hidden`. |
| Toast | Visible stack is not a live region; separate polite and assertive regions announce each toast once; dismiss button is 44 px. |

## 5. Business rules & invariants

- Theme (light/dark) is the only thing that changes colours. The audience mode changes content only.
- `tokens.json` is the only place token values are edited. The generated `tokens.css` and `paper.tokens.json` are committed so the app and the design-system page work without a build step, and CI fails if they drift.
- The design-system page is a private page owned by the project owner that reads `paper.tokens.json`; it is republished from a Claude Code session after token changes.
- Emoji identity is fixed per content concept (for example Word Scramble, Match Pairs, Gender Snap).

### Phase-0 audit: the "before" picture (2026-11-11)

Kept for reference; these figures describe `main` before the overhaul and will not be re-measured here.

| Metric | Value |
|---|---|
| Arbitrary `text-[Npx]` sizes | 406 uses, 23 distinct values |
| Off-token palette classes | about 180 (`purple` 127, `pink` 27, `amber` 14) in 26 files |
| Hex literals in JSX | 18 (3 files) |
| Emoji used as icons | about 310 |
| Animation class usages | 263; reduced-motion handling: none |
| Full-screen overlays | 12; with dialog semantics: 4 |

## 6. Background jobs

None.

## 7. Dependencies

| Dependency | Use |
|---|---|
| `tailwindcss` 4 and `@tailwindcss/vite` | Utilities and the CSS-first theme |
| `@tailwindcss/typography` | `prose` for Markdown (loaded with `@plugin`) |
| `@radix-ui/react-dialog`, `-switch`, `-tabs`, `-slot` | Behaviour for `Dialog`, `Drawer`, `Switch`, `Tabs`, `Button asChild`. The toast is hand-built in `ToastContext`. |
| `lucide-react` | Icons |
| Google Fonts | Inter, Instrument Serif, JetBrains Mono (see T-14) |
| `ThemeContext`, `ModeContext` | Runtime theme and `data-mode` |
| `@axe-core/playwright`, `pixelmatch` | The sweep tool (dev only) |

## 8. Known gaps

- **Page-level styles:** many pages still carry hard-coded sizes, palette classes, `dark:` pairs and emoji icons. The aliases keep them on-palette, but they are not on the type scale and are only checked by the sweep. The page redesign removes them; the lint rules of T-3 and T-13 come after.
- **Spinners under reduced motion:** loading spinners (`animate-spin motion-reduce:animate-none`) stop and show a static arc rather than an alternative indicator.
- **One JS chunk:** the app ships a single JavaScript bundle. `Dialog`, `Drawer`, `Tabs` and `Switch` pull in Radix, adding about 15 kB gzip the first time a page imports them. Route-level code splitting (issue #81) should come first, so that cost lands only on pages that use them.
- **Shell phone menu:** for the same reason the phone menu is a hand-built modal dialog (focus trap, Escape, scroll lock, `inert` background) instead of `Drawer`.
- **Overlays not migrated:** no page uses the new `Dialog`/`Drawer` yet; see T-8 for the six hand-built overlays.
- **Fonts:** see T-14.
