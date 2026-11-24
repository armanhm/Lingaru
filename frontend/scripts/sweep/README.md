# Visual and accessibility sweep

Screenshots every route in light and dark at desktop (1440x900) and mobile
(390x844), runs axe `color-contrast`, checks horizontal overflow, records the
first `h1` font, and counts elements still animating under
`prefers-reduced-motion: reduce` (one extra mobile light pass per route).
Then it runs the computed-style probes (see "Probes" below).

## Setup

Requires Node >= 22.12 (needed by `@axe-core/playwright`).

1. Run the backend seeded with demo content, per `docs/wiki/Getting-Started.md`
   and `docs/wiki/Content-Data-Pipeline.md`, on `http://127.0.0.1:8000`.
2. Have a demo user that already has `mode` set (so no onboarding modal
   covers the page).
3. Start the frontend dev server (it proxies `/api` to the backend):
   `npx vite --port 5173`.
4. Install the browser once: `npx playwright install chromium`.

## Run

Write a baseline:

```
SWEEP_BASE_URL=http://localhost:5173 SWEEP_USER=demo SWEEP_PASSWORD=... \
  npm run sweep -- --out sweep-out/baseline
```

Compare a later run against it (`--out` must be a different directory; the
script refuses to overwrite the directory it compares against):

```
SWEEP_BASE_URL=http://localhost:5173 SWEEP_USER=demo SWEEP_PASSWORD=... \
  npm run sweep -- --out sweep-out/after --compare sweep-out/baseline
```

`--probes-only` runs just the probes pass: it writes only `<out>/probes.json`
and leaves screenshots and `report.json` in `<out>` alone, so it can add
probes to an existing baseline.

The script logs in through `POST /api/users/login/`, stores the tokens in
`localStorage`, pins `lingaru-ui-language=en` (and PATCHes `ui_language` to
`en` on the user once per run), and sets `localStorage.theme` per pass.
CSS animations and transitions are disabled for the screenshot and probe
passes, not for the reduced-motion count.

Output: `<out>/<route with / as _>-<theme>-<viewport>.png` and
`<out>/report.json`. With `--compare`, each entry gets `diffRatio`
(pixelmatch changed pixels / total pixels; 1 when dimensions differ).
`animatedOverReducedMotion` is measured once per route and repeated on that
route's entries. `sweep-out/` is git-ignored; keep the baseline directory.

## Determinism

So that `--compare` against an unchanged build stays under 0.005, each context
freezes the clock (`2026-06-01T10:00`), seeds `Math.random`, and stubs
`GET /api/content/vocabulary/random/?count=1` (the dashboard word of the day)
with a fixed word. pixelmatch runs at threshold 0.2 to ignore text
anti-aliasing noise.

## Probes

Screenshots miss hover and focus states, pages outside the sweep and small
layout shifts. The probes pass covers those with computed styles.
`probes.mjs` lists small HTML snippets that reuse real class strings from
`src/` (each cites its source line): Tailwind only generates CSS for class
names it finds in the app, and `src/index.css` keeps `scripts/` out of that
scan, so a probe can only measure CSS the app itself produces.

For each theme the script opens an authenticated page (`PROBE_ROUTE`), turns
off animations and transitions, and injects each snippet into a 600px wide
host on top of the page. It records, for the first element of the snippet
(or the element its `measure` selector picks inside it): `color`,
`background-color`, `border-top-color`, `border-top-width`, the four corner
radii, `box-shadow`, `font-size`, `line-height`, `font-weight`, the four
paddings and margins, `opacity`, and the rendered `width`/`height`; for a
container, also the vertical `gaps` between its children. A probe with `hover`
or `focus` adds a reading with the first element hovered or focused; a probe
with `pseudo` (`::selection`, `::before`, ...) records that pseudo-element's
colours instead.

Output: `<out>/probes.json` = `{ tailwind, probes: [{ id, theme, hover, focus?,
pseudo?, styles, gaps? }] }`, where `tailwind` is the major version detected on
the page. Probes with a `tw3Html` use it on a Tailwind 3 page (class names that
the v4 upgrade renamed). The Tailwind 4 dev server keeps generating classes it
has seen earlier in the session, so restart it after removing or renaming
classes before you trust a probe run.

With `--compare`, `<compare>/probes.json` must exist (add it to an older
baseline with `--probes-only`), and every reading must equal the one there:
colours are normalised to sRGB (oklab, oklch and `color()` are converted;
channels within 1, alpha within 0.01), invisible shadow layers are dropped,
and lengths match within 0.5px (`rounded-full` radii count as equal). The
mismatches are listed and the run exits non-zero. A probe's `expectedDrift`
excuses a listed difference only against a baseline from another Tailwind
major version (`default-palette`: colours only; `not-generated-in-tailwind-3`:
a class the app never used, so Tailwind 3 emitted nothing for it).

Unit tests for the comparison run with `npm run test:unit` (or alone:
`node --test scripts/sweep/*.test.mjs`).

