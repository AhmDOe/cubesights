# Ticket 001 — Foundation: T3 scaffold, cube-core domain model, testing harness, 3D visualizer

| Field | Value |
| --- | --- |
| Status | planned |
| Owner model | Opus (planning) → fast model (implementation) |
| Depends on | — |
| Blocks | 002, 003, 004, 005 |
| Requirements | R1, R2, R11, R13 |
| Estimated size | L (largest of the five; everything else depends on getting the types right) |

## Context / motivation

Three independent subsystems — Bluetooth input, camera input, and solving — all speak about "the
state of a cube" and "a sequence of moves". If each invents its own representation, every pair of
subsystems needs an adapter and the method-specific planners (CFOP/Roux/ZZ/ZB/OH/BLD) in the next
wave cannot be added without rework. This ticket establishes the single canonical cube
representation, the conversions to and from every library we depend on, the validator that rejects
physically impossible states, and the one visual component everything renders through. It also
wires the test harness so tickets 002-005 can be written test-first on day one.

Nothing in this ticket is user-visible beyond a minimal shell page that renders a cube and plays an
algorithm. That is deliberate: it is the smallest artefact that proves the domain model, the
rendering, and the test harness all work together.

## Dependencies

- None internal.
- External: Node 20+, `create-t3-app`, npm registry access.

## Scope

**In scope**

- `create-t3-app` scaffold (Next.js App Router, TypeScript, Tailwind, tRPC, Prisma, NextAuth).
- `src/cube/core`: facelet/state types, notation types, validator, library adapters, scramble
  helper.
- Testing harness: Vitest (two environments), React Testing Library, Playwright, coverage gate,
  `fast-check`, the scenario-ID CI grep described in `.tickets/Agents.md` §4.2.
- `<CubeView>` React wrapper around cubing.js `TwistyPlayer`, SSR-safe.
- A minimal `/` shell: render a cube, generate a WCA scramble, apply it, step through it.
- Design tokens: Tailwind config with the minimal palette/typography the rest of the app uses.
- **Docker Compose stack** for running and debugging the whole project locally with one command,
  and for running the E2E suite the same way CI does.

**Out of scope**

- Any Bluetooth code (002), any camera code (003), any solver (004), the real solution UI (005).
- Auth flows, database schema beyond the `create-t3-app` default, deployment.
- Method-specific logic. `core` must know nothing about CFOP, Roux, ZZ, ZB, OH or BLD.

## Detailed requirements

- **001-R1** Scaffold a T3 app with TypeScript `strict: true`, Tailwind, tRPC, Prisma (SQLite),
  NextAuth. Prisma/NextAuth are left at defaults and are not on the critical path of any page.
- **001-R2** Define `FaceletString`: a branded 54-character string in **URFDLB** face order — the
  Kociemba/min2phase convention — with indices 0-8 = U, 9-17 = R, 18-26 = F, 27-35 = D, 36-44 = L,
  45-53 = B, each face read row-major from its own top-left as seen with U up and F front. Each
  character is one of `U R F D L B` denoting the *face a sticker belongs to*. Solved state is
  `UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB`.
- **001-R3** Define `ColorFacelets`: the same 54 slots but holding observed colours
  (`W Y R O G B` plus `unknown`), which is what the camera produces before colour→face resolution.
  Provide `resolveColorFaceletsToFacelets()` which maps colours to faces using the six centre
  stickers, and fails with a specific error if centres are ambiguous or duplicated.
- **001-R4** Define `CubeState` as the app-wide value object:
  `{ facelets: FaceletString; source: "smart-cube" | "camera" | "manual" | "scramble"; capturedAt: number; confidence?: number }`.
  Immutable. Every subsystem produces or consumes this and nothing else.
- **001-R5** Define move/notation types on top of `cubing/alg`: `Move` (face turns `U U' U2` ×6,
  wide turns `Uw Rw …`, slices `M E S`, rotations `x y z` and their primes/doubles),
  `MoveSequence = Move[]`, and `parseAlg`/`formatAlg` helpers that round-trip through
  `cubing/alg`'s `Alg`. Formatting must be stable (canonical spacing, no redundant `1` suffixes).
