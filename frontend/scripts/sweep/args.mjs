// Command-line options of the sweep (see README.md).
import fs from "node:fs";
import path from "node:path";

export const USAGE =
  "usage: npm run sweep -- --out <dir> [--compare <dir>] [--probes-only] [--record-probes]";

export class UsageError extends Error {}

export function parseArgs(argv) {
  const args = { probesOnly: false, recordProbes: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--compare") args.compare = argv[++i];
    else if (argv[i] === "--probes-only") args.probesOnly = true;
    else if (argv[i] === "--record-probes") args.recordProbes = true;
  }
  if (!args.out) throw new UsageError(USAGE);
  if (args.compare && samePath(args.out, args.compare)) {
    throw new UsageError(`--out and --compare must be different directories (both are ${args.compare})`);
  }
  return args;
}

// The probes.json this run's probes must equal, or null when they are only
// recorded: without --compare, or with --record-probes for a change that
// alters the look on purpose (screenshots are still compared).
export function probesCompareFile({ compare, recordProbes }) {
  return compare && !recordProbes ? path.join(compare, "probes.json") : null;
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
