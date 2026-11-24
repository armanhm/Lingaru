// Visual and accessibility sweep. See README.md.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { ROUTES, THEMES, VIEWPORTS, PUBLIC_ROUTES } from "./pages.mjs";

const BASE = (process.env.SWEEP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const USER = process.env.SWEEP_USER;
const PASSWORD = process.env.SWEEP_PASSWORD;
const SETTLE_MS = 400;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--compare") args.compare = argv[++i];
  }
  if (!args.out) {
    console.error("usage: npm run sweep -- --out <dir> [--compare <dir>]");
    process.exit(2);
  }
  return args;
}

async function login() {
  if (!USER || !PASSWORD) throw new Error("SWEEP_USER and SWEEP_PASSWORD are required");
  const res = await fetch(`${BASE}/api/users/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const tokens = await res.json();
  // The server-side ui_language wins after login, so pin it to English.
  const patch = await fetch(`${BASE}/api/users/me/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens.access}` },
    body: JSON.stringify({ ui_language: "en" }),
  });
  if (!patch.ok) throw new Error(`ui_language patch failed: ${patch.status}`);
  return tokens;
}

async function newContext(browser, { tokens, route, theme, viewport, reducedMotion }) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
    deviceScaleFactor: 1,
  });
  // Freeze the wall clock so clocks and greetings do not change between runs.
  await context.clock.setFixedTime(new Date("2026-06-01T10:00:00"));
  // The dashboard word of the day comes from a random server endpoint; pin it.
  await context.route("**/api/content/vocabulary/random/?*", (r) => {
    if (new URL(r.request().url()).searchParams.get("count") !== "1") return r.fallback();
    return r.fulfill({
      json: [{
        id: 1, french: "la ville", english: "the city",
        pronunciation: "la vil", example_sentence: "J'habite dans une grande ville.",
      }],
    });
  });
  const authed = !PUBLIC_ROUTES.has(route);
  // Seed Math.random so "random" daily content (quotes, words) is stable.
  await context.addInitScript(() => {
    let a = 123456789;
    Math.random = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  await context.addInitScript(
    ({ tokens, theme, authed }) => {
      try {
        localStorage.setItem("lingaru-ui-language", "en");
        localStorage.setItem("theme", theme);
        if (authed && tokens) {
          localStorage.setItem("access_token", tokens.access);
          localStorage.setItem("refresh_token", tokens.refresh);
        }
      } catch {
        /* storage unavailable */
      }
    },
    { tokens, theme, authed },
  );
  return context;
}

async function open(page, route) {
  await page.goto(`${BASE}/${route}`, { waitUntil: "networkidle" });
  const finalPath = new URL(page.url()).pathname.replace(/\/+$/, "");
  if (finalPath !== `/${route}`) {
    throw new Error(`route /${route} landed on ${finalPath || "/"} (expected /${route}); is the demo user logged in and onboarded?`);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(SETTLE_MS);
}

async function countAnimated(page) {
  return page.evaluate(() => {
    const seconds = (v) => (v.endsWith("ms") ? parseFloat(v) / 1000 : parseFloat(v));
    let count = 0;
    for (const el of document.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      const names = cs.animationName.split(",").map((s) => s.trim());
      const durs = cs.animationDuration.split(",").map((s) => seconds(s.trim()));
      if (names.some((n, i) => n !== "none" && durs[i % durs.length] > 0.01)) count++;
    }
    return count;
  });
}

function diffRatio(fileA, fileB) {
  if (!fs.existsSync(fileA)) throw new Error(`missing screenshot ${fileA}`);
  if (!fs.existsSync(fileB)) throw new Error(`missing compare counterpart ${fileB}`);
  const a = PNG.sync.read(fs.readFileSync(fileA));
  const b = PNG.sync.read(fs.readFileSync(fileB));
  if (a.width !== b.width || a.height !== b.height) return 1;
  const changed = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.2 });
  return changed / (a.width * a.height);
}

async function main() {
  const { out, compare } = parseArgs(process.argv.slice(2));
  if (compare && !fs.statSync(compare, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`compare directory not found: ${compare}`);
  }
  fs.mkdirSync(out, { recursive: true });
  const tokens = await login();
  const browser = await chromium.launch();
  const pages = [];
  const reduced = {};

  try {
    for (const route of ROUTES) {
      for (const theme of THEMES) {
        for (const viewport of Object.keys(VIEWPORTS)) {
          const context = await newContext(browser, { tokens, route, theme, viewport });
          const page = await context.newPage();
          await open(page, route);
          await page.addStyleTag({
            content:
              "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
          });
          await page.waitForTimeout(100);

          const screenshot = `${route.replaceAll("/", "_")}-${theme}-${viewport}.png`;
          await page.screenshot({ path: path.join(out, screenshot) });

          const axe = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
          const axeContrastViolations = axe.violations.reduce((n, v) => n + v.nodes.length, 0);
          const horizontalOverflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          );
          const h1 = await page.evaluate(() => {
            const el = document.querySelector("h1");
            if (!el) return null;
            const cs = getComputedStyle(el);
            return { fontFamily: cs.fontFamily, fontWeight: cs.fontWeight };
          });

          const entry = { route, theme, viewport, screenshot, axeContrastViolations, horizontalOverflow, h1 };
          if (compare) {
            const ratio = diffRatio(path.join(out, screenshot), path.join(compare, screenshot));
            entry.diffRatio = ratio;
          }
          pages.push(entry);
          console.log(
            `${screenshot}: contrast=${axeContrastViolations} overflow=${horizontalOverflow}` +
              (entry.diffRatio !== undefined ? ` diff=${entry.diffRatio.toFixed(5)}` : ""),
          );
          await context.close();
        }
      }

      // Reduced-motion pass: mobile, light, animations left enabled.
      const context = await newContext(browser, {
        tokens, route, theme: "light", viewport: "mobile", reducedMotion: true,
      });
      const page = await context.newPage();
      await open(page, route);
      reduced[route] = await countAnimated(page);
      await context.close();
    }
  } finally {
    await browser.close();
  }

  for (const p of pages) p.animatedOverReducedMotion = reduced[p.route];
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify({ pages }, null, 2));
  console.log(`wrote ${pages.length} pages to ${path.join(out, "report.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
