# Ticket 004 — Solver engine + method pipeline scaffolding (CFOP/Roux/ZZ/ZB/OH/BLD-ready)

| Field | Value |
| --- | --- |
| Status | planned |
| Owner model | Opus (planning) → fast model (implementation) |
| Depends on | 001 |
| Blocks | 005, 006, 007, 008, 009, 010, 011, 012 |
| Requirements | R8, R9, R10, R7, R11 |
| Estimated size | L |

## Context / motivation

This is the ticket that decides whether the next wave (CFOP, Roux, ZZ, ZB, OH, and BLD with M2 /
Old Pochmann / setup moves) can be added as six independent, parallel tickets or whether each one
requires surgery on the core. The POC itself only needs *one* working end-to-end method, but the
abstraction has to be right now.

The key insight shaping the design: a method-specific solution is **not** a flat move list. CFOP is
cross → F2L×4 → OLL → PLL. Roux is FB → SB → CMLL → LSE. ZZ is EOLine → ZZF2L → LL. BLD is not
geometric at all — it is a list of *targets* (letters), the *setup moves* that bring each target to
the buffer's swap slot, the swap algorithm, and the undo, plus parity handling and a memo
representation. One-handed is CFOP/Roux re-ranked by a different move-cost function, not a new
method. A flat `string[]` of moves cannot express any of this, and retrofitting structure later
means rewriting both the solver layer and the playback UI.

So: one result type rich enough for all six, one engine layer that produces raw move sequences, and
one planner interface that turns a `CubeState` into that structured result. This ticket delivers the
types, the engine layer, the registry, a verified Kociemba planner as the POC's working method, and
a stubbed-but-typed planner per future method so ticket 005 can build real UI against real shapes.

## Dependencies

- Ticket 001 (`CubeState`, `FaceletString`, `Move`, `applyMoves`, `toKPattern`, validator).
- External: npm registry; Web Workers.

## Scope

**In scope**

