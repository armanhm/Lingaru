# Paper Design Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Lingaru one calm "Paper" visual system (tokens, components, app shell) and move every existing page onto its palette and type without rewriting pages.

**Architecture:** Upgrade to Tailwind 4 first (no visual change), then introduce a single JSON token source that generates Tailwind theme ramps plus light/dark semantic CSS variables. Re-pointing the ramps pages already use (`surface-*`, `primary-*`, ...) turns the whole app Paper in one change. New components in `src/components/ui/` use semantic utilities (`bg-canvas`, `text-fg`, ...) and Radix primitives; a dev-only gallery shows them. A Playwright "sweep" script is the visual and accessibility safety net for every stage.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 4 (`@tailwindcss/vite`), Radix UI primitives, lucide-react, Vitest + Testing Library + jsdom, Node `node:test`, Playwright + `@axe-core/playwright`, pixelmatch.

**Spec:** `docs/superpowers/specs/2026-11-23-paper-design-foundation-design.md` (read it; section 5.8 records decisions that override earlier lines).

## Global Constraints

- Token values (light / dark), exactly: canvas `#F6F3EC`/`#1A1916`, card `#FFFDF8`/`#23211D`, line `#E4DDCF`/`#34312B`, line-soft `#ECE6DA`/`#2B2925`, fg `#1D1B18`/`#EDE8DE`, fg-2 `#4A463F`/`#C9C2B5`, fg-3 `#66615A`/`#A8A193`, accent `#2340B8`/`#8FA6FF`, accent-strong `#1B3290`/`#B3C2FF`, ok `#2D5A3A`/`#7CC49A`, ok-bg `#EEF3EC`/`#1F2A22`, ok-line `#CFDDCB`/`#2F4535`, err `#8A3B2E`/`#E58C74`, err-bg `#F7ECE8`/`#2E201C`, warn `#7A5A12`/`#E2C06B`, warn-bg `#F6EFDD`/`#2B261A`. Shades may be adjusted only to pass contrast; roles may not change.
- Contrast: body text 4.5:1, large text (≥24 px) 3:1, input borders and focus rings 3:1 against their background.
- Fonts: headings Instrument Serif weight 400 (no faux-bold); UI Inter 400/500/600; JetBrains Mono only for code-like labels.
- Type scale (px / line-height): display 40/1.05, h1 34/1.1, h2 26/1.15, h3 22/1.2 (serif); body 16/1.5, body-lg 17/1.5, small 14/1.45, caption 13/1.4, overline 11-12 uppercase tracking 0.12-0.14em (Inter).
- Spacing 4 px base (4, 8, 12, 16, 20, 24, 32, 48, 64). Radius 10 / 12 / 16 / full. Depth from borders; one soft shadow only for overlays.
- Motion 150-200 ms ease-out; no bounce/shake/confetti in everyday UI; everything honours `prefers-reduced-motion`.
- Touch targets ≥ 44 px; focus ring 2 px `accent` with 2 px offset.
- One palette for every mode (general/exam/agentic): no per-mode gradients or favicons.
- Dark mode stays class-based: `ThemeContext` toggles `.dark` on `<html>`.
- JS bundle (gzip total of `dist/assets/*.js`) not larger than before Task 1; Lighthouse accessibility score not lower.
- No em-dashes in code, copy, commits or PRs. Conventional Commits; every commit ends with the attribution lines the session provides.
- Each stage is its own PR (stacked branches `design/paper-1-tailwind4` … `design/paper-5-reference`), with before/after sweep screenshots in the description; the owner's merge is the gate. Stage 2 cannot merge before the owner confirms the dark palette (Task 4).

## Review Focus

