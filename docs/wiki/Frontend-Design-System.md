# Frontend Design System

> How Lingaru's "Paper" look is built and how to use it: one token source, semantic Tailwind utilities, the `components/ui/` library, the dev gallery, and how to change a token and republish the design-system page. Audience: anyone writing frontend code.

**Code:** `frontend/src/design/tokens.json`, `frontend/scripts/tokens/`, `frontend/src/index.css`, `frontend/src/components/ui/`, `frontend/src/components/Layout.jsx`, `frontend/src/pages/dev/`, `frontend/src/contexts/{ThemeContext,ModeContext}.jsx` · **Spec:** [specs/design-system.md](../specs/design-system.md) · **Related:** [Frontend Architecture](Frontend-Architecture.md), [Testing and CI](Testing-and-CI.md)

## Overview

```mermaid
flowchart TD
  TJ[src/design/tokens.json<br/>the only place to edit] -->|npm run tokens| TC[src/design/tokens.css<br/>generated]
  TJ -->|npm run tokens| PT[design/paper.tokens.json<br/>generated]
  TC --> IC[src/index.css<br/>@import + legacy classes + base]
  IC --> U[Utilities: bg-canvas text-fg-2 border-line text-h1 ...]
  TH[ThemeContext toggles html.dark] --> TC
  U --> UI[components/ui/*]
  UI --> P[Pages and Layout]
  PT --> DP[Design-system page<br/>private to the owner]
```

The look is calm and warm: a paper-coloured canvas, flat bordered cards, one blue accent, serif headings. There are three ideas to hold on to:

1. **Roles, not shades.** Colours are named by what they do (`canvas`, `card`, `fg`, `accent`, `err`), and they flip between light and dark on their own.
2. **One palette for every mode.** The audience modes (general, exam, agentic) change content, never colours.
3. **Depth from borders.** Cards are flat with a `border-line`; only overlays (dialogs, drawers, toasts, the user menu) carry the one soft shadow.

## Key concepts

| Term | Meaning |
|---|---|
| **Theme** | Light or dark. Class-based: `ThemeContext` toggles `html.dark` and saves it; an inline script in `index.html` applies it before first paint. |
| **Role token** | A semantic colour such as `canvas` or `fg-2`. `tokens.json` holds a light and a dark value; `--pp-*` CSS variables switch with `.dark`; Tailwind exposes them as `bg-canvas`, `text-fg-2` and so on. |
| **Ramp** | A 50-950 scale (`surface`, `accent`, `ok`, `err`, `warn`) generated from `tokens.json`. Used for old markup and rare fills. |
| **Alias** | An old palette name (`primary`, `purple`, `pink`, `danger`, ...) pointing at a Paper ramp, so unmigrated pages stay on-palette. Do not use in new code. |
| **Gallery** | The dev-only page `/dev/ui` that shows every component. |

## How it works

### Using tokens

Use role utilities. They already handle dark mode, so write no `dark:` variant next to them.

| Need | Utility |
|---|---|
| Page background | `bg-canvas` |
| Card, panel, input background | `bg-card` |
| Borders | `border-line` (default), `border-line-soft` (inside cards), `border-line-strong` (input outlines) |
| Text | `text-fg` (primary), `text-fg-2` (secondary), `text-fg-3` (hints, captions) |
| Links, primary actions, focus ring | `text-accent`, `bg-accent` with `text-on-accent`, hover `bg-accent-strong` |
| Success / error / warning | `text-ok` `bg-ok-bg` `border-ok-line`; `text-err` `bg-err-bg`; `text-warn` `bg-warn-bg` |

Light and dark values are listed in the [spec](../specs/design-system.md) (section 3.1); the source is `frontend/src/design/tokens.json`.

Type utilities (size and line-height set together):

| Utility | Use |
|---|---|
| `text-display`, `text-h1`, `text-h2`, `text-h3` | Serif headings (Instrument Serif, weight 400; `font-bold` has no effect) |
| `text-h4` | Inter 600, small headings |
| `text-body-lg`, `text-body`, `text-small`, `text-caption` | Inter text, 17 / 16 / 14 / 13 px |
| `text-eyebrow uppercase` | Small uppercase labels |

Other rules: no arbitrary sizes such as `text-[13px]`; no gradients; no emoji in chrome (icons come from `lucide-react`, with `aria-hidden` when decorative); interactive things are at least 44 px; use `rounded-xl` for controls and `rounded-2xl` for cards; spacing is the 4 px Tailwind scale; transitions are `duration-150 ease-out` with `motion-reduce:` variants for anything that moves.

Focus ring, if you build a custom control: `focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas`. Inside a scroll container that clips, use `focus-visible:ring-inset` and drop the offset.

### Using components

Import from the index:

```jsx
import { Button, IconButton, Card, Field, Input, Dialog, Badge } from "../components/ui";
```

Two helpers are imported from their own files: `ComingSoonBadge` and `LearningLanguageFlag`.

