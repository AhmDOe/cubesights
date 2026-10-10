# .tickets/Agents.md — Ticket System Operating Manual

Parent document: [`../Agents.md`](../Agents.md). Immutable project brief:
[`../project.prd.md`](../project.prd.md).

This file defines how work on CubeSights is recorded, planned, tested, implemented and closed out.
It is normative: a ticket that does not follow this structure is not ready for implementation.

---

## 1. Folder and file convention

```
.tickets/ticket-<nnn>-<short-description>/prd.md
```

- `<nnn>` — zero-padded 3-digit sequence number, allocated monotonically and never reused
  (`001`, `002`, … `042`). The number is the ticket's permanent ID; other tickets reference it as
  `#003`.
- `<short-description>` — kebab-case, lowercase, 2-5 words, describing the deliverable
  (`camera-cube-scanner`, not `camera-stuff` or `fix`).
- `prd.md` — the single source of truth for that ticket. Required.
- Optional siblings in the same folder: `notes.md` (scratch/working notes, freely editable),
  `assets/` (diagrams, sample frames, captured BLE traces, fixture cube states).
- Never rename or delete a ticket folder. A cancelled ticket gets `Status: cancelled` and a reason.
- Never edit `project.prd.md`. Scope changes become new tickets.

### 1.1 Skipping a ticket

A ticket that should be left out of the sequential queue — superseded, deferred, not worth doing —
is marked by putting a banner as the **literal first line of `prd.md`** (line 1, no blank line
before it):

```
> SKIPPED — <one-line reason>
```

or, equivalently:

```
> IGNORED — <one-line reason>
```

`SKIPPED`/`IGNORED` are synonyms; use whichever reads better. The banner, not the `Status` field,
is what scripts and agents check first — `scripts/find-next-ticket.mjs` (§6) and the "next ticket"
rule in §5.2 both skip any ticket whose first line matches it, as if the ticket were not in the
sequence at all. Keep the `Status` metadata field in sync by setting it to `skipped` (§2) so a human
scanning the ticket index sees the same thing.

To un-skip a ticket: delete the banner line and set `Status` back to an appropriate value
(`proposed` or `planned`).

## 2. Ticket statuses

| Status | Meaning | Who sets it |
| --- | --- | --- |
| `proposed` | Folder and a one-paragraph intent exist. Not implementable. | Anyone |
| `planned` | Full PRD written per §3, reviewed. Implementation may start. | Opus only |
| `in-progress` | A fast model / contributor is implementing against the PRD. | Implementer |
| `review` | Implementation complete, tests green, awaiting design review. | Implementer |
| `done` | Definition of done in [`../Agents.md`](../Agents.md) §4.3 satisfied. | Opus reviewer |
| `blocked` | Cannot proceed. Must name the blocker (ticket ID or external). | Anyone |
| `cancelled` | Abandoned permanently. Must state why. | Opus only |
| `skipped` | Intentionally excluded from the sequential queue for now — not abandoned, just not next. Set alongside the first-line banner in §1.1. | Anyone |

The `Status` line in the PRD is the authoritative record. Update it the moment the state changes —
not at the end of the session.

## 3. Required structure of a ticket `prd.md`

Every section is mandatory. "N/A" with a one-line reason is acceptable; omission is not.

1. **Title** — `# Ticket <nnn> — <Human readable title>`
2. **Metadata block** — `Status`, `Owner model` (Opus for planning / fast for impl),
   `Depends on`, `Blocks`, `Requirements` (the `R*` IDs from `project.prd.md` this ticket serves),
   `Estimated size`.
3. **Context / motivation** — why this exists, what breaks without it, which part of the user
   journey it unblocks.
4. **Dependencies** — other ticket numbers, plus external prerequisites (hardware, browser APIs,
   permissions).
5. **Scope** — explicit `In scope` and `Out of scope` lists. The out-of-scope list is as important
   as the in-scope list; it is what prevents a fast model from gold-plating.
6. **Detailed requirements** — numbered, testable statements (`<nnn>-R1`, `<nnn>-R2`, …). Each must
   be falsifiable. "Fast" is not a requirement; "p95 frame processing ≤ 33 ms at 640x480" is.
