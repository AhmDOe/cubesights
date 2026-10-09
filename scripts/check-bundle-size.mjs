#!/usr/bin/env node
// 001-R13: asserts the "/" route's First Load JS (gzip, as reported by `next build` itself)
// stays under the ceiling. Runs a real production build — this is the CI gate, not an estimate.

import { spawnSync } from "node:child_process";

const CEILING_KB = 150;

const result = spawnSync("npx next build", {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: true,
});

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(output);

if (result.status !== 0) {
  console.error("check-bundle-size: `next build` failed; cannot assert bundle size.");
  process.exit(result.status ?? 1);
}

// Next prints a route table like:
//   ┌ ○ /                                    10.2 kB         114 kB
// Match the "/" row specifically and pull its "First Load JS" column (the second size value).
const lineMatch = output.match(/[○ƒ]\s+\/\s+[\d.]+\s*[kKmM]?B\s+([\d.]+)\s*([kKmM])B/);

if (!lineMatch) {
  console.error('check-bundle-size: could not find the "/" route in the build output.');
  process.exit(1);
}

const [, sizeStr, unit] = lineMatch;
const sizeKB = unit.toLowerCase() === "m" ? parseFloat(sizeStr) * 1024 : parseFloat(sizeStr);

console.log(`\ncheck-bundle-size: "/" First Load JS = ${sizeKB.toFixed(1)} kB (ceiling ${CEILING_KB} kB)`);

if (sizeKB > CEILING_KB) {
  console.error(
    `check-bundle-size: FAILED — ${sizeKB.toFixed(1)} kB exceeds the ${CEILING_KB} kB ceiling (001-R13). ` +
      "If this growth is expected, raise the ceiling in ticket 001's PRD by amendment, not here.",
  );
  process.exit(1);
}

console.log("check-bundle-size: OK");
