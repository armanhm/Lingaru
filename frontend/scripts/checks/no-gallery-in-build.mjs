// Fails when the dev-only UI gallery leaked into the production bundle.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const assets = join(dirname(fileURLToPath(import.meta.url)), "../../dist/assets");
const MARKER = "data-ui-gallery";

let files;
try {
  files = readdirSync(assets).filter((f) => f.endsWith(".js"));
} catch {
  console.error(`check:build: ${assets} not found; run "npm run build" first.`);
  process.exit(1);
}
const leaked = files.filter((f) => readFileSync(join(assets, f), "utf8").includes(MARKER));
if (leaked.length) {
  console.error(`check:build: "${MARKER}" found in the production bundle: ${leaked.join(", ")}`);
  process.exit(1);
}
console.log(`check:build: ok (${files.length} JS files, no gallery)`);
