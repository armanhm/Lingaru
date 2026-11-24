// Run with: node --test scripts/sweep/
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeColor, compareValue, compareProbes, parseShadows } from "./probe-compare.mjs";

test("colours convert to sRGB like Chrome's canvas does", () => {
  // Reference values read back from a Chromium canvas fill.
  assert.equal(normalizeColor("oklch(0.627 0.265 303.9)"), "rgba(173, 70, 255, 1)");
  assert.equal(normalizeColor("oklab(0.207678 -0.00293915 -0.0397103 / 0.8)"), "rgba(15, 23, 42, 0.8)");
  assert.equal(normalizeColor("oklab(0.5 0.1 -0.1)"), "rgba(129, 69, 154, 1)");
  assert.equal(normalizeColor("color(srgb 0.5 0.25 1)"), "rgba(128, 64, 255, 1)");
  assert.equal(normalizeColor("rgb(1 2 3 / 50%)"), "rgba(1, 2, 3, 0.5)");
  assert.equal(normalizeColor("oklab(0.9 0.1 0.1 / 0)"), "rgba(0, 0, 0, 0)");
});

test("a Tailwind 4 color-mix equals the Tailwind 3 rgb() with opacity", () => {
  assert.equal(
    compareValue("background-color", "rgba(15, 23, 42, 0.8)", "oklab(0.207678 -0.00293915 -0.0397103 / 0.8)"),
    "equal",
  );
  assert.equal(compareValue("color", "rgb(99, 102, 241)", "rgb(79, 70, 229)"), "color");
});

test("shadows ignore invisible layers and compare lengths within 0.5px", () => {
  const v3 = "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px";
  const v4 =
    "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, " +
    "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2.3px 0px";
  assert.equal(parseShadows(v3).length, 1);
  assert.equal(compareValue("box-shadow", v3, v4), "equal");
  assert.equal(compareValue("box-shadow", v3, "rgba(0, 0, 0, 0.05) 0px 1px 3px 0px"), "differ");
  assert.equal(compareValue("box-shadow", v3, "rgba(9, 9, 9, 0.05) 0px 1px 2px 0px"), "color");
});

test("lengths compare within 0.5px and full radii are equal", () => {
  assert.equal(compareValue("width", "33px", "33.4px"), "equal");
  assert.equal(compareValue("height", "20px", "17px"), "differ");
  assert.equal(compareValue("border-top-left-radius", "9999px", "3.35544e+07px"), "equal");
  assert.equal(compareValue("line-height", "normal", "16px"), "differ");
});

test("compareProbes lists mismatches and applies expectedDrift only across major versions", () => {
  const probes = [{ id: "a" }, { id: "b", expectedDrift: "default-palette" }];
  const entry = (id, color, height, gaps) => ({ id, theme: "light", hover: false, styles: { color, height }, gaps });
  const tw3 = { tailwind: 3, probes: [entry("a", "rgb(0, 0, 0)", "20px", [20]), entry("b", "rgb(0, 0, 0)", "20px")] };
  const tw4 = { tailwind: 4, probes: [entry("a", "rgb(0, 0, 0)", "20px", [40]), entry("b", "rgb(9, 9, 9)", "20px")] };
  const cross = compareProbes(tw4, tw3, probes);
  assert.deepEqual(cross.mismatches, ["a [light] gaps: baseline [20] -> [40]"]);
  assert.equal(cross.drift.length, 1);
  const same = compareProbes(tw4, { ...tw3, tailwind: 4 }, probes);
  assert.equal(same.mismatches.length, 2);
  assert.equal(same.drift.length, 0);
});

test("compareProbes reports entries missing on either side", () => {
  const e = { id: "a", theme: "dark", hover: true, styles: {} };
  const result = compareProbes({ tailwind: 4, probes: [] }, { tailwind: 4, probes: [e] }, []);
  assert.deepEqual(result.mismatches, ["a [dark, hover]: missing from this run"]);
});