- **001-R6** Implement `validateFacelets(facelets): Result<ValidCubeState, CubeStateError>` checking,
  in order, with distinct error codes: (a) length 54; (b) exactly 9 of each face letter;
  (c) 6 distinct centres; (d) all 12 edge pairs exist and are unique; (e) all 8 corner triples exist,
  are unique and are not mirrored/invalid; (f) corner orientation sum ≡ 0 (mod 3);
  (g) edge orientation sum ≡ 0 (mod 2); (h) permutation parity of corners equals that of edges.
  Errors carry the offending facelet indices so the camera UI (003) can highlight exactly which
  stickers to re-check.
- **001-R7** Provide adapters in `src/cube/core/adapters/`:
  `toMin2PhaseFacelets()` / `fromMin2PhaseFacelets()`, `toKPattern()` / `fromKPattern()` for
  `cubing/kpuzzle` `3x3x3`, and `applyMoves(state, moves): CubeState` implemented via
  `cubing/kpuzzle` so move application is never hand-rolled. All adapters are round-trip tested.
- **001-R8** Provide `generateScramble(): Promise<MoveSequence>` wrapping
  `randomScrambleForEvent("333")` from `cubing/scramble`, plus `scrambledState()` returning the
  resulting `CubeState`. Lazy-load the module so its WASM is not in the initial bundle.
- **001-R9** `<CubeView>` component: props
  `{ state?: CubeState; alg?: MoveSequence; moveIndex?: number; highlight?: FaceletIndex[]; stickering?: string; interactive?: boolean; onMove?: (m: Move) => void }`.
  Wraps `TwistyPlayer` (`cubing/twisty`) imported dynamically with
  `next/dynamic({ ssr: false })` because it is a custom element that touches `window`/WebGL at
  module scope. Sets `experimentalSetupAlg` from `state` and `alg` for the playback sequence, and
  drives `moveIndex` through the player's timeline so ticket 005 can scrub without re-mounting.
  Expose an imperative handle (`play/pause/jumpTo(index)`).
- **001-R10** Testing harness wired and demonstrably running: `vitest.config.ts` with projects for
  `node` (pure cube logic) and `jsdom` (components); `playwright.config.ts` with a Chromium project
  carrying the fake-camera and fake-bluetooth flags that 002/003 will need;
  `npm run test`, `test:unit`, `test:e2e`, `test:perf`, `test:coverage`, `typecheck`, `lint`.
- **001-R11** CI script `scripts/check-scenarios.mjs` greps all `.tickets/**/prd.md` for
  `@\d{3}-S\d+` IDs, greps the test suite for the same IDs, and exits non-zero on any PRD scenario
  with no test. Wired into `npm run test`.
- **001-R12** Minimal shell page at `/`: a `<CubeView>`, a "Scramble" button, prev/next move
  buttons, and the current alg as text. Tailwind only, no component library, high contrast, works at
  360 px width. This page is throwaway UI that 005 replaces; it exists to prove the pipeline.
- **001-R13** Bundle discipline: the `/` route's initial JS (excluding the lazily-loaded twisty and
  scramble chunks) stays under 150 kB gzipped, asserted by a size check in CI.
- **001-R14** Docker Compose stack for local development and debugging. Root-level
  `docker-compose.yml` plus `Dockerfile.dev`, bringing up the whole project with one command and
  making every service's logs inspectable with one command:
  - `app` service — Node 20, bind-mounts the repo source (hot reload via `next dev`), named volume
    for `node_modules` so the host's `npm install` and the container's don't fight, reads config
    from a committed `.env.example` (actual `.env` stays gitignored), exposes `3000:3000`.
  - `test` service — the same image, Compose **profile** `test` so it never starts on a bare
    `docker compose up`, runs `npm run test:e2e` against the `app` service over the Compose
    network, writes the Playwright HTML report and trace files to a bind-mounted
    `playwright-report/` so they're inspectable from the host after the container exits.
  - Logging discipline: both services log to stdout/stderr only (12-factor), Docker's default
    `json-file` driver, plain (non-JSON-wrapped) text in dev so `docker compose logs -f app` is
    directly readable — no separate log-viewing tool required. This is the concrete mechanism
    behind "debugging is easy by evaluating container or application logs": a hung camera-pipeline
    worker, a failed solver init, or a crashed dev server all show up in `docker compose logs`.
  - `docker compose up -d app` must result in `http://localhost:3000/` responding within the
    latency budget below, and `docker compose logs app` must show the Next.js ready line.
  - `docker compose run --rm test` must run the full Playwright suite headlessly against the
    containerized app and exit non-zero on any failure.
  - A smoke-test script (`scripts/check-docker-stack.sh` — or `.ps1` on Windows, both committed)
    starts the stack, polls `/` for HTTP 200 up to the timeout, prints pass/fail, and tears down —
    this is what CI and a human run to confirm the stack is healthy without eyeballing logs by hand.