| Component | Key props | Notes |
|---|---|---|
| `Button` | `variant` (`primary`, `secondary`, `quiet`, `danger`), `size` (`sm`, `md`, `lg`), `loading`, `iconLeft`, `iconRight`, `asChild` | `type` defaults to `"button"`. `asChild` renders its child (for example a router `Link`) with the button classes; icons and the spinner are not supported there. |
| `IconButton` | `label` (required), `icon`, `variant` (`quiet`, `secondary`, `primary`, `danger`), `size` | `icon` is an element or a component such as a lucide icon. |
| `Input`, `Textarea`, `Select` | native props; `Textarea` has `size="lg"`; `Select` takes `wrapperClassName` | 44 px tall, 16 px text. |
| `Checkbox`, `Switch` | native props; `Switch` has `checked`, `onCheckedChange`, `label` | Inside a `Field`, leave out `Switch`'s `label`. |
| `Field` | `label`, `hint`, `error`, `id` | One child. Adds `id`, `aria-describedby` and `aria-invalid` to it. |
| `Card` | `padding` (`none`, `md`, `lg`), `as`, `interactive` | `interactive` needs `as="button"` or `as="a"`. |
| `Badge` | `tone` (`neutral`, `accent`, `ok`, `err`, `warn`) | |
| `Dialog` | `open`, `onOpenChange`, `title`, `description`, `footer` | `title` is required for accessibility. |
| `Drawer` | `open`, `onOpenChange`, `title`, `description`, `side` (`bottom`, `right`) | |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Radix tabs props (`defaultValue`, `value`, ...) | |
| `ProgressBar` | `value` (0 to 1), `label` | |
| `SegmentedProgress` | `segments` (`[{ weight, value }]`), `label` | |
| `FeedbackPanel` | `state` (`correct`, `nearly`, `wrong`), `title`, `action`, `announceKey` | Pass the question id as `announceKey` if one panel stays mounted across questions. |
| `EmptyState` | `icon`, `title`, `subtitle`, `action`, `tone` | |
| `PageHeader` | `eyebrow`, `title`, `subtitle`, `backTo`, `backLabel`, `actions`, `icon` | The legacy `gradient` prop is ignored. |
| `TriumphHero`, `Confetti`, `Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonCircle`, `SkeletonGrid` | see the files | Carried over from before, restyled. |
| `cx` | class strings | Joins class names, skipping falsy values. |

Examples:

```jsx
<Field label="Email" hint="We never share it." error={errors.email}>
  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
</Field>

<Button loading={saving} iconLeft={<Save aria-hidden="true" className="size-4" />} onClick={save}>
  Save
</Button>

<Button asChild variant="secondary"><Link to="/settings">Settings</Link></Button>

<Dialog
  open={open}
  onOpenChange={setOpen}
  title="Delete this note?"
  description="This cannot be undone."
  footer={
    <>
      <Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button>
      <Button variant="danger" onClick={remove}>Delete</Button>
    </>
  }
/>

<FeedbackPanel state="wrong" title="Not quite" announceKey={question.id}
  action={<Button size="sm" onClick={next}>Continue</Button>}>
  The answer was "est".
</FeedbackPanel>
```

Toasts come from `ToastContext`: `const { showToast } = useToast(); showToast("Saved", "success")`. Types are `success`, `error`, `warn` (or `warning`) and `info`; the third argument is the duration in ms.