7. **Architecture / approach notes** — module boundaries, file paths, data shapes, chosen
   libraries **with links, versions and licences**, and the rationale for choosing them over the
   alternatives that were considered. Record rejected options and why.
8. **Tasks** — the implementation checklist: every unit of work as a nested markdown checkbox,
   traceable back to the *Detailed requirements* IDs, with an acceptance-test tag on every line.
   See §3.1 for checkbox syntax and §3.2 for the tag convention. This is what
   `scripts/select-next-task.mjs` (§6) reads, and what an implementer checks off while working.
9. **BDD acceptance scenarios** — Gherkin-style `Feature` / `Scenario` / `Given` / `When` / `Then`.
   Cover the happy path, each meaningful sub-feature, and realistic edge cases (permission denied,
   device disconnects mid-solve, impossible cube state, bad lighting, parity, already-solved cube).
   Each scenario carries a stable ID (`@<nnn>-S1`) used as the test name.
10. **TDD plan** — the tests that must exist *before* implementation, listed as concrete file paths
    plus the assertions each makes, split into unit / integration / E2E. Include the fixtures
    needed.
11. **Non-functional requirements** — latency budgets, accuracy thresholds, bundle-size ceilings,
    memory, offline behaviour, accessibility. With how each is measured.
12. **Acceptance criteria** — the checklist a reviewer walks to move the ticket to `done`.
13. **Open questions / risks** — unknowns, and what would invalidate the approach. This is where an
    implementer records a PRD defect for Opus to resolve.
14. **Verification notes** — filled in during `review`/`done`: measured numbers, how they were
    obtained, deviations from plan.

### 3.1 Task checklist syntax

Every ticket's `## Tasks` section is a nested markdown checkbox list. A subtask is a task — it can
have its own nested subtasks, to any depth — so the same three states and the same rules apply at
every level:

| Box | State | Meaning |
| --- | --- | --- |
| `- [ ]` | idle | Not started. |
| `- [-]` | in-progress | Being worked on right now (leaf), or — for a task with children — at least one child is `[-]` or `[x]` but not all children are `[x]` yet. |
| `- [x]` | done | Leaf: verified complete. Parent: **every** child is `[x]`. Never check a parent by hand ahead of its children. |

Syntax rules:

- Indent each nested level by exactly **2 spaces**, standard markdown list nesting:

  ```markdown
  ## Tasks

  - [ ] 003-T1 Camera capture
    - [ ] 003-T1.1 Request getUserMedia with the rear-camera constraints
    - [ ] 003-T1.2 Handle NotAllowedError / NotFoundError / NotReadableError distinctly
  - [-] 003-T2 Frame pump
    - [x] 003-T2.1 Drive from requestVideoFrameCallback with rAF fallback
    - [ ] 003-T2.2 Latest-frame-wins dropping when the worker is busy
  ```

- Every task carries a stable id `<nnn>-T<dotted-path>` (e.g. `003-T2.2`), mirroring the `@<nnn>-Sn`
  scenario ids in §3 item 9. The dotted path reflects nesting depth, not an arbitrary count.
- Update checkboxes **bottom-up** as you work: flip the leaf first, then immediately walk up and
  fix each ancestor's state so the tree is never inconsistent with the rule above. The scripts in
  §6 trust this invariant and do not re-derive it.
- Keep task granularity close to the *Detailed requirements* — one top-level task per requirement
  id is the usual shape, with subtasks for any requirement that genuinely has sequential parts.
  Don't restate the TDD plan as tasks; "write the tests in the TDD plan and make them pass" is
  itself one task.

### 3.2 Acceptance-test tags on every task

Every task and subtask line — leaf or parent, no exceptions — ends with a tag naming the check
that proves it done. A task without one is not plannable; `check-scenarios.mjs` (§4.2) treats a
missing tag the same as an orphaned BDD scenario id. Four tag kinds cover every task in this
project:

