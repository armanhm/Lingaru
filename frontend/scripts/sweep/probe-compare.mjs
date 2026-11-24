// Compares two probes.json captures. Values are normalised first, because the
// two sides may come from different Tailwind major versions: colours become
// sRGB channels (oklab/oklch/color() are converted), shadows drop invisible
// layers, and lengths compare within LENGTH_TOLERANCE px.

export const LENGTH_TOLERANCE = 0.5;
const CHANNEL_TOLERANCE = 1; // 0-255 sRGB channel
const ALPHA_TOLERANCE = 0.01;
// Tailwind 3 rounded-full is 9999px, Tailwind 4 is calc(infinity * 1px).
const FULL_RADIUS = 9999;

const COLOR_PROPS = new Set(["color", "background-color", "border-top-color"]);

function clamp255(v) {
  return Math.min(255, Math.max(0, v));
}

function linearToSrgb(c) {
  const a = Math.abs(c);
  const v = a <= 0.0031308 ? 12.92 * a : 1.055 * a ** (1 / 2.4) - 0.055;
  return Math.sign(c) * v * 255;
}

function oklabToRgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function num(token, scale = 1) {
  if (token === "none") return 0;
  return token.endsWith("%") ? (parseFloat(token) / 100) * scale : parseFloat(token);
}

/** Parses a computed CSS colour into [r, g, b, a] (sRGB 0-255, alpha 0-1), or null. */
export function parseColor(value) {
  const v = value.trim().toLowerCase();
  if (v === "transparent") return [0, 0, 0, 0];
  const m = v.match(/^(rgba?|oklab|oklch|color)\((.*)\)$/);
  if (!m) return null;
  const [, fn, body] = m;
  const [main, alphaPart] = body.split("/");
  const parts = main.replace(/,/g, " ").trim().split(/\s+/);
  let alpha = alphaPart === undefined ? 1 : num(alphaPart.trim(), 1);
  if (fn.startsWith("rgb")) {
    if (parts.length === 4) alpha = num(parts[3], 1);
    return [num(parts[0], 255), num(parts[1], 255), num(parts[2], 255), alpha];
  }
  if (fn === "color") {
    if (parts[0] !== "srgb") return null;
    return [num(parts[1], 1) * 255, num(parts[2], 1) * 255, num(parts[3], 1) * 255, alpha];
  }
  if (fn === "oklab") {
    return [...oklabToRgb(num(parts[0], 1), num(parts[1], 0.4), num(parts[2], 0.4)), alpha];
  }
  // oklch
  const L = num(parts[0], 1);
  const C = num(parts[1], 0.4);
  const h = (num(parts[2], 1) * Math.PI) / 180;
  return [...oklabToRgb(L, C * Math.cos(h), C * Math.sin(h)), alpha];
}

/** Normalised colour string: "rgba(r, g, b, a)" with rounded, clamped channels. */
export function normalizeColor(value) {
  const c = parseColor(value);
  if (!c) return value;
  if (c[3] <= 0) return "rgba(0, 0, 0, 0)";
  const [r, g, b] = c.slice(0, 3).map((x) => Math.round(clamp255(x)));
  return `rgba(${r}, ${g}, ${b}, ${Math.round(c[3] * 1000) / 1000})`;
}

function colorsEqual(a, b) {
  const x = parseColor(a);
  const y = parseColor(b);
  if (!x || !y) return a === b;
  if (x[3] <= 0 && y[3] <= 0) return true;
  if (Math.abs(x[3] - y[3]) > ALPHA_TOLERANCE) return false;
  return [0, 1, 2].every((i) => Math.abs(clamp255(x[i]) - clamp255(y[i])) <= CHANNEL_TOLERANCE);
}

function splitTopLevel(value) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") depth++;
    else if (value[i] === ")") depth--;
    else if (value[i] === "," && depth === 0) {
      out.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(value.slice(start).trim());
  return out.filter(Boolean);
}

