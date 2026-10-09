#!/usr/bin/env node
// 001-R11: greps every ticket PRD for BDD scenario ids (@nnn-Sn), greps the test suite for the
// same ids, and exits non-zero if any PRD scenario has no matching test name. This is the
// enforcement mechanism behind ".tickets/Agents.md" §4.2 ("BDD coverage for all features and
// sub-features" made checkable rather than aspirational).

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCENARIO_ID = /@(\d{3}-S\d+)\b/g;

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (predicate(entry.name)) out.push(full);
  }
  return out;
}

function idsIn(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return new Set([...text.matchAll(SCENARIO_ID)].map((m) => m[1]));
}

const prdFiles = walk(path.join(ROOT, ".tickets"), (name) => name === "prd.md");
const testFiles = walk(
  ROOT,
  (name) => /\.(test|spec)\.(ts|tsx|js)$/.test(name) || /^check-docker-stack\.(sh|ps1)$/.test(name),
);

const requiredIds = new Map(); // id -> prd file(s) that declare it
for (const prd of prdFiles) {
  for (const id of idsIn(prd)) {
    if (!requiredIds.has(id)) requiredIds.set(id, []);
    requiredIds.get(id).push(path.relative(ROOT, prd));
  }
}

const coveredIds = new Set();
for (const test of testFiles) {
  for (const id of idsIn(test)) coveredIds.add(id);
}

const orphaned = [...requiredIds.keys()].filter((id) => !coveredIds.has(id)).sort();

if (orphaned.length > 0) {
  console.error(`check-scenarios: ${orphaned.length} BDD scenario id(s) have no matching test:\n`);
  for (const id of orphaned) {
    console.error(`  @${id}  (declared in ${requiredIds.get(id).join(", ")})`);
  }
  process.exit(1);
}

console.log(`check-scenarios: all ${requiredIds.size} BDD scenario ids have a matching test.`);