## Architecture / approach notes

**Why cubing.js as the foundation.** [cubing.js](https://js.cubing.net/cubing/) (npm package
[`cubing`](https://github.com/cubing/cubing.js), dual-licensed MPL-2.0 OR GPL-3.0-or-later, ~5.2k
commits, actively maintained by the team behind WCA Live / Twizzle) already provides, as separate
tree-shakeable entry points: `cubing/alg` (a full SiGN + WCA notation parser and `Alg` algebra),
`cubing/kpuzzle` (generic puzzle definitions and move application), `cubing/twisty` (the
`<twisty-player>` WebGL 3D visualizer with a playback timeline), `cubing/scramble`
(`randomScrambleForEvent`, WCA-legal random-*state* scrambles — the same guarantees as TNoodle, now
powered by [twips](https://github.com/cubing/twips), the planned TNoodle replacement), and
`cubing/bluetooth` (smart cube BLE). Re-implementing a notation parser, move engine, 3D renderer and
WCA scrambler would cost weeks and be worse. We take the dependency and keep our own `core` thin.

Rejected alternatives: hand-rolled Three.js cube renderer (weeks of work, no timeline/stickering
support); [`cubejs`](https://github.com/ldez/cubejs) as the primary model (older, less maintained,
no renderer, no notation algebra); building on `cstimer` source directly (GPL-3.0 and not packaged
as a library — we use its algorithms via the `min2phase` port in ticket 004 instead).

**Why URFDLB facelets as the canonical form.** It is the input format of min2phase and of nearly
every Kociemba implementation, it is trivially producible by the camera scanner (one face at a
time), and it is a flat 54-char string — cheap to hash, diff, log, snapshot in tests, and put in a
URL. `cubing/kpuzzle`'s `KPattern` is richer but awkward as a wire format, so it is a derived
representation reached through an adapter, not the canonical one.

**Two-layer colour handling.** The camera sees colours, the solver needs faces. Keeping
`ColorFacelets` separate from `FaceletString` means the camera pipeline never has to guess the
colour scheme mid-scan, and a user with a non-standard (e.g. stickerless pastel, or Japanese
colour scheme) cube is handled by one function (001-R3) rather than by special cases everywhere.

**Module boundaries.** `src/cube/core` imports nothing from React, Next, the DOM, or any sibling
`cube/*` module. This is enforced by an ESLint `no-restricted-imports` rule, so a fast model cannot
accidentally couple the camera to the solver.

**SSR.** `cubing/twisty` registers custom elements and touches WebGL at import time. Every import
of it goes through `<CubeView>`, which is the only file allowed to import `cubing/twisty`, and it
does so via `next/dynamic` with `ssr: false`. ESLint restricts the import path to that file.

**Why Docker Compose now, and why only two services.** The brief calls out debugging via container
and application logs explicitly, and that has to be true from the first ticket or every ticket
after it inherits an undebuggable stack. The honest limit: WebGL, camera and Web Bluetooth are
browser APIs, so Docker cannot usefully host "the cube" — it can only host the Next.js server and
a browser *driving* it. That is exactly what `test` (Playwright, already configured with the
fake-camera/fake-bluetooth flags 001-R10 sets up) does, so Compose gives us two real, useful
services rather than a db/cache/queue cargo-culted in because "stacks have services" — there is no
database on the POC's critical path (Prisma/NextAuth are deferred per the root `Agents.md`), so no
db container is added until a ticket actually needs one. `npm run dev` on the host remains the
fast loop for day-to-day work; Compose is the "it works the same everywhere, and I can read its
logs" path, and the one CI and a fresh contributor both reach for first.

## Tasks

- [ ] 001-T1 Scaffold the T3 app (001-R1) (logical-eval: `npm run build` and `npm run typecheck` exit 0 on a clean clone)
  - [ ] 001-T1.1 Run `create-t3-app` (Next.js App Router, TS, Tailwind, tRPC, Prisma, NextAuth) (reasoning: directory/tooling matches the Agents.md §2 stack table by inspection)
  - [ ] 001-T1.2 Enable `strict: true` in tsconfig and fix resulting errors (logical-eval: `npm run typecheck` reports zero errors)
  - [ ] 001-T1.3 Configure Tailwind design tokens (minimal palette/typography) (reasoning: tokens reviewed against the "clean, minimalistic" brief requirement)
- [ ] 001-T2 Cube-core domain types (001-R2, 001-R3, 001-R4)
  - [ ] 001-T2.1 `FaceletString` branded type + solved constant (TDD: src/cube/core/facelets.test.ts)
  - [ ] 001-T2.2 `ColorFacelets` + `resolveColorFaceletsToFacelets` (TDD: src/cube/core/colors.test.ts) (BDD: @001-S7, @001-S8)
  - [ ] 001-T2.3 `CubeState` value object (TDD: src/cube/core/facelets.test.ts)
- [ ] 001-T3 Notation types over `cubing/alg` (001-R5)
  - [ ] 001-T3.1 `Move`/`MoveSequence` types (TDD: src/cube/core/notation.test.ts)
  - [ ] 001-T3.2 `parseAlg`/`formatAlg` round-trip helpers (TDD: src/cube/core/notation.test.ts) (BDD: @001-S11)
- [ ] 001-T4 `validateFacelets` (001-R6)
  - [ ] 001-T4.1 Structural checks: length, facelet counts, distinct centres (TDD: src/cube/core/validate.test.ts) (BDD: @001-S6)
  - [ ] 001-T4.2 Edge/corner existence and uniqueness checks (TDD: src/cube/core/validate.test.ts)
  - [ ] 001-T4.3 Parity checks: corner orientation, edge orientation, permutation parity (TDD: src/cube/core/validate.test.ts) (BDD: @001-S4, @001-S5)
  - [ ] 001-T4.4 Error codes carry offending facelet indices (logical-eval: every case in validate.test.ts asserts the reported indices, not just the error code)
- [ ] 001-T5 Library adapters (001-R7)
  - [ ] 001-T5.1 `toMin2PhaseFacelets`/`fromMin2PhaseFacelets` (TDD: src/cube/core/adapters/min2phase.test.ts) (logical-eval: facelet-order identity guard trips if the assumption in 001-R7 ever breaks)
  - [ ] 001-T5.2 `toKPattern`/`fromKPattern` for `cubing/kpuzzle` (TDD: src/cube/core/adapters/kpuzzle.test.ts) (BDD: @001-S1)
  - [ ] 001-T5.3 `applyMoves` via `cubing/kpuzzle` (TDD: src/cube/core/apply.test.ts) (BDD: @001-S3)
- [ ] 001-T6 Scramble generation (001-R8)
  - [ ] 001-T6.1 Lazy-loaded wrapper over `randomScrambleForEvent("333")` (TDD: src/cube/core/scramble.test.ts) (BDD: @001-S2)
  - [ ] 001-T6.2 `scrambledState()` helper (TDD: src/cube/core/scramble.test.ts)
- [ ] 001-T7 `<CubeView>` component (001-R9)
  - [ ] 001-T7.1 Dynamic import of `TwistyPlayer` with `ssr: false` (BDD: @001-S10) (TDD: src/components/CubeView.test.tsx)
  - [ ] 001-T7.2 Prop wiring: state/alg/moveIndex/highlight/stickering/interactive/onMove (TDD: src/components/CubeView.test.tsx)
  - [ ] 001-T7.3 Imperative handle: play/pause/jumpTo (TDD: src/components/CubeView.test.tsx) (BDD: @001-S9)
- [ ] 001-T8 Testing harness (001-R10, 001-R11)
  - [ ] 001-T8.1 Vitest config with `node` and `jsdom` projects (reasoning: every other task's TDD tag only holds if this config actually runs them — verified transitively by the full suite passing)
  - [ ] 001-T8.2 Playwright config with fake-camera/fake-bluetooth Chromium project (BDD: @001-S12) (reasoning: flag choice is what lets tickets 002/003 write hardware-free E2E tests)
  - [ ] 001-T8.3 npm scripts: test, test:unit, test:e2e, test:perf, test:coverage, typecheck, lint (logical-eval: each script exits 0 on a clean tree)
  - [ ] 001-T8.4 `scripts/check-scenarios.mjs` CI grep for `@nnn-Sn` ids (logical-eval: a PRD scenario id with no matching test name makes the script exit non-zero — self-tested with one deliberately orphaned fixture id)
- [ ] 001-T9 Minimal shell page (001-R12)
  - [ ] 001-T9.1 `/` page: CubeView + Scramble + prev/next + alg text (TDD: src/app/page.test.tsx) (BDD: @001-S2, @001-S9)
  - [ ] 001-T9.2 Mobile layout at 360px, keyboard accessibility (BDD: @001-S12)
- [ ] 001-T10 Bundle discipline: CI size assertion for `/` initial JS ≤ 150 kB gzip (001-R13) (logical-eval: `next build` output size check fails the build above the ceiling)
- [ ] 001-T11 Docker Compose dev stack (001-R14)
  - [ ] 001-T11.1 `Dockerfile.dev` (Node 20, installs deps, runs `next dev`) (logical-eval: `docker build` succeeds and the image starts `next dev` on container run)
  - [ ] 001-T11.2 `docker-compose.yml`: `app` service + `test` service behind a Compose profile, shared `node_modules` volume (BDD: @001-S13, @001-S14)
  - [ ] 001-T11.3 `.env.example` + env wiring (reasoning: reviewed against every `process.env.*` read in the app for completeness)
  - [ ] 001-T11.4 stdout/stderr-only logging, default `json-file` driver, plain text in dev (BDD: @001-S13)
  - [ ] 001-T11.5 `scripts/check-docker-stack.sh`/`.ps1` smoke test (logical-eval: exits 0 when `/` returns HTTP 200 within the timeout, non-zero otherwise)
  - [ ] 001-T11.6 Document the Compose workflow in README/Agents.md (reasoning: doc reviewed line-by-line against the actual compose file for drift)
- [ ] 001-T12 Write every test in the TDD plan and make it pass (logical-eval: `npm run test` is green and `check-scenarios.mjs` reports zero orphaned scenario ids)
- [ ] 001-T13 Measure and record the non-functional numbers in Verification notes (reasoning: each number below is measured on this machine/CI and transcribed, not estimated)

## BDD acceptance scenarios

```gherkin
Feature: 001 Cube core domain model and shell

  Scenario: @001-S1 Solved cube round-trips through every representation
    Given the canonical solved facelet string
    When it is converted to a KPattern and back, and to min2phase facelets and back
    Then the result is byte-identical to the original
    And validateFacelets reports it as valid

  Scenario: @001-S2 A WCA scramble produces a valid, non-solved state
    Given the shell page is open
    When the user presses "Scramble"
    Then a scramble of 19 or more moves is displayed in standard notation
    And the resulting cube state passes validateFacelets
    And the resulting cube state is not the solved state

  Scenario: @001-S3 Applying a scramble and its inverse returns to solved
    Given a randomly generated scramble
    When the scramble is applied to the solved state and then its inverse is applied
    Then the resulting facelet string equals the solved facelet string

  Scenario: @001-S4 Impossible state - single flipped edge - is rejected with a precise error
    Given a facelet string identical to solved except one edge is flipped in place
    When validateFacelets is called
    Then it fails with code "EDGE_ORIENTATION_PARITY"
    And the error names the two facelet indices of the flipped edge

  Scenario: @001-S5 Impossible state - single twisted corner - is rejected
    Given a facelet string identical to solved except one corner is rotated in place
    When validateFacelets is called
    Then it fails with code "CORNER_ORIENTATION_PARITY"

  Scenario: @001-S6 Impossible state - wrong sticker counts - is rejected before structural checks
    Given a facelet string with ten U stickers and eight D stickers
    When validateFacelets is called
    Then it fails with code "FACELET_COUNT"
    And the error names the over- and under-represented faces

  Scenario: @001-S7 Colour facelets resolve to faces using the centres
    Given colour facelets captured from a standard-scheme cube with white on U and green on F
    When resolveColorFaceletsToFacelets is called
    Then every W sticker maps to U, every G sticker maps to F, and the result validates

  Scenario: @001-S8 Colour facelets with duplicate centres are rejected
    Given colour facelets where two centres are both red
    When resolveColorFaceletsToFacelets is called
    Then it fails with code "AMBIGUOUS_CENTRES"
    And the error names the two conflicting centre indices

  Scenario: @001-S9 The 3D cube renders and steps through an algorithm
    Given the shell page is open with the algorithm "R U R' U'"
    When the user presses "next move" three times
    Then the player's move index is 3
    And the rendered cube's state equals the solved state with "R U R'" applied

  Scenario: @001-S10 No server-side rendering crash from the 3D player
    Given a cold server render of "/"
    When the HTML response is inspected
    Then it contains no twisty-player markup and the response status is 200
    And after hydration the player element is present

  Scenario: @001-S11 Notation parsing round-trips and rejects garbage
    Given the algorithm text "R U2 Rw' M x2 (F' D)"
    When it is parsed and re-formatted
    Then the formatted output parses to an equal Alg
    And parsing "R U 7 Q'" fails with a notation error naming the offending token

  Scenario: @001-S12 Shell page is usable at mobile width and keyboard accessible
    Given a 360x640 viewport
    When the shell page is opened
    Then no horizontal scrolling occurs
    And all controls are reachable by Tab and operable by Enter or Space
    And an axe accessibility scan reports no serious or critical violations

  Scenario: @001-S13 Docker Compose serves the app with inspectable logs
    Given a clean clone with Docker installed and no containers running
    When "docker compose up -d app" is run
    Then "http://localhost:3000/" responds with HTTP 200 within 60 seconds
    And "docker compose logs app" contains the Next.js ready line
    And "docker compose logs app" contains no log line wrapped in extra JSON framing

  Scenario: @001-S14 The E2E suite runs against the containerized app
    Given the app service is healthy under Docker Compose
    When "docker compose run --rm test" is executed
    Then the Playwright suite runs headlessly against the containerized app
    And the command exits non-zero if any test fails
    And the Playwright HTML report is present on the host under playwright-report/ after the run
```

## TDD plan

Write these before implementation; each must fail for the right reason first.

**Unit (Vitest, `node` environment)**

| File | Asserts |
| --- | --- |
| `src/cube/core/facelets.test.ts` | Solved constant correctness; index→(face,row,col) mapping for all 54 slots; branded-type construction rejects wrong length (@001-S1). |
| `src/cube/core/validate.test.ts` | Each of the eight checks in 001-R6 in isolation, using a fixture per failure mode; error codes and reported indices (@001-S4, @001-S5, @001-S6). |
| `src/cube/core/validate.property.test.ts` | `fast-check`: 300 random move sequences from solved always validate; random single-sticker mutations almost always fail — and when they don't, the state is genuinely reachable. |
| `src/cube/core/colors.test.ts` | Standard scheme, Japanese scheme, stickerless-ambiguous, duplicate centres, `unknown` present (@001-S7, @001-S8). |
| `src/cube/core/notation.test.ts` | Parse/format round-trip over a table of 40 algs incl. wide/slice/rotation; rejection cases (@001-S11). |
| `src/cube/core/adapters/kpuzzle.test.ts` | `toKPattern`/`fromKPattern` round-trip for solved, scrambled, and 50 random states (@001-S1). |
| `src/cube/core/adapters/min2phase.test.ts` | Facelet ordering identity (our canonical form is already min2phase's) and the guard that fails loudly if that assumption ever breaks. |
| `src/cube/core/apply.test.ts` | `applyMoves` single moves ×18 against hand-computed expected facelets; scramble+inverse = solved (@001-S3); `U4 = identity`. |
| `src/cube/core/scramble.test.ts` | `generateScramble` returns ≥ 19 moves, parses, yields a valid non-solved state (@001-S2). |

**Component (Vitest + RTL, `jsdom`)**

| File | Asserts |
| --- | --- |
| `src/components/CubeView.test.tsx` | Renders a placeholder before the dynamic chunk resolves; forwards `state`/`alg` to the mocked `TwistyPlayer`; `jumpTo` moves the index; `highlight` produces the expected stickering string. `cubing/twisty` is module-mocked here — the real player is only exercised in Playwright. |
| `src/app/page.test.tsx` | Scramble button calls the scramble helper; prev/next clamp at the ends; alg text matches state. |

**Integration (Vitest)**

| File | Asserts |
| --- | --- |
| `tests/integration/core-pipeline.test.ts` | scramble → apply → validate → colourise → resolve back to facelets → validate, as one chain, over 50 random states. This is the invariant chain tickets 002-004 plug into. |

**E2E (Playwright, `tests/e2e/001-foundation.spec.ts`)**

@001-S2, @001-S9, @001-S10, @001-S12 — real browser, real `twisty-player`, real WebGL.

**Infra (`scripts/check-docker-stack.sh`, driven from `tests/e2e/001-docker.spec.ts` or run directly
in CI as a separate job)** — @001-S13, @001-S14: brings the `app` service up, polls `/` for HTTP 200,
inspects `docker compose logs app` for the ready line and the absence of JSON-wrapped lines, then
runs `docker compose run --rm test` and asserts its exit code and the presence of the host-side
Playwright report.

**Fixtures (`tests/fixtures/states.ts`)** — `SOLVED`, `SUPERFLIP`, `CHECKERBOARD`,
`ONE_FLIPPED_EDGE`, `ONE_TWISTED_CORNER`, `TWO_SWAPPED_CORNERS`, `WRONG_COUNTS`,
`DUPLICATE_CENTRES`, plus `SCRAMBLES_50` (a frozen list, so tests are deterministic).

## Non-functional requirements

| Metric | Target | Measurement |
| --- | --- | --- |
| `validateFacelets` | ≤ 1 ms p95 | Vitest `bench`, 10k iterations. It runs per camera frame candidate in 003. |
| `applyMoves` for a 20-move alg | ≤ 2 ms p95 | Vitest `bench`. |
| `/` initial JS (excl. lazy chunks) | ≤ 150 kB gzip | `next build` output assertion in CI. |
| First render of `<CubeView>` after hydration | ≤ 400 ms on a mid-tier Android profile | Playwright trace with CPU throttling ×4. |
| Coverage in `src/cube/core` | ≥ 90% lines | `@vitest/coverage-v8` gate. |
| Offline | `/` renders and scrambles with the network blocked after first load | Playwright with `context.setOffline(true)`. |
| `docker compose up -d app` → `/` returns HTTP 200 | ≤ 60 s cold (no image cache), ≤ 15 s warm | `scripts/check-docker-stack.sh`, timed. |
| `docker compose run --rm test` full suite | completes and reports exit code | Same script; exit code asserted. |

## Acceptance criteria

1. `npm run typecheck`, `lint`, `test:unit`, `test:e2e`, `test:coverage` all pass from a clean clone.
2. All fourteen BDD scenarios have passing tests with matching `@001-Sn` names; `check-scenarios.mjs`
   passes.
3. `src/cube/core` has zero imports from React/Next/DOM/sibling cube modules, enforced by lint.
4. `cubing/twisty` is imported in exactly one file (`CubeView.tsx`), enforced by lint.
5. The shell page scrambles and steps a cube in a real browser at 360 px width.
6. Every non-functional number above is measured and recorded in *Verification notes*.
7. `docker compose up -d app` serves `/` with HTTP 200 and `docker compose logs app` shows readable,
   unwrapped log lines including the Next.js ready line.
8. `docker compose run --rm test` runs the full Playwright suite against the containerized app and
   leaves a Playwright HTML report on the host.

## Open questions / risks

- **R1** `cubing/twisty`'s imperative playback API is explicitly pre-1.0 and documented as liable to
  change. Mitigation: all timeline interaction goes through `<CubeView>`'s own handle, so a breaking
  upstream change is a single-file fix. Pin the `cubing` version exactly.
- **R2** Facelet-order assumption: we assert min2phase and our canonical order are identical
  (001-R7). If the chosen `min2phase` build differs, the adapter becomes a real permutation — the
  guard test in `adapters/min2phase.test.ts` must catch this at ticket-004 integration time, not in
  production.
- **R3** Prisma/NextAuth in the scaffold add build weight and a DB requirement for `next build`.
  If this slows iteration, keep them but ensure no page imports the Prisma client. Revisit only if
  it blocks CI.
- **R4** Bundle ceiling of 150 kB may be tight once Tailwind + tRPC client are in. If exceeded,
  raise the number in this PRD by amendment rather than silently ignoring the check.

## Verification notes

_To be completed during review._