Cost note: `Dialog`, `Drawer`, `Tabs` and `Switch` use Radix and add about 15 kB gzip to the (single) JS bundle the first time a page imports them. Prefer them where an accessible overlay or control is needed, but expect route code-splitting (issue #81) to land first.

### The shell

`components/Layout.jsx` is the app shell: sidebar on desktop (collapsible to an icon rail, with a collapsible "Practice" section), a header and a modal menu on phones, a skip link, and a user menu with the dark-mode switch. The phone menu is hand-built (focus trap, Escape, scroll lock, `inert` app behind it), not a `Drawer`. Details: spec section 3.6.

### Changing a token

1. Edit `frontend/src/design/tokens.json` (roles, ramps, type, radius, spacing, motion, contrast pairs).
2. Run `cd frontend && npm run tokens`. It rewrites `src/design/tokens.css` and `design/paper.tokens.json`.
3. Commit all three files.
4. Run `npm run test:unit`: the contrast tests fail if a role pair drops below 4.5:1 (3:1 for borders).
5. Republish the design-system page (below).

Never hand-edit `src/design/tokens.css` or `design/paper.tokens.json`: both are generated, and CI runs `npm run tokens -- --check`, which fails when they differ from what `tokens.json` produces. A role's colour may change shade to pass contrast, but not its job.

### The dev gallery

Open `http://localhost:5173/dev/ui` (or whatever port `npm run dev` prints). It shows every component in every state, with a light and a dark column side by side, plus dialogs, drawers and toasts. Hover and focus are live, so tab through it to check the focus ring.

It is registered in `App.jsx` only when `import.meta.env.DEV` is true and loaded lazily, so it does not exist in production builds. `npm run check:build` (run after `npm run build`, and in CI) fails if the marker `data-ui-gallery` appears in `dist/assets/*.js`. When you add a component, add it to the matching section in `src/pages/dev/` (`GallerySections.jsx`, `GalleryForms.jsx`, `GalleryOverlays.jsx`).

### The design-system page

The Lingaru Paper design-system page (private to the owner) shows the tokens and reference previews of the components. It reads `frontend/design/paper.tokens.json`, published as its `tokens.json`, so the colours, type, spacing and radius it shows always come from `npm run tokens`.

After a token change, a Claude Code session republishes the page with the new `paper.tokens.json`. The page is private, so its link is not kept in this repository; ask the owner for access.

### `index.css` structure (do not reorder)

Tailwind 4 is configured in CSS. The order of `frontend/src/index.css` is deliberate, and its comments explain each part:

1. `@layer theme, base, components, utilities;` and the two `@import ... layer(...)` lines for Tailwind's theme and preflight, spelled out instead of `@import "tailwindcss"`, so the component classes can live inside the utilities layer.
2. `@import './design/tokens.css'` (generated: `@theme` ramps, fonts, type sizes, `--pp-*` variables, the serif heading utilities and `@theme inline` colour roles).
3. `@source not '../scripts'`, `@plugin '@tailwindcss/typography'`, `@custom-variant dark (&:is(.dark *))` (the class-based dark mode) and `@custom-variant hover (&:hover)` (Tailwind 3 behaviour: hover styles apply on tap on touch devices; without it Tailwind 4 hides every `hover:` rule behind `@media (hover: hover)`).
4. `@theme { ... }`: animation names, Tailwind 3 line-heights, radii, shadows, gradients and keyframes.
5. Compatibility shims: default border colour, button cursor, placeholder colour, form field backgrounds, `space-y-*`.
6. `@layer utilities { ... }`: the legacy component classes (`.card`, `.btn-*`, `.badge-*`, `.input`, `.mode-*`, ...) and custom utilities, in the order that reproduces Tailwind 3's cascade. Do not use them in new code.
7. `@layer base { ... }`: mode variables, fonts, scrollbars, selection, headings.
8. The `prefers-reduced-motion` rule, unlayered on purpose so that it beats everything in the layers.

If a utility stops overriding a component class, or a dark rule stops applying, check whether something was moved across these sections before touching the CSS itself.

## Data model

Not applicable. Tokens are static files; theme and mode come from the saved `theme` value and `user.mode`.

## Configuration

| Setting | Where |
|---|---|
| Theme default | `prefers-color-scheme`, overridden by the saved `theme` in `localStorage` |
| Mode | `user.mode`, applied by `ModeContext` as `html[data-mode]`; it changes navigation and landing content, not colours |
| Fonts | Google Fonts `<link>` in `index.html` (Inter, Instrument Serif, JetBrains Mono) |
| Tailwind | `@tailwindcss/vite` in `vite.config.js`; all theme settings are in CSS (there is no `tailwind.config.js`) |

## Working on it

- **New UI:** use `components/ui/` and role utilities. Check it in the gallery in light and dark, and at 390 px width.
- **No `dark:` with semantic tokens.** `dark:` is only for the old ramps in unmigrated markup.
- **Old classes** (`.btn-primary`, `.card`, `.badge-*`, `.input`): fine to leave on pages you are not redesigning; replace them with components when you touch the page.
- **Visual changes:** run `npm run sweep` before and after and compare (see [Testing and CI](Testing-and-CI.md)). `npm run test:visual:update` after an intentional change to `/login` or `/register`.
- **New token:** add it to `tokens.json` and run `npm run tokens`; never put a hex value in JSX.

## Known gaps

- Page code still has hard-coded sizes, palette classes, `dark:` pairs and emoji icons; aliases keep them on-palette. Lint rules for arbitrary sizes and palette classes (T-3, T-13) are not in place; they wait for the page redesign.
- Fonts are still loaded from Google Fonts, not self-hosted (T-14).
- Spinners freeze as a static arc under reduced motion.
- The app ships one JS chunk; Radix-based components add about 15 kB gzip on first use. Route code-splitting (#81) should come first, which is also why the shell's phone menu is hand-built.
- No page uses `Dialog`/`Drawer` yet. Six overlays are still hand-built: `OnboardingModal`, `AIResultModal`, `MyNotesEdit`, `Settings`, `AgentRun` and a local `Drawer` in `Assistant.jsx`.
- Not built yet: `Popover`/`Menu`, `Tooltip`, `ErrorState`, `Stepper`, toast actions (see the T-item table in the spec).
- Visual regression covers `/login` and `/register`; the gallery is not snapshotted.
