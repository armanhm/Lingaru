# Visual and accessibility sweep

Screenshots every route in light and dark at desktop (1440x900) and mobile
(390x844), runs axe `color-contrast`, checks horizontal overflow, records the
first `h1` font, and counts elements still animating under
`prefers-reduced-motion: reduce` (one extra mobile light pass per route).

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

```
SWEEP_BASE_URL=http://localhost:5173 SWEEP_USER=demo SWEEP_PASSWORD=... \
  npm run sweep -- --out sweep-out/baseline [--compare sweep-out/baseline]
```

The script logs in through `POST /api/users/login/`, stores the tokens in
`localStorage`, pins `lingaru-ui-language=en` (and PATCHes `ui_language` to
`en` on the user once per run), and sets `localStorage.theme` per pass.
CSS animations and transitions are disabled for screenshot passes only.

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