| Tag | Use when | Form |
| --- | --- | --- |
| `TDD` | The task is pure logic with a deterministic input/output (a function, a type, a reducer). | `(TDD: path/to/file.test.ts)` — the file from the ticket's TDD plan that exercises it. |
| `BDD` | The task is user-/system-observable behaviour (a UI flow, a connection lifecycle, an end-to-end path). | `(BDD: @nnn-Sn)` — the scenario id from the ticket's BDD section, or a comma-separated list if more than one applies. |
| `logical-eval` | The task is an invariant, property, or data-correctness claim that a single example doesn't prove — a property-based test, an exhaustive table check, a verification pass over generated output. | `(logical-eval: <one-line statement of the invariant checked>)`, naming the test file if one exists (e.g. the BLD table-verification test, the golden-invariant check). |
| `reasoning` | The task has no executable check at all — a library/version decision, a licence read, a config choice, a manual judgement call. | `(reasoning: <one-line statement of what was verified by inspection and by whom — Opus or a human>)`. Use sparingly; prefer one of the other three whenever a task can be made checkable. |

Rules:

- A **leaf** task's tag is the thing that actually gets run (a real test file, a real scenario id).
- A **parent** task's tag may be a `logical-eval` or `reasoning` summarizing how its children's
  checks together prove it (e.g. "all five child tasks' tests pass and the stage-consistency
  invariant holds across them") — or, more simply, parents may omit a tag when every child already
  carries one, since the parent's completion rule in §3.1 (`[x]` only when all children are `[x]`)
  already makes it derived rather than independently checkable.
- Prefer `TDD`/`BDD` over `logical-eval`, and all three over `reasoning` — `reasoning` is the tag of
  last resort for things that are genuinely not executable, not a shortcut around writing a test.
- When a task's check doesn't exist yet (the PRD names the test file but it hasn't been written),
  tag it anyway — the tag is a commitment, and TDD discipline means the test is written (and seen
  to fail) before the implementation that satisfies it.

## 4. Testing stack (standardised across all tickets)

| Tool | Version intent | Used for |
| --- | --- | --- |
| **Vitest** | latest 3.x | Unit + integration tests. Default runner. `jsdom` environment for component tests, `node` for pure cube logic. |
| **React Testing Library** + `@testing-library/user-event` | latest | Component behaviour tests. Query by role/label, never by class name. |
| **Playwright** | latest | E2E and browser-only APIs: camera (fake device), Web Bluetooth (mocked), Web Workers, WebGL, worker-based vision timing. |
| **`@vitest/coverage-v8`** | latest | Coverage. Gate: ≥ 90% lines in `src/cube/core`, ≥ 80% elsewhere in `src/cube`. |
| **`fast-check`** | latest | Property-based tests for cube logic (see §4.3). |
| **`vitest-axe`** / `@axe-core/playwright` | latest | Accessibility assertions on the minimal UI. |

Rejected: Jest (slower, extra config under Vite/Next), Cucumber.js (a second Gherkin runtime buys
nothing — see §4.2), Cypress (weaker worker/fake-camera support than Playwright).

### 4.1 Where each kind of test lives

```
src/cube/**/<name>.test.ts          Vitest unit tests, co-located.
src/components/**/<Name>.test.tsx   Vitest + RTL component tests, co-located.
tests/integration/*.test.ts         Vitest integration tests crossing module boundaries.
tests/e2e/*.spec.ts                 Playwright specs. One file per ticket's BDD feature.
tests/fixtures/                     Shared fixtures: facelet strings, BLE traces, scan frames.
tests/perf/*.spec.ts                Playwright specs that assert latency budgets.
```

### 4.2 Mapping Gherkin scenarios to real test files

We do **not** run a Gherkin parser. The PRD's scenarios are the specification; they map
mechanically onto test code, and the scenario ID is the link.

- A scenario whose `When`/`Then` involve the browser, the camera, Bluetooth, a worker or rendering
  becomes a **Playwright test** in `tests/e2e/<ticket-slug>.spec.ts`:

  ```ts
  // Scenario @003-S4: scanner rejects a face with inconsistent colour counts
  test("@003-S4 rejects a face whose sampled colours cannot belong to a valid cube", async ({ page }) => {
    // Given  -> arrange: navigate, grant camera, load fixture frame
    // When   -> act: drive the scanner with the frame
    // Then   -> assert: visible error + no state commit
  });
  ```

  Use `test.describe("<nnn> <Feature name>")` for the `Feature` block. Keep the three
  `Given/When/Then` phases as comment-delimited blocks in that order so the scenario stays legible
  against the PRD.

- A scenario that is pure logic (state reconstruction, parity, letter-pair generation, solution
  validity) becomes a **Vitest test** with the same `@<nnn>-Sn` prefix in its name, in the
  co-located unit test file or `tests/integration/`.

- Every scenario ID must appear exactly once in the test suite. CI greps the PRDs for `@\d{3}-S\d+`
  and fails if any ID has no matching test name. This is the mechanism that makes "BDD coverage for
  all features and sub-features" enforceable rather than aspirational.

### 4.3 Cube-specific testing conventions

- **Golden invariant:** for any generated solution, applying it to the scanned state must yield the
  solved state. Assert this with `cubing/kpuzzle` (apply the alg to a `KPattern` and compare), not
  by trusting the solver. Every solver and every method planner gets this test.
- **Property-based tests** with `fast-check`: generate random valid cube states (via
  `randomScrambleForEvent("333")` or random move sequences from solved) and assert
  round-trip/solve-validity invariants over hundreds of cases rather than a handful of examples.
- **Invalid-state corpus:** keep a fixture set of deliberately impossible states — wrong sticker
  counts, single flipped edge, single twisted corner, two swapped corners — and assert the
  validator rejects each with the correct, specific error. Camera scanning will produce these in
  the wild.
- **Latency is a test, not a hope.** Timing assertions live in `tests/perf/` and run against a
  fixed fixture on a pinned Playwright browser, asserting p50/p95 over ≥ 100 iterations. Record the
  measured numbers in the ticket's *Verification notes*.
- **Hardware is mocked.** No test may require a physical smart cube. BLE drivers are tested against
  recorded byte traces in `tests/fixtures/ble/`; the camera is tested with Chromium's
  `--use-fake-device-for-media-stream` plus `--use-file-for-fake-video-capture`.

## 5. Workflow

```
proposed ──Opus writes full PRD──▶ planned ──fast model, TDD──▶ in-progress ──▶ review ──Opus──▶ done
                                      ▲                                            │
                                      └──────────── PRD defect found ──────────────┘
```

1. **Propose.** Create `.tickets/ticket-<nnn>-<slug>/prd.md` with the title, metadata and a
   Context paragraph. `Status: proposed`.
2. **Plan (Opus only).** Fill in every section of §3. Research real libraries and link them. Write
   the BDD scenarios and the TDD plan. Set latency/accuracy budgets with numbers. Then
   `Status: planned`. A ticket is not plannable if its dependencies are not at least `planned`.
3. **Implement (fast model).** Set `Status: in-progress`. Work strictly test-first:
   1. Create every test file named in the TDD plan, with the assertions described, and watch them
      fail for the right reason. Commit this state.
   2. Write the minimum implementation to turn them green, one scenario at a time.
   3. Add the Playwright specs for each `@<nnn>-Sn` scenario and make them pass.
   4. Run the perf specs and record the numbers.
   Do not add features that are not in *Detailed requirements*. Do not change the PRD except to
   append to *Open questions / risks* or fill *Verification notes*.
4. **Review.** `Status: review`. An Opus-level reviewer walks the *Acceptance criteria*, confirms
   every scenario ID has a passing test, checks the measured non-functional numbers, and checks that
   the module boundaries in *Architecture / approach notes* were respected.
5. **Close.** `Status: done`, *Verification notes* completed. Anything deferred becomes a new
   `proposed` ticket, referenced from the closed ticket's *Verification notes*.

### 5.1 Model usage policy (restated — mandated by the brief)

- **Opus plans and designs every ticket before any implementation starts.** Ticket authoring,
  architecture, library selection, data modelling, latency budgeting, BDD scenario writing, TDD
  plan writing and final review are Opus-only activities.
- **Fast models execute implementation** against a `planned` PRD, following the TDD sequence in
  §5's step 3.
- A fast model that finds the plan wrong stops and escalates. It never redesigns, never widens
  scope, and never edits the PRD's requirements, scope or acceptance criteria.

### 5.2 Selecting and updating tickets, tasks and subtasks

**Tickets are worked strictly in ascending numeric order** — 001, then 002, then 003, and so on —
one ticket at a time, except any ticket marked `SKIPPED`/`IGNORED` (§1.1), which is left out of the
sequence entirely, as if it had been renumbered around.

- **Selecting the next ticket.** Run:

  ```sh
  node .tickets/scripts/find-next-ticket.mjs
  ```

  It walks the ticket folders in numeric order, skips any with the skip banner, and prints the
  lowest-numbered remaining ticket whose `Status` is not `done`, `cancelled` or `skipped`. If that
  ticket is `blocked`, the script says so — sequential order holds at that ticket until the blocker
  clears; it is not skipped automatically.
- **Selecting the next task inside that ticket.** Run:

  ```sh
  node .tickets/scripts/select-next-task.mjs <nnn>
  ```

  It reads the ticket's `## Tasks` checklist (§3.1) and returns, in document order, the first leaf
  task that is `[-]` (resume it) or, failing that, the first leaf task that is `[ ]` (start it). A
  task with subtasks is never itself "selected" — work always happens at the leaves, which is also
  why a parent only becomes `[x]` once every leaf beneath it is.
- **Updating as you work.** The moment work starts on the selected leaf, flip it from `[ ]` to
  `[-]` and edit the ticket's `Status` to `in-progress` if it was still `planned`. The moment it is
  verified complete (its tests pass), flip it to `[x]`, then walk up its ancestor chain fixing each
  parent's state per the §3.1 rule (`[x]` only when all children are `[x]`; `[-]` if some but not
  all are). Keep at most one task `[-]` at a time per ticket — that is what keeps "the next task" an
  unambiguous question.
- **Finishing a ticket.** When `select-next-task.mjs` reports every task done, move the ticket
  through `review` → `done` per §5's steps 4-5, then re-run `find-next-ticket.mjs` to pick up the
  next one.

## 6. Scripts

`.tickets/scripts/` holds small, dependency-free Node scripts (plain `fs`/`path`, no npm install
required — they must work even before ticket 001 has scaffolded the app) that implement §5.2
mechanically rather than leaving it to manual scanning:

| Script | Usage | Does |
| --- | --- | --- |
| `find-next-ticket.mjs` | `node .tickets/scripts/find-next-ticket.mjs` | Prints the next ticket to plan or implement, honouring the skip banner (§1.1) and terminal statuses (`done`/`cancelled`/`skipped`). |
| `select-next-task.mjs` | `node .tickets/scripts/select-next-task.mjs <nnn>` | Prints the next actionable leaf task from ticket `<nnn>`'s `## Tasks` checklist (§3.1): resumes an in-progress `[-]` task before starting a new `[ ]` one. Reports the task id, its line number in `prd.md`, and its ancestor breadcrumb. |

Both are read-only — they report what to do next; you still edit the `prd.md` checkboxes by hand
(or via an editor's find/replace) as you work. Keep these scripts simple; they exist to remove the
tedium of scanning, not to become a task-management system in their own right.

## 7. Ticket index

| # | Ticket | Status | Depends on |
| --- | --- | --- | --- |
| 001 | [foundation-cube-core](./ticket-001-foundation-cube-core/prd.md) | review | — |
| 002 | [smart-cube-bluetooth](./ticket-002-smart-cube-bluetooth/prd.md) | in-progress | 001 |
| 003 | [camera-cube-scanner](./ticket-003-camera-cube-scanner/prd.md) | planned | 001 |
| 004 | [solver-engine-method-pipeline](./ticket-004-solver-engine-method-pipeline/prd.md) | planned | 001 |
| 005 | [solution-playback-ui](./ticket-005-solution-playback-ui/prd.md) | planned | 001, 004 (soft: 002, 003) |

Keep this table current. It is the fastest way for a new agent to see the state of the project. A
ticket set to `skipped` (§1.1, §2) stays listed here — strike its row's title and note the reason —
rather than being removed; `find-next-ticket.mjs` passes over it on its own.

### Next wave (not yet created — do not implement before these are planned)

`006` CFOP solution planner (cross/F2L/OLL/PLL breakdown) · `007` Roux planner (FB/SB/CMLL/LSE) ·
`008` ZZ planner (EOLine/ZZF2L/ZBLL) · `009` ZB / ZBLL recognition · `010` OH move-cost reranking ·
`011` BLD engine (OP corners + M2 edges, setup moves, parity) · `012` BLD letter scheme + memo UI ·
`013` persistence (Prisma solve history) · `014` algorithm-set reference pages.
