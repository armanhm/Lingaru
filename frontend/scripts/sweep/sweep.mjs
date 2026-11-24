// Visual and accessibility sweep. See README.md.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { ROUTES, THEMES, VIEWPORTS, PUBLIC_ROUTES } from "./pages.mjs";
import { PROBES, PROBE_ROUTE } from "./probes.mjs";
import { compareProbes } from "./probe-compare.mjs";

const BASE = (process.env.SWEEP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const USER = process.env.SWEEP_USER;
const PASSWORD = process.env.SWEEP_PASSWORD;
const SETTLE_MS = 400;
const NO_MOTION_CSS =
  "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
const PROBE_HOST_ID = "sweep-probe-host";
const PROBE_TARGET = `#${PROBE_HOST_ID} > :first-child`;
const PROBE_STYLES = [
  "color", "background-color", "border-top-color", "border-top-width",
  "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
  "box-shadow", "font-size", "line-height", "font-weight",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin-top", "margin-right", "margin-bottom", "margin-left", "opacity",
];
const PSEUDO_STYLES = ["color", "background-color"];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--compare") args.compare = argv[++i];
    else if (argv[i] === "--probes-only") args.probesOnly = true;
  }
  if (!args.out) {
    console.error("usage: npm run sweep -- --out <dir> [--compare <dir>] [--probes-only]");
    process.exit(2);
  }
  if (args.compare && samePath(args.out, args.compare)) {
    console.error(`--out and --compare must be different directories (both are ${args.compare})`);
    process.exit(2);
  }
  return args;
}

function samePath(a, b) {
  const real = (p) => {
    try {
      return fs.realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  };
  return real(a) === real(b);
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

// Runs in the page: computed styles of the probed element (or its pseudo-element)
// and, for containers, the vertical gaps between consecutive children.
function measureProbe({ hostId, measure, pseudo, styleNames, pseudoStyleNames }) {
  const first = document.getElementById(hostId).firstElementChild;
  const el = measure ? first.querySelector(measure) : first;
  const cs = getComputedStyle(el, pseudo || null);
  const styles = {};
  for (const name of pseudo ? pseudoStyleNames : styleNames) styles[name] = cs.getPropertyValue(name);
  if (pseudo) return { styles };
  const rect = el.getBoundingClientRect();
  styles.width = `${rect.width}px`;
  styles.height = `${rect.height}px`;
  const kids = [...el.children];
  if (kids.length < 2) return { styles };
  const gaps = kids.slice(1).map((kid, i) => {
    const gap = kid.getBoundingClientRect().top - kids[i].getBoundingClientRect().bottom;
    return Math.round(gap * 100) / 100;
  });
  return { styles, gaps };
}

// Tailwind 4 output keeps native cascade layers; Tailwind 3 output has none.
function detectTailwindMajor() {
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (rule instanceof CSSLayerStatementRule && rule.nameList.includes("utilities")) return 4;
      if (rule instanceof CSSLayerBlockRule && rule.name === "utilities") return 4;
    }
  }
  return 3;
}

async function captureProbes(browser, tokens) {
  const entries = [];
  let tailwind;
  for (const theme of THEMES) {
    const context = await newContext(browser, { tokens, route: PROBE_ROUTE, theme, viewport: "desktop" });
    const page = await context.newPage();
    await open(page, PROBE_ROUTE);
    await page.addStyleTag({ content: NO_MOTION_CSS });
    tailwind ??= await page.evaluate(detectTailwindMajor);
    await page.evaluate((id) => {
      const host = document.createElement("div");
      host.id = id;
      host.style.cssText = "position:absolute;top:0;left:0;z-index:2147483647;width:600px";
      document.body.append(host);
    }, PROBE_HOST_ID);
    const { width, height } = VIEWPORTS.desktop;
    const measure = (probe) =>
      page.evaluate(measureProbe, {
        hostId: PROBE_HOST_ID, measure: probe.measure, pseudo: probe.pseudo,
        styleNames: PROBE_STYLES, pseudoStyleNames: PSEUDO_STYLES,
      });

    for (const probe of PROBES) {
      const html = tailwind === 3 && probe.tw3Html ? probe.tw3Html : probe.html;
      await page.evaluate(({ id, html }) => {
        document.getElementById(id).innerHTML = html;
        return document.fonts.ready.then(() => undefined);
      }, { id: PROBE_HOST_ID, html });
      // Park the pointer in the bottom-right corner, away from the probe host
      // at the top left, before each base reading.
      await page.mouse.move(width - 1, height - 1);
      const pseudo = probe.pseudo ? { pseudo: probe.pseudo } : {};
      entries.push({ id: probe.id, theme, hover: false, ...pseudo, ...(await measure(probe)) });
      if (probe.hover) {
        await page.hover(PROBE_TARGET);
        entries.push({ id: probe.id, theme, hover: true, ...pseudo, ...(await measure(probe)) });
        await page.mouse.move(width - 1, height - 1);
      }
      if (probe.focus) {
        await page.focus(PROBE_TARGET);
        entries.push({ id: probe.id, theme, hover: false, focus: true, ...pseudo, ...(await measure(probe)) });
        await page.evaluate(() => document.activeElement?.blur());
      }
    }
    await context.close();
  }
  return { tailwind, probes: entries };
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
  const { out, compare, probesOnly } = parseArgs(process.argv.slice(2));
  if (compare && !fs.statSync(compare, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`compare directory not found: ${compare}`);
  }
  const compareProbesFile = compare && path.join(compare, "probes.json");
  if (compareProbesFile && !fs.existsSync(compareProbesFile)) {
    throw new Error(`missing ${compareProbesFile}; capture it with --probes-only --out ${compare}`);
  }
  fs.mkdirSync(out, { recursive: true });
  const tokens = await login();
  const browser = await chromium.launch();
  const pages = [];
  const reduced = {};
  let probes;

  try {
    for (const route of probesOnly ? [] : ROUTES) {
      for (const theme of THEMES) {
        for (const viewport of Object.keys(VIEWPORTS)) {
          const context = await newContext(browser, { tokens, route, theme, viewport });
          const page = await context.newPage();
          await open(page, route);
          await page.addStyleTag({ content: NO_MOTION_CSS });
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
    probes = await captureProbes(browser, tokens);
  } finally {
    await browser.close();
  }

  if (!probesOnly) {
    for (const p of pages) p.animatedOverReducedMotion = reduced[p.route];
    fs.writeFileSync(path.join(out, "report.json"), JSON.stringify({ pages }, null, 2));
    console.log(`wrote ${pages.length} pages to ${path.join(out, "report.json")}`);
  }
  fs.writeFileSync(path.join(out, "probes.json"), JSON.stringify(probes, null, 2));
  console.log(`wrote ${probes.probes.length} probe readings (Tailwind ${probes.tailwind}) to ${path.join(out, "probes.json")}`);

  if (compareProbesFile) {
    const baseline = JSON.parse(fs.readFileSync(compareProbesFile, "utf8"));
    const { mismatches, drift } = compareProbes(probes, baseline, PROBES);
    for (const line of drift) console.log(`probe drift: ${line}`);
    for (const line of mismatches) console.log(`probe MISMATCH: ${line}`);
    console.log(
      `probes vs ${compareProbesFile} (Tailwind ${baseline.tailwind}): ` +
        `${mismatches.length} mismatches, ${drift.length} accepted drift`,
    );
    if (mismatches.length) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
