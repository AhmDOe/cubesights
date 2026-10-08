#!/usr/bin/env node
// Prints the next actionable leaf task from a ticket's `## Tasks` checklist
// (see .tickets/Agents.md §3.1): resumes an in-progress `[-]` leaf before starting
// a new `[ ]` leaf. Tasks are selected in document order, which is already
// depth-first pre-order because of how nested markdown lists are written.
// No dependencies — must work before ticket 001 scaffolds the app.

import fs from "node:fs";
import path from "node:path";

const TICKETS_DIR = path.resolve(process.cwd(), ".tickets");
const CHECKBOX = /^(\s*)-\s\[([ xX-])\]\s*(.*)$/;

const ticketArg = process.argv[2];
if (!ticketArg) {
  console.error("Usage: node .tickets/scripts/select-next-task.mjs <ticket-number>");
  process.exit(1);
}

const num = String(ticketArg).padStart(3, "0");
const match = fs
  .readdirSync(TICKETS_DIR, { withFileTypes: true })
  .find((d) => d.isDirectory() && d.name.startsWith(`ticket-${num}-`));

if (!match) {
  console.error(`No ticket folder matching ticket-${num}-* under .tickets/`);
  process.exit(1);
}

const prdPath = path.join(TICKETS_DIR, match.name, "prd.md");
const lines = fs.readFileSync(prdPath, "utf8").split(/\r?\n/);

const startIdx = lines.findIndex((l) => /^##\s+Tasks\s*$/i.test(l.trim()));
if (startIdx === -1) {
  console.error(`No "## Tasks" section found in ${prdPath}`);
  process.exit(1);
}

let endIdx = lines.length;
for (let i = startIdx + 1; i < lines.length; i++) {
  if (/^##\s+/.test(lines[i])) {
    endIdx = i;
    break;
  }
}

const STATE_BY_CHAR = { " ": "idle", "-": "in-progress", x: "done", X: "done" };

const nodes = [];
for (let i = startIdx + 1; i < endIdx; i++) {
  const m = lines[i].match(CHECKBOX);
  if (!m) continue;
  nodes.push({
    line: i + 1,
    indent: m[1].length,
    state: STATE_BY_CHAR[m[2]],
    text: m[3].trim(),
    parent: null,
    children: [],
  });
}

if (nodes.length === 0) {
  console.error(`The "## Tasks" section in ${prdPath} has no checkbox items.`);
  process.exit(1);
}

// Build the tree from indentation using a stack of open ancestors.
const openAncestors = [];
for (const node of nodes) {
  while (openAncestors.length && openAncestors[openAncestors.length - 1].indent >= node.indent) {
    openAncestors.pop();
  }
  if (openAncestors.length) {
    const parent = openAncestors[openAncestors.length - 1].node;
    node.parent = parent;
    parent.children.push(node);
  }
  openAncestors.push({ indent: node.indent, node });
}

function breadcrumb(node) {
  const chain = [];
  for (let cur = node.parent; cur; cur = cur.parent) chain.unshift(cur.text);
  return chain;
}

const leaves = nodes.filter((n) => n.children.length === 0);
const selected = leaves.find((n) => n.state === "in-progress") ?? leaves.find((n) => n.state === "idle");

if (!selected) {
  console.log(`All tasks complete for ticket #${num}.`);
  process.exit(0);
}

const idMatch = selected.text.match(/\b\d{3}-T[\d.]+\b/);
const crumb = breadcrumb(selected);

console.log(`Ticket: #${num}`);
console.log(`Task: ${idMatch ? idMatch[0] : "(no id found)"} — ${selected.text}`);
if (crumb.length > 0) console.log(`Under: ${crumb.join(" > ")}`);
console.log(`State: ${selected.state}`);
console.log(`Line: ${selected.line} (${prdPath})`);