1. Pages with explicit `dark:` classes landing on re-pointed ramp steps that no longer contrast (e.g. `dark:text-surface-400` on `dark:bg-surface-900`): the sweep's axe color-contrast count per page must not exceed the Task 1 baseline (Task 1 builds it, Tasks 2/5/6/14 assert it).
2. Larger body text (15 to 16 px) and serif headings overflowing at phone width: the sweep asserts no horizontal scroll at 390 px on every page (Task 1, asserted in Tasks 5 and 14).
3. `text-h1 font-bold` style combinations rendering faux-bold serif: the sweep reports computed `font-family`/`font-weight` of each page's first `h1` (Task 1); Task 5 asserts Instrument Serif at 400 where `text-h1`/`text-display`/`PageHeader` is used.
4. Reduced-motion users still seeing animations: the sweep runs a pass with `reducedMotion: "reduce"` and asserts every animated element's computed `animation-duration` is ≤ 0.01s (Task 1; global rule added in Task 13).
5. Mode switching after flattening the mode visuals: Settings still lets a learner change mode and the nav still changes per mode (Task 6 test).

---

## Stage 1: Tailwind 4 (PR `design/paper-1-tailwind4`)

### Task 1: Visual and accessibility sweep tool

**Files:**
- Create: `frontend/scripts/sweep/sweep.mjs`, `frontend/scripts/sweep/pages.mjs`, `frontend/scripts/sweep/README.md`
- Modify: `frontend/package.json` (devDependencies `@axe-core/playwright`, `pixelmatch`, `pngjs`; script `"sweep": "node scripts/sweep/sweep.mjs"`)
- Modify: `frontend/.gitignore` (ignore `sweep-out/`)

**Interfaces:**
- Produces: `npm run sweep -- --out <dir> [--compare <dir>]`. Env: `SWEEP_BASE_URL` (default `http://localhost:5173`), `SWEEP_USER`, `SWEEP_PASSWORD`. Logs in through `POST /api/users/login/`, stores tokens in `localStorage` (`access_token`, `refresh_token`) and sets `lingaru-ui-language=en`.
- Produces: `<out>/report.json` = `{ pages: [{ route, theme: "light"|"dark", viewport: "desktop"|"mobile", screenshot, axeContrastViolations: number, horizontalOverflow: boolean, h1: { fontFamily, fontWeight } | null, animatedOverReducedMotion: number, diffRatio?: number }] }`.
- Produces: `pages.mjs` exporting `ROUTES` = `["login", "dashboard", "topics", "practice/srs", "assistant", "agents", "discover", "news", "dictionary", "grammar", "exam-prep", "mini-games", "our-notes", "my-notes", "progress", "settings"]` (login runs logged-out).

- [ ] **Step 1:** Implement `sweep.mjs`: for each route × theme (light, dark via `localStorage.theme`) × viewport (desktop 1440×900, mobile 390×844), screenshot, run axe with only the `color-contrast` rule, check `document.documentElement.scrollWidth > innerWidth`, read the first `h1`'s computed font, then one extra mobile pass with `reducedMotion: "reduce"` counting elements whose computed `animationName !== "none"` and `animationDuration > 0.01s`. With `--compare`, compute pixelmatch ratio against the same file in the compare dir.
- [ ] **Step 2:** Document setup in `scripts/sweep/README.md` (seeded local app per `docs/wiki/Getting-Started.md` and `docs/wiki/Content-Data-Pipeline.md`, demo user with `mode` set, both servers running).
- [ ] **Step 3:** Run `npm run sweep -- --out sweep-out/baseline` against `main`. Expected: 64 screenshots plus the reduced-motion pass, `report.json` written. Keep `sweep-out/baseline` locally for the whole project (it is the comparison point for every stage).
- [ ] **Step 4:** Record the baseline bundle size: `npm run build && gzip -c dist/assets/*.js | wc -c` and note the number in the Stage 1 PR description.
- [ ] **Step 5:** Commit (`test(frontend): add visual and accessibility sweep script`).

### Task 2: Upgrade to Tailwind 4