/** Visible box-shadow layers as { color, lengths, inset }. */
export function parseShadows(value) {
  if (!value || value === "none") return [];
  return splitTopLevel(value)
    .map((layer) => {
      const colorMatch = layer.match(/(rgba?|oklab|oklch|color)\([^)]*\)/);
      const color = colorMatch ? colorMatch[0] : "rgba(0, 0, 0, 1)";
      const rest = colorMatch ? layer.replace(colorMatch[0], " ") : layer;
      const lengths = (rest.match(/-?[\d.]+(?:e[+-]?\d+)?px/g) || []).map(parseFloat);
      while (lengths.length < 4) lengths.push(0);
      return { color, lengths, inset: /\binset\b/.test(rest) };
    })
    .filter((s) => (parseColor(s.color)?.[3] ?? 1) > 0 && s.lengths.some((l) => l !== 0));
}

function lengthsEqual(a, b) {
  return Math.abs(a - b) <= LENGTH_TOLERANCE;
}

function shadowsEqual(a, b, { ignoreColor = false } = {}) {
  const x = parseShadows(a);
  const y = parseShadows(b);
  if (x.length !== y.length) return false;
  return x.every(
    (s, i) =>
      s.inset === y[i].inset &&
      s.lengths.every((l, j) => lengthsEqual(l, y[i].lengths[j])) &&
      (ignoreColor || colorsEqual(s.color, y[i].color)),
  );
}

function px(value) {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(n, FULL_RADIUS);
}

/** Compares one property. Returns "equal", "color" (only colours differ) or "differ". */
export function compareValue(prop, a, b) {
  if (a === b) return "equal";
  if (COLOR_PROPS.has(prop)) return colorsEqual(a, b) ? "equal" : "color";
  if (prop === "box-shadow") {
    if (shadowsEqual(a, b)) return "equal";
    return shadowsEqual(a, b, { ignoreColor: true }) ? "color" : "differ";
  }
  const x = px(a);
  const y = px(b);
  if (x !== null && y !== null && /px$/.test(a) && /px$/.test(b)) return lengthsEqual(x, y) ? "equal" : "differ";
  return "differ";
}

export function entryKey(e) {
  return `${e.id} [${e.theme}${e.focus ? ", focus" : e.hover ? ", hover" : ""}]`;
}

/**
 * Compares a capture with a baseline capture. `probes` are the definitions
 * (for expectedDrift). Drift is accepted only when the baseline was captured
 * from another Tailwind major version. Returns { mismatches, drift } as lists
 * of human-readable lines.
 */
export function compareProbes(current, baseline, probes) {
  const defs = new Map(probes.map((p) => [p.id, p]));
  const crossVersion = current.tailwind !== baseline.tailwind;
  const base = new Map(baseline.probes.map((e) => [entryKey(e), e]));
  const seen = new Set();
  const mismatches = [];
  const drift = [];

  for (const entry of current.probes) {
    const key = entryKey(entry);
    seen.add(key);
    const other = base.get(key);
    if (!other) {
      mismatches.push(`${key}: missing from the baseline`);
      continue;
    }
    const driftKind = crossVersion ? defs.get(entry.id)?.expectedDrift : undefined;
    const lines = [];
    for (const prop of new Set([...Object.keys(other.styles), ...Object.keys(entry.styles)])) {
      const result = compareValue(prop, other.styles[prop] ?? "", entry.styles[prop] ?? "");
      if (result === "equal") continue;
      lines.push({ result, text: `${key} ${prop}: baseline ${other.styles[prop]} -> ${entry.styles[prop]}` });
    }
    const gapsA = other.gaps || [];
    const gapsB = entry.gaps || [];
    if (gapsA.length !== gapsB.length || gapsA.some((g, i) => !lengthsEqual(g, gapsB[i]))) {
      lines.push({ result: "differ", text: `${key} gaps: baseline [${gapsA.join(", ")}] -> [${gapsB.join(", ")}]` });
    }
    for (const { result, text } of lines) {
      const excused =
        driftKind === "not-generated-in-tailwind-3" || (driftKind === "default-palette" && result === "color");
      (excused ? drift : mismatches).push(excused ? `${text} (expected drift: ${driftKind})` : text);
    }
  }
  for (const key of base.keys()) {
    if (!seen.has(key)) mismatches.push(`${key}: missing from this run`);
  }
  return { mismatches, drift };
}
