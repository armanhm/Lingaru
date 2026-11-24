// Command-line options of the sweep (see README.md).
import fs from "node:fs";
import path from "node:path";

export const USAGE =
  "usage: npm run sweep -- --out <dir> [--compare <dir>] [--probes-only] [--record-probes]";

export class UsageError extends Error {}

const usage = (message) => new UsageError(`${message}\n${USAGE}`);
const VALUE_OPTIONS = { "--out": "out", "--compare": "compare" };
const FLAGS = { "--probes-only": "probesOnly", "--record-probes": "recordProbes" };

// Unknown options, missing values and flag combinations that would compare
// nothing are usage errors: a typo must not silently switch a check off.
export function parseArgs(argv) {
  const args = { probesOnly: false, recordProbes: false };
  for (let i = 0; i < argv.length; i++) {
    const option = argv[i];
    if (Object.hasOwn(VALUE_OPTIONS, option)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw usage(`${option} needs a directory`);
      args[VALUE_OPTIONS[option]] = value;
      i++;
    } else if (Object.hasOwn(FLAGS, option)) {
      args[FLAGS[option]] = true;
    } else {
      throw usage(`unknown option ${option}`);
    }
  }
  if (!args.out) throw new UsageError(USAGE);
  if (args.recordProbes && !args.compare) {
    throw usage("--record-probes needs --compare (without --compare no probes are compared anyway)");
  }
  if (args.recordProbes && args.probesOnly) {
    throw usage("--record-probes cannot be combined with --probes-only (the run would compare nothing)");
  }
  if (args.compare && samePath(args.out, args.compare)) {
    throw new UsageError(`--out and --compare must be different directories (both are ${args.compare})`);
  }
  return args;
}

// The probes.json this run's probes must equal, or null when they are only
// recorded: without --compare, or with --record-probes for a change that
// alters the look on purpose. Such a run still computes each screenshot's
// diffRatio and records contrast and overflow in report.json, but nothing in
// it fails on them: compare report.json with the baseline's yourself.
export function probesCompareFile({ compare, recordProbes }) {
  return compare && !recordProbes ? path.join(compare, "probes.json") : null;
}

// The probes must come from the baseline build: recording them from the build
// under test would make the comparison vacuous.
export function missingBaselineProbesMessage(file, compare) {
  return (
    `missing ${file}; capture the probes from the baseline build, not the current one: ` +
    `serve the baseline commit (for example a dev server on a checkout of main), then run ` +
    `the sweep with SWEEP_BASE_URL pointing at that server and --probes-only --out ${compare}`
  );
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