**Files:**
- Modify: `frontend/package.json` (`tailwindcss@^4`, add `@tailwindcss/vite`, `@tailwindcss/typography` latest; remove `autoprefixer`, `postcss` if unused)
- Modify: `frontend/vite.config.js` (add the `tailwindcss()` plugin)
- Delete: `frontend/postcss.config.js`; `frontend/tailwind.config.js` (after its theme moves to CSS)
- Modify: `frontend/src/index.css` and every file the upgrade tool rewrites
- Modify: `.github/dependabot.yml` (remove the `tailwindcss` major ignore)

**Interfaces:**
- Produces: theme defined in CSS (`@theme` in `src/index.css`), `@plugin "@tailwindcss/typography";`, and `@custom-variant dark (&:where(.dark, .dark *));` so `dark:` keeps following the `.dark` class.

- [ ] **Step 1:** Run `npx @tailwindcss/upgrade` in `frontend/`; switch to `@tailwindcss/vite`; port anything the tool leaves in `tailwind.config.js` (colours, fontSize tokens, keyframes/animations, fonts) into `@theme` and delete the config.
- [ ] **Step 2:** Run `npm run lint && npm run test:unit && npm run build`. Expected: pass, 0 lint errors.
- [ ] **Step 3:** Run `npm run sweep -- --out sweep-out/stage1 --compare sweep-out/baseline`. Expected: every `diffRatio` < 0.005, `axeContrastViolations` per page ≤ baseline, no new `horizontalOverflow`. Fix differences (usually renamed utilities like `shadow-sm`→`shadow-xs`, `ring` width, `rounded` scale) until they hold.
- [ ] **Step 4:** Bundle size ≤ Task 1 baseline.
- [ ] **Step 5:** Commit (`build(frontend): upgrade to Tailwind CSS 4`), open the Stage 1 PR with three before/after pairs (dashboard light, settings dark, topics mobile).

## Stage 2: Tokens and re-point (PR `design/paper-2-tokens`)

### Task 3: Single token source, generator and contrast tests

**Files:**
- Create: `frontend/src/design/tokens.json`, `frontend/scripts/tokens/build.mjs`, `frontend/scripts/tokens/contrast.mjs`, `frontend/scripts/tokens/contrast.test.mjs`, `frontend/scripts/tokens/build.test.mjs`
- Generated (committed): `frontend/src/design/tokens.css`, `frontend/design/paper.tokens.json`
- Modify: `frontend/package.json` (`"tokens": "node scripts/tokens/build.mjs"`; `test:unit` becomes `node --test src/lib/*.test.js scripts/tokens/*.test.mjs`)
- Modify: `.github/workflows/ci.yml` (frontend job: `npm run tokens -- --check` after install)