- `SolutionPlan` / `SolutionStage` / `SolutionMove` result model (the app's single solution type).
- `SolverEngine` layer: min2phase (Kociemba two-phase) in a Web Worker, plus the step-solver engine
  for sub-goal searches.
- `MethodPlanner` interface + registry, with `kociemba` fully implemented as the POC method.
- Typed, declared-but-unimplemented planners for `cfop`, `roux`, `zz`, `zb`, `oh`, `bld` that return
  a `NotImplemented` marker — so the UI, routing, types and tests all exist from day one.
- **BLD data layer** built now because it is the piece with no off-the-shelf solution: cubie↔sticker
  model, letter schemes, cycle decomposition with cycle-breaking, buffer definitions, and the
  Old Pochmann / M2 setup-move tables. The BLD *planner* lands in ticket 011, but it will be
  assembling data structures this ticket defines and tests.
- Table warming, caching, cancellation, and a measured latency budget.
- Universal verification: any plan, replayed against its input state, must solve the cube.

**Out of scope**

- The actual CFOP/Roux/ZZ/ZB/OH/BLD planner implementations (tickets 006-011).
- Algorithm-set reference content, OLL/PLL case recognition and trainers (014).
- Solution UI (005).
- Non-3×3 puzzles. 4×4+ would need a reduction layer; not now.

## Detailed requirements

- **004-R1** Result model in `src/cube/model/solution.ts`:

  ```ts
  type SolutionMove = {
    move: Move;
    index: number;              // index within the whole plan
    annotation?: string;        // "setup", "swap", "undo", "parity", "cancellation", "AUF"
  };

  type SolutionStage = {
    id: string;                 // "cross" | "f2l-1" | "oll" | "fb" | "eoline" | "corners" | "edges" | ...
    label: string;              // "Cross", "F2L pair 1", "OLL", "First block", "EOLine"
    moves: SolutionMove[];
    algName?: string;           // "T perm", "Sune", "J perm (Ja)"
    caseId?: string;            // "OLL-27", "PLL-Ua", "CMLL-1", "ZBLL-…"
    substeps?: SolutionStage[]; // recursive: BLD target groups, F2L pairs, 2-look splits
    memo?: MemoBlock;           // BLD only
    stateBefore: FaceletString;
    stateAfter: FaceletString;
    notes?: string[];
  };

  type SolutionPlan = {
    method: MethodId;
    input: CubeState;
    stages: SolutionStage[];
    moveCount: { htm: number; qtm: number; stm: number; etm: number };
    generatedAt: number;
    engine: string;             // "min2phase@x.y.z"
    computeMs: number;
    verified: boolean;          // golden invariant checked
    warnings?: string[];
  };
  ```

  `stages` is recursive via `substeps`, which is what lets CFOP's four F2L pairs, 2-look OLL/PLL,
  and BLD's per-target groups all be expressed without new types. `stateBefore`/`stateAfter` per
  stage is what lets the playback UI (005) scrub to any stage boundary in O(1) instead of replaying.
- **004-R2** `MemoBlock` for BLD:
  `{ scheme: LetterSchemeId; cornerTargets: Target[]; edgeTargets: Target[]; cornerPairs: string[]; edgePairs: string[]; parity: boolean; flippedEdges?: Target[]; twistedCorners?: Target[]; buffer: { corners: Sticker; edges: Sticker } }`
  where `Target = { sticker: Sticker; letter: string; cubie: CubieId }`. Designed against
  [jperm.net/bld](https://www.jperm.net/bld): corner buffer **UBL** shot to **DFR** with the Y-perm
  variant `R U' R' U' R U R' F' R U R' U' R' F R`, OP edge buffer **UR** shot to **UL** with the
  T-perm `R U R' U' R' F R2 U' R' U' R U R' F'`, and the parity alg
  `R U' R' U' R U R D R' U' R D' R' U2 R' U'`.
- **004-R3** `SolverEngine` interface:
  `{ id: string; init(): Promise<void>; solve(facelets, opts: { maxDepth?, timeoutMs?, signal? }): Promise<MoveSequence>; }`
  All engines run in a Worker; all `solve` calls are cancellable via `AbortSignal` (the user
  re-scans or changes method mid-search, and a stale search must die immediately).
- **004-R4** `Min2PhaseEngine` using [`min2phase`](https://github.com/cubing/min2phase.js) — the JS
  packaging of Chen Shuang's Kociemba two-phase solver, which uses web workers automatically and
  exposes `OffThreadMin2Phase` for explicit worker control. Typical output 18-20 HTM. Validate the
  facelet-order assumption from 001-R7 at init with a hard assertion.
- **004-R5** Table warming: min2phase's pruning tables cost on the order of a second to build.
  Kick `init()` off during idle time at app boot (`requestIdleCallback`, or immediately on the
  `/scan` and `/connect` routes) so that by the time a state exists the solver is hot. Expose
  `engineReady` so the UI can show "preparing solver" only in the rare cold case.
- **004-R6** `StepSolverEngine` wrapping [`cube-solver`](https://github.com/torjusti/cube-solver)
  (MIT), which already solves **cross**, **XCross**, **Roux first block (FB)** and **ZZ EOLine**, and
  generates **CMLL / LSE / LSLL / PLL / ZBLL / 2GLL / ZZLS** scrambles. Expose
  `solveStep(facelets, step)`. The library documents a ~2 s Kociemba setup and recommends web
  workers — run it in the same worker pool as min2phase and warm it the same way. This engine is
  what tickets 006-008 build their stages on, which is why it is wired now rather than later.
- **004-R7** `MethodPlanner` interface:
  `{ id: MethodId; label: string; plan(state: CubeState, opts: PlanOptions): Promise<SolutionPlan>; capabilities: { structured: boolean; memo: boolean } }`
  with `MethodId = "kociemba" | "cfop" | "roux" | "zz" | "zb" | "oh" | "bld"`. Registry in
  `src/cube/solve/methods/registry.ts`; `getPlanner(id)` is the only way the app reaches a planner.
- **004-R8** `KociembaPlanner` — fully implemented, the POC's working method. Produces a single
  `stages` entry (`id: "solution"`) with the full move list, plus `moveCount` in all four metrics
  and `verified: true`. This is the "show the user a solution end-to-end" deliverable.
- **004-R9** Stub planners for `cfop`, `roux`, `zz`, `zb`, `oh`, `bld`: real registry entries, real
  types, each throwing a typed `NotImplementedError` carrying its owning ticket number. Tests assert
  every `MethodId` has a registry entry and correct capability flags. This guarantees ticket 005's
  method picker and routing are built against the final shape.
- **004-R10** BLD data layer in `src/cube/solve/bld/` — implemented and fully tested this ticket:
  - `cubies.ts`: the 8 corner and 12 edge cubies, their 24 corner stickers and 24 edge stickers, and
    sticker↔(cubie, orientation) mappings derived from the 001 facelet indices.
  - `scheme.ts`: letter schemes (default Speffz plus user-definable), sticker→letter and
    letter→sticker, validated as a bijection.
  - `cycles.ts`: `decompose(state, buffer)` → the target sequence a BLD solver executes, including
    **cycle breaking** (when the buffer returns home but unsolved pieces remain, break into a new
    cycle at an unsolved target), detection of solved-in-place pieces, flipped edges, twisted
    corners, and the parity flag (odd number of edge targets).
  - `setup.ts`: the setup-move tables — Old Pochmann corner setups (D/F/R-only moves to bring a
    target to DFR) and OP edge setups (L/Lw/Dw-only to bring a target to UL), plus the **M2** edge
    tables: buffer DF, swap alg `M2`, per-target conjugates (e.g. the documented `U R U' M2 U R' U'`
    form for FR) and the special M-slice cases shooting to FU / BU / BD. Sources:
    [jperm.net/bld](https://www.jperm.net/bld),
    [speedsolving wiki M2/R2](https://www.speedsolving.com/wiki/index.php?title=M2%2FR2),
    [Macky's 3-cycle guide](https://cubefreak.net/bld/3op_guide.pdf).
  - Every table entry is machine-verified (004-R11), not trusted.
- **004-R11** **Table verification test** — the mechanism that makes hand-entered BLD data
  trustworthy: for every target letter in every scheme, assert that
  `setup + swapAlg + setup⁻¹` applied to a solved cube performs exactly the intended 2-swap
  (buffer ↔ target) and disturbs nothing else. Run this for OP corners, OP edges and M2 edges across
  all targets. A wrong table entry fails here instead of producing a BLD solution that silently
  does not solve.
- **004-R12** **Golden verification** on every plan: `applyMoves(plan.input, allMoves(plan))` must
  equal the solved state, and every stage's `stateAfter` must equal
  `applyMoves(stage.stateBefore, stage.moves)`. A plan failing either is never returned — it throws.
  This single invariant is what lets later tickets add planners with confidence.
- **004-R13** `PlanOptions`: `{ metric?: "htm"|"qtm"|"stm"|"etm"; oneHanded?: boolean; maxTimeMs?: number; signal?: AbortSignal; scheme?: LetterSchemeId; buffers?: {...}; preferredAlgs?: Record<caseId, Alg> }`.
  `oneHanded` is a *modifier* on a method, not a method: ticket 010 implements OH by re-ranking
  candidate algs with an OH move-cost function. The option exists in the signature now so OH does
  not require an interface change.
- **004-R14** `MoveSequence` post-processing utilities shared by all planners:
  cancellation/merging of adjacent same-face moves (`R R` → `R2`, `R R'` → nothing), rotation
  elimination where possible, AUF insertion, and per-metric move counting. Used by the BLD planner
  heavily (setup/undo pairs cancel against neighbouring setups) so it belongs here.
- **004-R15** tRPC router `solve.plan` exists and mirrors the client API, but **the client path never
  depends on it**. It is there for future server-side batch work. Marked clearly as non-critical;
  the app must produce solutions with the network offline.
- **004-R16** Serialisation: `SolutionPlan` is JSON-round-trippable, and `CubeState` has a compact
  URL-safe encoding (`?s=<base64url facelets>`) so a state can be shared or restored. Needed by 005
  for deep links and by tests for fixtures.

## Architecture / approach notes

**Engines vs planners.** An *engine* answers "give me moves that reach this sub-goal" (min2phase for
the whole cube; `cube-solver` for cross/XCross/FB/EOLine). A *planner* answers "express the solution
the way a human practising method X thinks about it", which means calling engines and/or
table-driven algorithm lookups, then labelling the result into stages. Keeping these separate is
what makes CFOP (stage labelling + alg tables + cross engine), Roux (FB engine + CMLL table + LSE
logic), ZZ (EOLine engine + ZBLL table), ZB (ZBLL recognition over a CFOP skeleton), OH (a re-ranking
pass over any of them) and BLD (no geometric search at all — pure cycle decomposition + table lookup)
all fit one interface.

**Why min2phase.** Chen Shuang's min2phase is the de facto standard Kociemba two-phase
implementation and powers csTimer; the [`min2phase`](https://github.com/cubing/min2phase.js) npm
package by the cubing.js team wraps it with automatic web-worker offloading. It returns 18-20 HTM
solutions in milliseconds once tables are built — comfortably inside our budget, and near-optimal is
the right trade (a true optimal solver can take minutes and nobody is memorising 18 vs 20 moves
differently). Alternatives considered: `cubing/search` / [twips](https://github.com/cubing/twips)
(excellent, and already in the tree via `cubing/scramble`, but its public solve surface is still
experimental — keep as a second engine behind the same interface);
[`cube-solver`](https://github.com/torjusti/cube-solver) full solve (its README explicitly
prioritises simplicity and extensibility over speed — so we use it for its *step* solvers, which is
exactly where it is unmatched); [`cubejs`](https://github.com/ldez/cubejs) (older, ~22-move
solutions); a Rust/WASM port (faster, but a build-toolchain dependency the POC does not need).

**Why the BLD data layer lands now.** The research is unambiguous: there is no maintained,
reusable library that generates M2 + Old Pochmann solutions with setup moves and memo output.
What exists is either a trainer/course ([3x3bld](https://github.com/thecubeographer/3x3bld),
[Blindfolded-Letter-Pairs](https://github.com/CharlesOuO/Blindfolded-Letter-Pairs)), a one-off
solver ([felixbd/rcs](https://github.com/felixbd/rcs),
[croeer/old-pochmann](https://github.com/croeer/old-pochmann) — notable as a camera-scan + OP memo
SPA and worth reading for UX), alg data ([OllieFrost/3style](https://github.com/OllieFrost/3style)
commutator TSVs, useful for a future 3-style ticket), or closed-source. So R9 is the one requirement
we must build ourselves — and the part that is genuinely hard is not the search (there is none) but
the **correctness of the setup-move tables** and the **cycle-breaking logic**. Both are data and
pure logic, both are fully testable without any UI, and both gate ticket 011. Building and
machine-verifying them here de-risks the hardest requirement in the brief at the cheapest point.
BLD is also, usefully, a *solved* problem mathematically: decompose the permutation into
transpositions through the buffer, look up each target's conjugate, concatenate. No search space.

**Why `stateBefore`/`stateAfter` on every stage.** The playback UI must let a user jump to "start of
OLL" or "edge target 7" instantly, and the BLD UI must show the cube mid-memo. Storing the facelet
string per stage costs 54 bytes and removes all replay cost from the UI. It also makes every stage
independently verifiable (004-R12), which is how a wrong alg table entry gets caught.

**Cancellation matters for latency.** The user scans, sees a solution, switches method, re-scans.
Without `AbortSignal` plumbing, worker searches pile up and the UI stalls. This is a latency
requirement disguised as an API detail.

## Tasks

- [ ] 004-T1 `SolutionPlan`/`SolutionStage`/`SolutionMove`/`MemoBlock` result model (004-R1, 004-R2) (TDD: src/cube/model/solution.test.ts) (BDD: @004-S8, @004-S17)
- [ ] 004-T2 `SolverEngine` interface with `AbortSignal` cancellation (004-R3) (TDD: src/cube/solve/engines/search-engine.test.ts) (BDD: @004-S6)
- [ ] 004-T3 `SearchEngine` (`cubing/search`-backed, **not** the `min2phase` npm package — see 004-T16/Open questions) + facelet-order assertion at init (004-R4) (depends: 004-T2) (TDD: src/cube/solve/engines/search-engine.test.ts) (BDD: @004-S1, @004-S2)
- [ ] 004-T4 Idle-time table warming and `engineReady` flag (004-R5) (depends: 004-T3) (TDD: tests/integration/warmup.test.ts) (BDD: @004-S4)
- [ ] 004-T5 `StepSolverEngine` for cross/XCross/FB/EOLine (004-R6) (depends: 004-T2) (TDD: src/cube/solve/engines/step-solver.test.ts) (BDD: @004-S15) — **blocked**, see 004-T16/Open question: `cube-solver`'s public API only accepts a scramble *string*, not an externally-observed state, which doesn't fit camera/BLE-scanned input; needs a different engine or a lower-level entry point before this can proceed
- [ ] 004-T6 `MethodPlanner` interface and registry (004-R7) (depends: 004-T1) (TDD: src/cube/solve/methods/registry.test.ts) (BDD: @004-S7)
- [ ] 004-T7 `KociembaPlanner` — fully implemented, the POC's working method (004-R8) (depends: 004-T1, 004-T3, 004-T6) (TDD: src/cube/solve/methods/kociemba.test.ts) (BDD: @004-S1, @004-S2, @004-S5)
- [ ] 004-T8 Stub planners for cfop/roux/zz/zb/oh/bld with ticket-numbered `NotImplementedError` (004-R9) (depends: 004-T6) (TDD: src/cube/solve/methods/registry.test.ts) (BDD: @004-S7)
- [ ] 004-T9 BLD data layer (004-R10)
  - [ ] 004-T9.1 `cubies.ts` — cubie/sticker model derived from the 001 facelet indices (TDD: src/cube/solve/bld/cubies.test.ts)
  - [ ] 004-T9.2 `scheme.ts` — Speffz + custom letter schemes, bijection validation (depends: 004-T9.1) (TDD: src/cube/solve/bld/scheme.test.ts) (BDD: @004-S14)
  - [ ] 004-T9.3 `cycles.ts` — decomposition with cycle breaking, parity, solved/flipped/twisted detection (depends: 004-T9.1, 004-T9.2) (TDD: src/cube/solve/bld/cycles.test.ts, src/cube/solve/bld/cycles.property.test.ts) (BDD: @004-S11, @004-S12, @004-S13)
  - [ ] 004-T9.4 `setup.ts` — OP corner tables, OP edge tables, M2 edge tables incl. M-slice specials (depends: 004-T9.1, 004-T9.2) (TDD: src/cube/solve/bld/setup.test.ts) (BDD: @004-S9, @004-S10)
- [ ] 004-T10 BLD table verification test: every entry performs exactly a buffer↔target 2-swap (004-R11) (depends: 004-T9.4) (logical-eval: every target letter in every scheme, for OP corners/edges and M2 edges, machine-verified against a real cube model — zero entries taken on trust)
- [ ] 004-T11 Golden verification enforced in the planner base for every returned plan (004-R12) (depends: 004-T1, 004-T7) (logical-eval: applyMoves(plan.input, allMoves(plan)) equals solved, and every stage's stateBefore/stateAfter chain is internally consistent) (BDD: @004-S8)
- [ ] 004-T12 `PlanOptions` incl. `oneHanded` passthrough for ticket 010 (004-R13) (depends: 004-T1) (reasoning: signature reviewed so OH re-ranking in ticket 010 requires no interface change)
- [ ] 004-T13 Move post-processing: cancellation/merging, per-metric counts (004-R14) (TDD: src/cube/solve/postprocess.test.ts) (BDD: @004-S16) — rotation elimination and AUF insertion deferred, see Open questions (no current planner emits rotations or last-layer algs yet to exercise them against)
- [ ] 004-T14 Non-critical `solve.plan` tRPC router, client path never depends on it (004-R15) (depends: 004-T1, 004-T7) (BDD: @004-S18)
- [ ] 004-T15 Serialisation: `SolutionPlan` JSON round-trip, `CubeState` URL-safe encoding (004-R16) (depends: 004-T1) (TDD: src/cube/model/solution.test.ts) (BDD: @004-S17)
- [ ] 004-T16 Resolve open questions R1/R2 (engine package maturity, combined table-build cost) before relying on them (reasoning: resolution recorded in Verification notes before implementation depends on either assumption)
- [ ] 004-T17 Write every test in the TDD plan (unit/property/integration/E2E/perf) and make it pass (depends: 004-T1 through 004-T15) (logical-eval: `npm run test` is green and `check-scenarios.mjs` reports zero orphaned scenario ids)

## BDD acceptance scenarios

```gherkin
Feature: 004 Solver engine and method pipeline

  Scenario: @004-S1 A scanned state produces a verified solution
    Given a valid scrambled cube state from the camera fixtures
    When the kociemba planner is asked for a plan
    Then a SolutionPlan is returned with at least one stage
    And applying all of its moves to the input state yields the solved state
    And plan.verified is true
    And plan.moveCount.htm is 22 or fewer

  Scenario: @004-S2 A solved cube yields an empty plan, not an error
    Given the solved cube state
    When a plan is requested
    Then the plan has zero moves, verified is true, and a note says the cube is already solved

  Scenario: @004-S3 Solutions are produced within the latency budget once warm
    Given the solver engine has been initialised
    When 100 random valid states are planned
    Then p50 compute time is at or below 60 ms and p95 at or below 150 ms
    And plan.computeMs reflects the measured time

  Scenario: @004-S4 The solver is warmed before the user has a state
    Given a cold page load of the scan route
    When the page has been idle for 2 s
    Then engineReady is true
    And no "preparing solver" indicator is required when the first state arrives

  Scenario: @004-S5 An invalid state is refused before any search begins
    Given a facelet string with one flipped edge
    When a plan is requested
    Then it fails immediately with the validator's error code
    And no worker search is started

  Scenario: @004-S6 A superseded search is cancelled, not awaited
    Given a plan request in flight for state A
    When a plan is requested for state B and the first request's signal is aborted
    Then the first promise rejects as aborted
    And only the second plan is delivered
    And the worker is idle afterwards

  Scenario: @004-S7 Every method id is registered with honest capabilities
    Given the method registry
    When it is enumerated
    Then entries exist for kociemba, cfop, roux, zz, zb, oh and bld
    And only bld declares memo support
    And every unimplemented planner throws NotImplementedError naming its owning ticket

  Scenario: @004-S8 Stage boundaries are internally consistent
    Given any generated plan with more than one stage
    When each stage is checked
    Then applying a stage's moves to its stateBefore yields its stateAfter
    And each stage's stateBefore equals the previous stage's stateAfter

  Scenario: @004-S9 Old Pochmann corner setup tables perform exactly a buffer-target swap
    Given the solved cube and the Old Pochmann corner buffer UBL
    When for every corner target the setup, Y-perm variant and inverse setup are applied
    Then exactly the buffer and that target sticker's cubie are swapped
    And all other cubies are unchanged in position and orientation

  Scenario: @004-S10 M2 edge setup tables perform exactly a buffer-target swap
    Given the solved cube and the M2 edge buffer DF
    When for every edge target the setup, M2 and inverse setup are applied
    Then exactly the buffer and that target's cubie are swapped
    And all other cubies are unchanged
    And the M-slice special cases FU, BU and BD are covered explicitly

  Scenario: @004-S11 Cycle decomposition produces a correct target sequence with cycle breaks
    Given a scramble whose corner permutation contains two disjoint cycles
    When decompose is called with the UBL buffer
    Then the target list visits every unsolved corner exactly once
    And a cycle break is inserted at the start of the second cycle
    And replaying buffer-target swaps in that order solves all corners

  Scenario: @004-S12 Parity is detected and reported
    Given a scramble with an odd number of edge targets
    When decomposition runs
    Then memo.parity is true
    And given an even number of targets, memo.parity is false

  Scenario: @004-S13 Pieces solved in place and flipped or twisted pieces are reported
    Given a scramble where two edges are flipped in place and one corner is twisted in place
    When decomposition runs
    Then those edges appear in memo.flippedEdges and that corner in memo.twistedCorners
    And they are not emitted as ordinary targets

  Scenario: @004-S14 Letter schemes are bijective and swappable
    Given the default Speffz scheme and a user-defined scheme
    When each is validated
    Then sticker-to-letter and letter-to-sticker are exact inverses over all 48 stickers
    And decomposition with either scheme yields the same cubie targets with different letters

  Scenario: @004-S15 Step solvers produce correct sub-goal solutions
    Given a scrambled state
    When the step engine solves cross, xcross, Roux first block and ZZ EOLine
    Then each returned sequence, applied to the state, satisfies that sub-goal's predicate
    And each is 12 moves or fewer

  Scenario: @004-S16 Move cancellation and metrics are correct
    Given the sequence "R R U U' F2 F2 B B'"
    When cancellation runs
    Then the result is "R2"
    And moveCount reports htm 1, qtm 2, and the etm and stm values for that sequence

  Scenario: @004-S17 Plans round-trip through JSON and states through URLs
    Given any generated plan
    When it is serialised to JSON and parsed back
    Then it is deeply equal to the original
    And the input state round-trips through its URL encoding

  Scenario: @004-S18 Solving works with the network offline
    Given the network is offline after first load
    When a state is planned
    Then a verified plan is produced and no network request is attempted
```

## TDD plan

**Unit (Vitest, `node`)**

| File | Asserts |
| --- | --- |
| `src/cube/model/solution.test.ts` | Stage consistency checker (@004-S8); move counting across all four metrics (@004-S16); JSON round-trip (@004-S17); `allMoves()` flattening of nested `substeps`. |
| `src/cube/solve/engines/min2phase.test.ts` | Facelet-order assertion at init; solved → empty (@004-S2); 50 fixture states solve and verify; `maxDepth`/timeout behaviour; abort (@004-S6). |
| `src/cube/solve/engines/step-solver.test.ts` | cross/xcross/FB/EOLine predicates over 30 random states (@004-S15); length bounds. |
| `src/cube/solve/methods/registry.test.ts` | All seven ids present; capability flags; `NotImplementedError` carries ticket numbers (@004-S7). |
| `src/cube/solve/methods/kociemba.test.ts` | Golden invariant over 100 random states (@004-S1); already-solved note (@004-S2); invalid state refused before search (@004-S5). |
| `src/cube/solve/postprocess.test.ts` | Cancellation table incl. rotations and wide moves; AUF insertion; idempotence (@004-S16). |
| `src/cube/solve/bld/cubies.test.ts` | 24 corner + 24 edge stickers enumerated; sticker↔cubie mappings are exact inverses; derived purely from 001 facelet indices with no hardcoded duplication. |
| `src/cube/solve/bld/scheme.test.ts` | Speffz and a custom scheme are bijections over 48 stickers (@004-S14). |
| `src/cube/solve/bld/cycles.test.ts` | Single cycle; two cycles with a break (@004-S11); buffer solved at start; all pieces solved; parity both ways (@004-S12); flipped edges and twisted corners (@004-S13). |
| `src/cube/solve/bld/cycles.property.test.ts` | `fast-check` over 500 random states: replaying the decomposed buffer-target swaps always solves the relevant piece type, for OP corners, OP edges and M2 edges independently. This is the real proof that decomposition is right. |
| `src/cube/solve/bld/setup.test.ts` | **The table verification of 004-R11**, as a generated test per target: OP corners (@004-S9), OP edges, M2 edges incl. M-slice specials (@004-S10). Every single table entry is asserted; no entry is taken on trust. |

**Integration (Vitest)**

| File | Asserts |
| --- | --- |
| `tests/integration/solve-pipeline.test.ts` | camera-fixture state and BLE-fixture state → registry → kociemba planner → verified plan (@004-S1, @004-S18); stage consistency (@004-S8). |
| `tests/integration/warmup.test.ts` | Engine init is triggered on idle and `engineReady` flips before any state exists (@004-S4). |

**E2E / browser (Playwright, `tests/e2e/004-solver.spec.ts`)**

@004-S4, @004-S6, @004-S18 — real workers, real idle callbacks, real offline context. Also asserts
the main thread is never blocked > 50 ms during a solve (the whole point of the worker).

**Perf (Playwright, `tests/perf/004-solver-latency.spec.ts`)** — @004-S3: 100 states, p50/p95
compute time, plus cold table-build time recorded separately.

**Fixtures** — `tests/fixtures/bld/`: hand-checked decompositions for 10 scrambles (targets, parity,
flipped/twisted) taken from worked examples, so the property tests have a human-verified anchor.
`tests/fixtures/plans/`: frozen `SolutionPlan` JSON for serialisation tests.

## Non-functional requirements

| Metric | Target | Measurement |
| --- | --- | --- |
| Warm solve (kociemba) | ≤ 60 ms p50, ≤ 150 ms p95 | `tests/perf/004-solver-latency.spec.ts` |
| Cold engine init | ≤ 2 s, off the main thread, warmed during idle | Perf spec |
| Main-thread block during solve | ≤ 50 ms total | Playwright long-task observation |
| Step solver (cross/FB/EOLine) | ≤ 400 ms p95 each | Vitest `bench` |
| BLD decomposition | ≤ 2 ms p95 | Vitest `bench` (no search involved) |
| Abort latency | ≤ 20 ms from `abort()` to worker idle | Perf spec |
| Solver chunk | code-split, loaded only on solve-capable routes, ≤ 200 kB gzip | `next build` assertion |
| Offline | solving works fully offline | @004-S18 |
| Correctness | 100% of plans verified; 100% of BLD table entries machine-verified | Unit + property tests |
| Coverage | ≥ 95% lines in `src/cube/solve/bld` | Coverage gate |

## Acceptance criteria

1. All eighteen `@004-Sn` scenarios have passing tests; `check-scenarios.mjs` passes.
2. `KociembaPlanner` end-to-end: a camera-scanned and a BLE-tracked state each yield a verified
   plan.
3. Every BLD setup-move table entry passes the 004-R11 verification; zero entries untested.
4. The property test over 500 random states passes for OP corners, OP edges and M2 edges.
5. All seven `MethodId`s are registered; the six stubs throw `NotImplementedError` with their ticket
   number.
6. No planner can return an unverified plan — the invariant is enforced in the planner base, not
   per-planner.
7. Latency table measured and recorded; abort path demonstrated.
8. Nothing in `src/cube/solve/` imports React, the DOM, or any input module.

## Open questions / risks

- **R1 (RESOLVED, rejected) `min2phase` package maturity.** Investigated by installing it and
  reading the actual package, not just its listing: `min2phase@0.0.1`'s README is the unfilled
  generic boilerplate for `cubing/lib-template.js` (literally titled "lib-template", never
  customised) — not a maturity concern alone but a sign the package was never finished. Its only
  exports (`initialize`, `solve(state: Transformation): Sequence`) depend on the standalone `alg`
  and `kpuzzle` npm packages (not `cubing/alg`/`cubing/kpuzzle`, which is what we use everywhere
  else), both published as `0.9.x` and marked "deprecated, no longer supported" on install. Worse:
  it is licensed `GPL-3.0-or-later` with no dual-license option, which conflicts with this
  project's PolyForm Noncommercial license. **Decision: do not use it.** Verified a working
  alternative already in our dependency tree needs zero new installs: `cubing/search`'s
  `experimentalSolve3x3x3IgnoringCenters(pattern: KPattern): Promise<Alg>` takes the exact
  `KPattern` our own `toKPattern` adapter (001) already produces, and `cubing` is dual-licensed
  `MPL-2.0 OR GPL-3.0-or-later` (we already depend on it project-wide, so no new licensing
  exposure). End-to-end tested against `SUPERFLIP`: produced a 21-move solution in ~3 s cold, and
  `applyMoves` confirmed it reaches `SOLVED_FACELETS` exactly. This is now `SearchEngine`
  (004-T2/T3), not `Min2PhaseEngine`.
- **R2 (RESOLVED, different problem than expected) Two Kociemba table builds.** The combined-cost
  question is moot: `min2phase` is rejected outright (R1), and `cube-solver`'s *full* Kociemba
  solve was never going to be wired in anyway because of a more fundamental mismatch — see the new
  R8 below. `cubing/search`'s warm-up cost is whatever 004-T4's idle-warming measures; no second
  engine's tables need building at all for the POC's `kociemba` method.
- **R8 (NEW) `cube-solver`'s public API doesn't fit a scan-first architecture.** Installed and
  tested directly (`require('cube-solver')` exposes exactly three functions: `scramble`, `solve`,
  `initialize` — confirmed at runtime, nothing else). `solve(scramble: string, type: Solver):
  string` takes a *scramble move-string* and solves "the state reached by applying it to a solved
  cube" — it has no path for handing it a state we observed directly (camera scan, BLE read)
  without already knowing a move sequence that produces that exact state, which is circular (that
  *is* the solving problem). The 17.6 kB minified bundle contains no reference to facelets or any
  state-shaped input at all, confirming this isn't a documentation gap. 004-T5 (`StepSolverEngine`
  for cross/XCross/FB/EOLine, needed by future tickets 006-008) is therefore **blocked**, not
  implemented. Options for whoever picks this up: (a) find a lower-level entry point into
  `cube-solver`'s own search internals that accepts a state rather than a scramble string (would
  need reading its TypeScript source, not just the published bundle); (b) use `cubing/search`'s
  more general `solveTwips(kpuzzle, pattern, options)` with a custom goal pattern expressing the
  sub-goal (cross solved, FB solved, etc.) instead of "fully solved" — promising since it already
  accepts an arbitrary `KPattern`, but needs verifying twsearch's goal-pattern support actually
  covers partial-cube goals; (c) a different step-solver library. Not resolved here — tracked so it
  isn't silently assumed solved.
- **R3 Hand-entered BLD tables are the main correctness risk.** 004-R11 is the mitigation and it is
  non-negotiable: every entry verified by applying it to a real cube model. Expect the first pass to
  find several wrong entries — that is the test working.
- **R4 M2 special cases.** The M-slice targets (FU, BU, BD) and the DF/DB buffer-adjacent cases have
  multiple accepted algorithm variants and are where published tables most often disagree. Encode
  one variant per target, cite the source in a comment, and let 004-R11 adjudicate.
- **R5 Cycle-breaking conventions vary** between tutorials (where to break, whether to prefer
  un-shot pieces, how to order cycles). This affects memo length and comfort, not correctness.
  Implement one documented convention now, make it configurable, and defer "optimal break point"
  heuristics to ticket 011.
- **R6 OH as a modifier** assumes the method planners expose candidate algorithms for re-ranking
  rather than a single baked choice. Tickets 006-008 must honour `preferredAlgs` and expose
  alternatives; flagged here so they are planned that way from the start.
- **R7 ZB scope.** Full ZBLL is 493 cases; ZBLS adds more. Ticket 009 must decide between shipping a
  full alg set (large data file, likely from a public set) and generating ZBLL solutions via the
  solver with a last-layer-only search. Not this ticket's decision, but the result model already
  supports either via `caseId` + `algName`.
- **R9 (NEW) Rotation elimination and AUF insertion deferred.** 004-R14 calls for both as part of
  move post-processing. Neither is implemented: rotation elimination requires a conjugation table
  (rewriting `f` after a rotation `r` as `r·f·r⁻¹` before a rotation, then re-deriving it empirically
  against `kpuzzle` the same way the 001 CORNERS/EDGES tables were — not something to hand-derive
  under time pressure and risk silently breaking the golden invariant, since a rotation actually
  does permute facelets and dropping one is not a no-op). AUF insertion only applies to last-layer
  methods (CFOP/ZZ/ZB), none of which exist yet beyond stubs. `KociembaPlanner`'s own output never
  contains rotations (confirmed empirically against `cubing/search`'s solutions), so neither gap
  blocks this ticket's acceptance criteria — tracked for whichever of 006/008/009 first needs to
  emit a rotation.

## Verification notes

_To be completed during review._
