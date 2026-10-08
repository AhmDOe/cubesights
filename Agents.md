# Agents.md — CubeSights

Operating instructions for any AI agent or human contributor working in this repository.

## 1. What this project is

CubeSights is a T3-stack web app that reads the state of a physical 3x3x3 Rubik's cube — either
from a Bluetooth smart cube's live move/state stream or from a low-latency device-camera scan of the
six faces — and immediately shows the user a move sequence that solves it, in the solving method
they chose: CFOP, Roux, ZZ, ZB, one-handed (OH), or blindfolded (BLD with M2 edges / Old Pochmann
corners, explicit setup moves and letter-pair targets). The UI is deliberately minimal: connect or
scan, pick a method, read the solution. Every architectural decision is subordinate to one goal —
**the shortest possible wall-clock time from "cube in hand" to "solution visible"**, which in
practice means the camera vision loop and the solver both run client-side, off the main thread, with
hard latency budgets.

The immutable original brief is [`project.prd.md`](./project.prd.md). All work is tracked as tickets;
the ticket workflow is specified in [`.tickets/Agents.md`](./.tickets/Agents.md).

## 2. Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js (App Router) via `create-t3-app` | T3 defaults. |
| Language | TypeScript, `strict: true` | No `any` in cube-domain code. |
| Styling | Tailwind CSS | Minimal design system; no component library. |
| API | tRPC | Thin. Most logic is client-side by design (see below). |
| ORM / DB | Prisma + SQLite (dev) | **Deferred for the POC.** Scaffolded, not load-bearing. |
| Auth | NextAuth | **Deferred for the POC.** Scaffolded, not load-bearing. |
| Cube domain | [`cubing`](https://js.cubing.net/cubing/) (cubing.js) | `cubing/alg`, `cubing/kpuzzle`, `cubing/twisty`, `cubing/scramble`. MPL-2.0 OR GPL-3.0-or-later. |
| Solver | [`min2phase`](https://github.com/cubing/min2phase.js) (Chen Shuang's Kociemba two-phase, JS port) | Runs in a Web Worker. |
| Step solvers | [`cube-solver`](https://github.com/torjusti/cube-solver) (MIT) | Cross, XCross, Roux FB, ZZ EOLine + ZBLL/CMLL/LSE scramble generators. |
| Smart cube BLE | [`smartcube-web-bluetooth`](https://github.com/poliva/smartcube-web-bluetooth) (MIT) primary, [`cubing/bluetooth`](https://js.cubing.net/cubing/bluetooth/) fallback | GAN Gen1-4, Giiker/Mi, GoCube/Rubik's Connected, MoYu, QiYi. |
| Vision | Custom WebGL/Canvas sampling in a Worker; `@techstark/opencv-js` (Apache-2.0) only if contour detection proves necessary | See ticket 003 for the latency rationale. |
| Testing | Vitest + React Testing Library + Playwright | See `.tickets/Agents.md` §4. |

**Why the client does the heavy lifting:** a round trip to a server for vision or solving would
blow the latency budget, and nothing about solving a cube needs a server. Prisma/NextAuth stay in
the tree (solve history, saved letter schemes, and algorithm-set progress are obvious follow-ups)
but no POC ticket may make a network call a prerequisite for producing a solution. The app must
work offline after first load.

**Hard platform constraint, and why camera input is not optional:** Web Bluetooth is unavailable on
Safari for iOS, iPadOS and macOS, and on Firefox — it ships only on Chromium-based desktop and
Android browsers ([caniuse](https://caniuse.com/web-bluetooth),
[WebBluetoothCG implementation status](https://github.com/WebBluetoothCG/web-bluetooth/blob/main/implementation-status.md)).
On roughly half of mobile traffic the camera scanner is the *only* possible input path. Treat it as
a first-class input, never a degraded fallback.

## 3. Repository map

```
project.prd.md                 Immutable original brief. Never edit.
Agents.md                      This file.
.tickets/
  Agents.md                    Ticket system operating manual (BDD/TDD rules, workflow, statuses).
  ticket-001-foundation-cube-core/prd.md
  ticket-002-smart-cube-bluetooth/prd.md
  ticket-003-camera-cube-scanner/prd.md
  ticket-004-solver-engine-method-pipeline/prd.md
  ticket-005-solution-playback-ui/prd.md
```

Planned source layout once ticket 001 scaffolds the app (specified there, restated here so agents
put files in the expected place):

```
src/
  app/                         Next.js App Router routes.
  components/                  Presentational React components (Tailwind only).
  cube/
    core/                      Facelet/CubeState types, validation, notation, adapters. Zero deps on React.
    input/
      bluetooth/               Smart cube drivers + state reconstruction.
      camera/                  Vision pipeline, worker, calibration.
    solve/
      engines/                 min2phase worker, step solvers.
      methods/                 Per-method solution planners (cfop, roux, zz, zb, oh, bld).
    model/                     SolutionPlan / SolutionStep shared result types.
  server/                      tRPC routers, Prisma client (minimal for POC).
```

`src/cube/core` is the keystone: it is pure TypeScript, framework-free, exhaustively unit-tested,
and every other module depends on it rather than on each other. Bluetooth, camera, solvers and UI
must never import from one another directly.

## 4. Working rules

### 4.1 Model usage policy (mandated by the brief)

- **All planning, architecture, design and ticket authoring uses Opus** (or the current
  top-reasoning model). That includes: writing a ticket PRD, revising one, choosing libraries,
  designing data models and module boundaries, defining latency budgets, writing the BDD scenarios
  and the TDD test plan, and reviewing completed work.
- **All routine implementation uses a fast model** (Sonnet/Haiku fast modes). A fast model may begin
  only after the ticket's PRD exists, is complete per `.tickets/Agents.md` §3, and has `Status:
  planned` or later. The fast model implements *against the PRD* and does not redesign.
- **Escalate back to Opus** when implementation reveals the PRD is wrong, ambiguous, or
  underspecified. Do not improvise a design change in a fast model — stop, record the problem in the
  ticket's *Open questions / risks* section, and have Opus amend the PRD.
- Never create a new ticket, change a ticket's Scope, or change its acceptance criteria from a fast
  model.

### 4.2 Code rules

- TypeScript `strict`. The cube domain uses branded/literal types (`FaceletString`, `Move`,
  `Target`) rather than bare `string`.
- No main-thread blocking work. Vision and solving run in Web Workers; solver table initialisation
  is warmed during idle time at app boot.
- No new runtime dependency without a note in the relevant ticket PRD stating the package, version,
  licence, and why it beats writing it ourselves.
- Licence hygiene: `cubing` is MPL-2.0 OR GPL-3.0-or-later and `cstimer`-derived code is GPL-3.0.
  Keep those as library imports; do not copy GPL source into our tree.
- Every module under `src/cube/` has a co-located `*.test.ts`.

### 4.3 Definition of done

A ticket is `done` only when all of the following hold:

1. Every acceptance criterion in the ticket PRD is met and demonstrably exercised.
2. Every BDD scenario in the PRD has a corresponding executable test (Playwright, or Vitest where
   the scenario is non-UI) and it passes.
3. The PRD's TDD plan is fully implemented: unit and integration tests exist, were written before
   the implementation, and pass.
4. Stated non-functional targets are measured, not assumed — latency budgets have an automated or
   scripted measurement recorded in the ticket.
5. No regressions: the whole suite (`vitest run` + `playwright test`) is green.
6. `tsc --noEmit` and lint are clean.
7. The PRD's `Status` field is updated to `done` and the *Verification notes* section records how
   each latency/accuracy number was measured.
