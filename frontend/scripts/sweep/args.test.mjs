import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { parseArgs, probesCompareFile, missingBaselineProbesMessage, UsageError } from "./args.mjs";

test("--record-probes is off unless given", () => {
  assert.equal(parseArgs(["--out", "a"]).recordProbes, false);
  assert.equal(parseArgs(["--out", "a", "--compare", "b", "--record-probes"]).recordProbes, true);
});

test("probes are compared only with --compare and without --record-probes", () => {
  assert.equal(probesCompareFile(parseArgs(["--out", "a", "--compare", "b"])), path.join("b", "probes.json"));
  assert.equal(probesCompareFile(parseArgs(["--out", "a", "--compare", "b", "--record-probes"])), null);
  assert.equal(probesCompareFile(parseArgs(["--out", "a"])), null);
});

test("--out is required and must differ from --compare", () => {
  assert.throws(() => parseArgs(["--compare", "b"]), UsageError);
  assert.throws(() => parseArgs(["--out", "same", "--compare", "same/"]), UsageError);
});

test("an unknown option is rejected, so a typo cannot switch a comparison off", () => {
  assert.throws(() => parseArgs(["--out", "a", "--compre", "b"]), /unknown option --compre/);
  assert.throws(() => parseArgs(["--out", "a", "stray"]), /unknown option stray/);
});

test("an option that takes a value needs one", () => {
  assert.throws(() => parseArgs(["--out", "a", "--compare"]), /--compare needs a directory/);
  assert.throws(() => parseArgs(["--out", "--compare", "b"]), /--out needs a directory/);
});

test("--record-probes needs --compare and a screenshot pass", () => {
  assert.throws(() => parseArgs(["--out", "a", "--record-probes"]), /--record-probes needs --compare/);
  assert.throws(
    () => parseArgs(["--out", "a", "--compare", "b", "--probes-only", "--record-probes"]),
    /--record-probes cannot be combined with --probes-only/,
  );
});

test("the missing-probes message points at the baseline build", () => {
  const msg = missingBaselineProbesMessage(path.join("b", "probes.json"), "b");
  assert.match(msg, /baseline build/);
  assert.match(msg, /SWEEP_BASE_URL/);
  assert.match(msg, /--probes-only --out b/);
  assert.match(msg, /not the current one/);
});