**Interfaces:**
- Produces `tokens.json` shape: `{ "semantic": { "<name>": { "light": "#hex", "dark": "#hex" } }, "ramps": { "<ramp>": { "50": "#hex", …, "950": "#hex" } }, "aliases": { "<tailwindName>": "<ramp>" }, "contrastPairs": [ { "fg": "<semantic>", "bg": "<semantic>", "min": 4.5 } ], "fonts": {…}, "type": {…}, "radius": {…}, "space": […], "motion": {…} }`.
- Semantic names (utilities `bg-*`, `text-*`, `border-*`): `canvas, card, line, line-soft, line-strong, fg, fg-2, fg-3, accent, accent-strong, on-accent, ok, ok-bg, ok-line, err, err-bg, warn, warn-bg` with the Global Constraints values; `on-accent` = `#FFFFFF` / `#14130F`; `line-strong` = input borders, shades chosen to pass 3:1 against `card`.
- Ramps: `surface`, `accent`, `ok`, `err`, `warn`, steps 50..950. Pinned anchors: surface 50 `#F6F3EC`, 100 `#ECE6DA`, 200 `#E4DDCF`, 500 `#66615A`, 600 `#4A463F`, 800 `#2B2925`, 900 `#23211D`, 950 `#1A1916`; accent 50 `#EEF1FB`, 200 `#B3C2FF`, 300 `#8FA6FF`, 600 `#2340B8`, 700 `#1B3290`; ok 50 `#EEF3EC`, 200 `#CFDDCB`, 300 `#7CC49A`, 700 `#2D5A3A`; err 50 `#F7ECE8`, 300 `#E58C74`, 700 `#8A3B2E`; warn 50 `#F6EFDD`, 300 `#E2C06B`, 700 `#7A5A12`. Other steps interpolated.
- Aliases: `primary, info, purple, violet, indigo, pink → accent`; `paper, ink → surface`; `success → ok`; `danger, rose → err`; `amber → warn`. (`accent` itself is the blue ramp, replacing the old coral.)
- `build.mjs` exports `buildCss(tokens): string` and `buildArtifactTokens(tokens): object`; CLI writes both files, `--check` exits 1 if either file on disk differs.
- `tokens.css` contains `@theme { --color-<ramp>-<step> …; --color-<alias>-<step>: var(--color-<ramp>-<step>) …; --font-* …; --text-display/h1/h2/h3/body/body-lg/small/caption … }`, `:root { --pp-<semantic>: <light> }`, `.dark { --pp-<semantic>: <dark> }`, `@theme inline { --color-<semantic>: var(--pp-<semantic>) }`.
- `contrast.mjs` exports `contrastRatio(hexA: string, hexB: string): number` (WCAG 2.x relative luminance).

- [ ] **Step 1: Write the failing tests.** `contrast.test.mjs`: `contrastRatio("#000000", "#FFFFFF") === 21` (to 2 decimals), `contrastRatio("#FFFFFF", "#FFFFFF") === 1`; and for every `contrastPairs` entry, in light and dark, `contrastRatio(fg, bg) >= min`. Pairs: `fg/canvas 4.5, fg/card 4.5, fg-2/canvas 4.5, fg-2/card 4.5, fg-3/canvas 4.5, fg-3/card 4.5, accent/canvas 4.5, accent/card 4.5, on-accent/accent 4.5, ok/ok-bg 4.5, err/err-bg 4.5, warn/warn-bg 4.5, err/card 4.5, line-strong/card 3, accent/card 3`. `build.test.mjs`: `buildCss` output contains `--color-surface-50: #F6F3EC`, `--color-primary-600: var(--color-accent-600)`, `.dark` block with `--pp-canvas: #1A1916`, and `--color-canvas: var(--pp-canvas)`.
- [ ] **Step 2:** Run `npm run test:unit`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement `tokens.json`, `contrast.mjs`, `build.mjs` per the Interfaces block; run `npm run tokens`.
- [ ] **Step 4:** Run `npm run test:unit`. Expected: PASS. If a contrast pair fails, adjust that shade in `tokens.json` (not the role) and note it in the PR.
- [ ] **Step 5:** Commit (`feat(design): add Paper token source and generator`).

### Task 4: Tokens-only design-system page for dark-palette sign-off (controller task, no code)

**Files:** none in the repo; output is a Claude "Design System" artifact.

