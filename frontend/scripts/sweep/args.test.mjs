import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { parseArgs, probesCompareFile, UsageError } from "./args.mjs";

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
