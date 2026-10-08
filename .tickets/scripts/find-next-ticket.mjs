#!/usr/bin/env node
// Prints the next ticket to plan or implement, in strict ascending numeric order.
// Skips any ticket whose prd.md's literal first line is a `> SKIPPED` / `> IGNORED` banner
// (see .tickets/Agents.md §1.1), and any ticket whose Status is done/cancelled/skipped.
// No dependencies — must work before ticket 001 scaffolds the app.

import fs from "node:fs";
import path from "node:path";

const TICKETS_DIR = path.resolve(process.cwd(), ".tickets");
const SKIP_BANNER = /^>\s*(SKIPPED|IGNORED)\b/i;
const TERMINAL_STATUSES = new Set(["done", "cancelled", "skipped"]);

function listTicketDirs() {
  return fs
    .readdirSync(TICKETS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^ticket-\d{3}-.+$/.test(d.name))
    .map((d) => {
      const [, num, slug] = d.name.match(/^ticket-(\d{3})-(.+)$/);
      return { num: Number(num), slug, dir: d.name };
    })
    .sort((a, b) => a.num - b.num);
}

function readPrd(dir) {
  const prdPath = path.join(TICKETS_DIR, dir, "prd.md");
  if (!fs.existsSync(prdPath)) return null;
  return fs.readFileSync(prdPath, "utf8");
}

function isSkipped(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  return SKIP_BANNER.test(firstLine.trim());
}

function extractStatus(text) {
  const m = text.match(/\|\s*Status\s*\|\s*([A-Za-z-]+)\s*\|/);
  return m ? m[1].toLowerCase() : "unknown";
}

const tickets = listTicketDirs();
const skipped = [];
let next = null;

for (const ticket of tickets) {
  const text = readPrd(ticket.dir);
  if (text === null) continue;

  if (isSkipped(text)) {
    skipped.push(ticket);
    continue;
  }

  const status = extractStatus(text);
  if (TERMINAL_STATUSES.has(status)) continue;

  next = { ...ticket, status };
  break;
}

if (skipped.length > 0) {
  const ids = skipped.map((t) => `#${String(t.num).padStart(3, "0")}`).join(", ");
  console.error(`Skipped (banner): ${ids}`);
}

if (!next) {
  console.log("No open tickets. All tickets are done, cancelled, or skipped.");
  process.exit(0);
}

const paddedNum = String(next.num).padStart(3, "0");
console.log(`Next ticket: #${paddedNum} ${next.slug}`);
console.log(`Status: ${next.status}`);
console.log(`Path: .tickets/${next.dir}/prd.md`);

if (next.status === "blocked") {
  console.log(
    "Note: this ticket is blocked. Resolve the blocker named in its PRD before implementing " +
      "— sequential order holds here, it is not skipped automatically.",
  );
}