- [ ] **Step 1:** Create a "Design System" artifact titled "Lingaru Paper" (Artifact tool: quickstart `intent: "other"`, then the Design System type), install `design/paper.tokens.json` as its tokens (adapt the file to the type's documented `tokens.json` format; if it differs, update `buildArtifactTokens` so the generator emits that format directly).
- [ ] **Step 2:** Publish: light and dark swatches for every semantic token, the type scale, and the two chosen mockup screens ("Paper: Today", "Paper: Session step") rendered in dark.
- [ ] **Step 3:** Ask the owner to confirm the dark palette. Record the answer in the Stage 2 PR. Any change goes into `tokens.json` (Task 3's tests must still pass).

### Task 5: Re-point the app to Paper

**Files:**
- Modify: `frontend/src/index.css` (import `./design/tokens.css`; remove old colour/font-size theme entries now generated; rewrite `@layer components` classes `.card*`, `.btn*`, `.badge*`, `.input*`, `.section-label`, `.eyebrow-primary`, `.stat-pill`, `.kbd`, `.divider-label`, `.focus-ring`, `.mode-*` to Paper semantic utilities; flatten `--mode-grad-from/to`, `--mode-accent`, `--mode-shell-tint`, `--mode-radius` to Paper values for all three modes; body uses `bg-canvas text-fg`)
- Modify: `frontend/src/components/ui/PageHeader.jsx` (title uses `text-h1` in Instrument Serif 400; `gradient` prop kept but renders the same as `false`)

**Interfaces:**
- Consumes: `tokens.css` utilities and variables from Task 3.
- Produces: utilities `text-display`, `text-h1`, `text-h2`, `text-h3` that set Instrument Serif, weight 400, and the Global Constraints size/line-height, winning over `font-bold`/`font-semibold`/`font-extrabold` on the same element; `text-h4`, `text-body`, `text-body-lg`, `text-caption`, `text-eyebrow` stay Inter with new sizes. The global `h1`-`h6` base rule stays Inter.

- [ ] **Step 1:** Implement the CSS changes above.
- [ ] **Step 2:** Run `npm run lint && npm run test:unit && npm run build`. Expected: pass.
- [ ] **Step 3:** Run `npm run sweep -- --out sweep-out/stage2 --compare sweep-out/stage1`. Expected: every page's `axeContrastViolations` ≤ baseline; `horizontalOverflow` false everywhere it was false at baseline; for pages whose first `h1` uses `text-h1`/`text-display`/`PageHeader`, `h1.fontFamily` starts with "Instrument Serif" and `fontWeight` is "400". Fix regressions in `index.css` or with ramp shades.
- [ ] **Step 4:** Commit (`feat(design): re-point the app to Paper tokens`).

### Task 6: Flatten the remaining mode visuals and brand panels

**Files:**
- Modify: `frontend/src/pages/Login.jsx`, `frontend/src/pages/Register.jsx` (brand panel: `bg-card` with serif wordmark and one `accent` detail; remove the grid overlay and `animate-gradient-shift` text)
- Modify: `frontend/src/pages/Settings.jsx` (`MODE_CARDS`: same Paper card for all modes, distinguished by icon and copy; mode-switch celebration becomes a toast `showToast(<mode label>, "success")`)
- Modify: `frontend/src/components/Layout.jsx` (remove the per-mode favicon effect), `frontend/index.html` (`<link rel="icon" type="image/svg+xml" href="/favicon.svg">`)
- Create: `frontend/public/favicon.svg` (serif "L" in `#1D1B18` on `#F6F3EC`, rounded square)
- Delete: `frontend/public/favicon-general.png`, `favicon-exam.png`, `favicon-agentic.png`
- Create: `frontend/src/pages/__tests__/SettingsMode.test.jsx` (needs Vitest; if Task 8 is not merged yet, add Vitest setup here exactly as Task 8 specifies and let Task 8 build on it)

**Interfaces:**
- Consumes: `ModeContext` (`useMode()` → `{ mode, setMode }`, as today).

- [ ] **Step 1: Write the failing test** `SettingsMode.test.jsx`: render the Settings mode section with a mocked `ModeContext` and `ToastContext`; assert three options labelled "General Learner", "Exam Prep (TCF / TEF)", "Agentic, assistant first" (or their en.json labels); clicking the exam option calls `setMode("exam")` once and `showToast` once.
- [ ] **Step 2:** Run `npx vitest run src/pages/__tests__/SettingsMode.test.jsx`. Expected: FAIL until the new markup and toast exist.
- [ ] **Step 3:** Implement the changes above.
- [ ] **Step 4:** Run the test (PASS), `npm run lint`, `npm run build`, and `npm run sweep -- --out sweep-out/stage2b --compare sweep-out/stage2`; check login (light/dark) and settings screenshots.
- [ ] **Step 5:** Commit (`feat(design): one Paper look for every mode`).

### Task 7: Stage 2 baselines and PR

- [ ] **Step 1:** Push the branch; run the "Visual regression" workflow with `update_snapshots: true` on it; download the `updated-baselines` artifact and commit the PNGs into `frontend/e2e/__screenshots__/` (`test(e2e): Paper baselines for login and register`).
- [ ] **Step 2:** Open the Stage 2 PR with before/after pairs for login, dashboard, topics, settings, grammar (light) and dashboard, assistant (dark), the bundle size, and the owner's dark-palette confirmation from Task 4. Expected on the PR: the "Lighthouse audit" check passes with an accessibility score not lower than on `main` (compare the two reports); the same check applies to the Stage 3 and Stage 4 PRs.

## Stage 3: Components and gallery (PR `design/paper-3-components`)

### Task 8: Component test setup and dependencies

**Files:**
- Modify: `frontend/package.json` (devDependencies `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`; dependencies `lucide-react`, `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-switch`, `@radix-ui/react-toast`, `@radix-ui/react-slot`; script `"test": "vitest run"`)
- Create: `frontend/vitest.config.js` (jsdom, `setupFiles: ["./src/test/setup.js"]`, include `src/**/*.test.jsx`), `frontend/src/test/setup.js` (jest-dom matchers)
- Modify: `.github/workflows/ci.yml` (frontend job runs `npm test` after unit tests)
- Create: `frontend/src/components/ui/cx.js` exporting `cx(...classes: (string|false|null|undefined)[]): string`

- [ ] **Step 1:** Add a trivial `src/components/ui/cx.test.jsx`: `cx("a", false, "b", null) === "a b"`. Run `npm test` → FAIL, implement `cx`, run → PASS.
- [ ] **Step 2:** Commit (`test(frontend): add Vitest and Testing Library`). This closes part of #83.

### Task 9: Base components

**Files:**
- Create: `frontend/src/components/ui/Button.jsx`, `IconButton.jsx`, `Card.jsx`, `Badge.jsx`, and `*.test.jsx` beside each
- Modify: `frontend/src/components/ui/EmptyState.jsx`, `Skeleton.jsx`, `PageHeader.jsx` (Paper styling; existing props unchanged), `index.js` (export all)

**Interfaces:**
- Produces: `Button({ variant = "primary" | "secondary" | "quiet" | "danger", size = "md" | "sm" | "lg", loading = false, iconLeft, iconRight, asChild = false, ...buttonProps })` (forwardRef; `asChild` via Radix Slot; min height 44 px at `md`).
- Produces: `IconButton({ label, icon, variant = "quiet", size = "md", ...buttonProps })` (`label` required, rendered as `aria-label`; 44×44 minimum).
- Produces: `Card({ as = "div", padding = "md" | "lg" | "none", interactive = false, ...props })`.
- Produces: `Badge({ tone = "neutral" | "accent" | "ok" | "err" | "warn", children })`.
- Produces: `EmptyState({ icon, title, subtitle, action, tone })` now accepting a lucide component or element for `icon` (string emoji still renders for compatibility).

- [ ] **Step 1: Write failing tests:** Button renders a `<button type="button">` by default; `loading` sets `aria-busy="true"` and `disabled`; `variant="danger"` adds the danger class; `asChild` renders an `<a>` with button classes. IconButton without `label` logs a console error in dev and always renders `aria-label` when given. Card `interactive` adds a focus-visible ring class. Badge renders each tone's class.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement with semantic utilities only (`bg-accent text-on-accent`, `bg-card border-line`, ...), no `dark:` classes needed.
- [ ] **Step 4:** `npm test` → PASS; `npm run lint`.
- [ ] **Step 5:** Commit (`feat(ui): Paper buttons, cards and badges`).

### Task 10: Form components

**Files:**
- Create: `frontend/src/components/ui/Field.jsx`, `Input.jsx`, `Textarea.jsx`, `Select.jsx`, `Checkbox.jsx`, `Switch.jsx` and tests

**Interfaces:**
- Produces: `Field({ id, label, hint, error, children })`: clones its single child with `id`, `aria-describedby` (hint and/or error ids) and `aria-invalid={!!error}`; renders `<label htmlFor={id}>`.
- Produces: `Input`, `Textarea`, `Select` (native `<select>`), `Checkbox` (native), `Switch({ checked, onCheckedChange, label })` (Radix). All forwardRef; borders use `border-line-strong`; error state uses `border-err`.

- [ ] **Step 1: Write failing tests:** `getByLabelText("Email")` finds the input inside `Field`; with `error="Required"` the input has `aria-invalid="true"` and `aria-describedby` pointing at an element with text "Required"; `Switch` toggles via keyboard (Space) and calls `onCheckedChange(true)`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implement. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit (`feat(ui): Paper form fields`).

### Task 11: Overlays, tabs and toasts

**Files:**
- Create: `frontend/src/components/ui/Dialog.jsx`, `Drawer.jsx`, `Tabs.jsx` and tests
- Modify: `frontend/src/contexts/ToastContext.jsx` (Paper styling, `role="status"` region; API unchanged: `showToast(message, type = "success", duration) → id`)

**Interfaces:**
- Produces: `Dialog({ open, onOpenChange, title, description, children, footer })`, `Drawer({ open, onOpenChange, title, side = "bottom" | "right", children })` (both Radix Dialog; the only components allowed the overlay shadow), `Tabs, TabsList, TabsTrigger, TabsContent` (Radix Tabs re-exported with Paper classes).

- [ ] **Step 1: Write failing tests:** opening `Dialog` moves focus inside and `Escape` calls `onOpenChange(false)`; `Dialog` has an accessible name equal to `title`; `Tabs` moves selection with ArrowRight; `showToast("Saved")` renders text "Saved" inside a `status` region and removes it after the duration (fake timers).
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implement. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit (`feat(ui): Paper dialogs, drawers, tabs and toasts`). Mention #112 in the body.

### Task 12: Progress and feedback

**Files:**
- Create: `frontend/src/components/ui/ProgressBar.jsx`, `SegmentedProgress.jsx`, `FeedbackPanel.jsx` and tests

**Interfaces:**
- Produces: `ProgressBar({ value, label })` with `value` in 0..1 → `role="progressbar"`, `aria-valuenow` = round(value×100), `aria-label`.
- Produces: `SegmentedProgress({ segments: [{ weight: number, value: number }], label })` → one `progressbar` whose `aria-valuenow` is the weighted completion; segments sized by `weight` (session blocks 3/10/6/1).
- Produces: `FeedbackPanel({ state = "correct" | "nearly" | "wrong", title, children })` → `role="status"`, `aria-live="polite"`; correct and nearly use `bg-ok-bg border-ok-line text-ok` title; wrong uses `bg-err-bg text-err`.

- [ ] **Step 1: Write failing tests:** `ProgressBar value={0.456}` has `aria-valuenow="46"`; `SegmentedProgress` with segments `[{weight:3,value:1},{weight:10,value:0.45},{weight:6,value:0},{weight:1,value:0}]` reports `aria-valuenow="38"`; `FeedbackPanel state="nearly"` uses the ok classes and has `role="status"`; `state="wrong"` uses the err classes.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implement. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit (`feat(ui): progress bars and feedback panel`).

### Task 13: Dev-only gallery and reduced motion

**Files:**
- Create: `frontend/src/pages/dev/UiGallery.jsx`
- Modify: `frontend/src/App.jsx` (route `/dev/ui` registered only when `import.meta.env.DEV`, lazily imported)
- Modify: `frontend/src/index.css` (global `@media (prefers-reduced-motion: reduce)` rule setting animation and transition durations to 0.01ms)
- Create: `frontend/scripts/checks/no-gallery-in-build.mjs` (exits 1 if any `dist/assets/*.js` contains the string `data-ui-gallery`); add `"check:build": "node scripts/checks/no-gallery-in-build.mjs"` and run it in CI after `npm run build`

**Interfaces:**
- Consumes: every component from Tasks 9-12.
- Produces: `/dev/ui` (dev server only) showing each component in every state, light and dark side by side, root element `data-ui-gallery`.

- [ ] **Step 1:** Implement the gallery and route.
- [ ] **Step 2:** `npm run build && npm run check:build`. Expected: exit 0 (gallery not in the production bundle). Temporarily importing the gallery eagerly must make it exit 1 (verify once, then revert).
- [ ] **Step 3:** `npm run sweep -- --out sweep-out/stage3 --compare sweep-out/stage2b`. Expected: `animatedOverReducedMotion` = 0 on every page; nothing else regressed.
- [ ] **Step 4:** Bundle size ≤ Task 1 baseline.
- [ ] **Step 5:** Commit (`feat(ui): dev gallery and reduced-motion support`); open the Stage 3 PR with gallery screenshots (light and dark).

## Stage 4: Shell (PR `design/paper-4-shell`)

### Task 14: Restyle the app shell

**Files:**
- Modify: `frontend/src/components/Layout.jsx` (sidebar and phone top bar: `bg-canvas`, serif wordmark "Lingaru", quiet nav items using `IconButton`/lucide icons, active item `text-fg` with a 2 px `accent` indicator, mode chip as a neutral `Badge`; nav item list and order unchanged)
- Create: `frontend/src/components/__tests__/Layout.test.jsx`

**Interfaces:**
- Consumes: `Badge`, `IconButton` (Task 9); `modeConfig` (unchanged).

- [ ] **Step 1: Write the failing test:** render `Layout` with mocked auth (mode `general`) inside a `MemoryRouter` at `/dashboard`; assert the visible nav item labels equal the list rendered on `main` today for `general` (copy the labels into the test), the Dashboard item has `aria-current="page"`, and the collapse button has an accessible name.
- [ ] **Step 2:** `npm test` → FAIL (until markup matches). **Step 3:** Implement. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `npm run sweep -- --out sweep-out/stage4 --compare sweep-out/stage3`. Expected: no new contrast violations or overflow; review sidebar screenshots light/dark/mobile.
- [ ] **Step 6:** Commit (`feat(design): Paper app shell`); open the Stage 4 PR.

## Stage 5: Reference and docs (PR `design/paper-5-reference`)

### Task 15: Full design-system page and documentation

**Files:**
- Modify: `docs/specs/design-system.md` (mark T-items delivered; document tokens, components, rules), `docs/wiki/Frontend-Design-System.md` (how to use tokens and components, how to regenerate tokens, how to republish the Claude design-system page), `docs/wiki/Testing-and-CI.md` (sweep, Vitest, `tokens --check`, `check:build`)
- Update (controller): the "Lingaru Paper" Design System artifact from Task 4 with component reference previews for every component in Tasks 9-12

- [ ] **Step 1:** Update the artifact (components section) and confirm it uses the tokens from `npm run tokens`.
- [ ] **Step 2:** Update the three docs; run `grep -rn "—" docs/specs/design-system.md docs/wiki/Frontend-Design-System.md docs/wiki/Testing-and-CI.md` → no matches.
- [ ] **Step 3:** Commit (`docs(design): Paper design system reference`); open the Stage 5 PR linking the artifact; close #120 and #112 when merged.
