# Ticket 005 — Solution playback and presentation UI

| Field | Value |
| --- | --- |
| Status | planned |
| Owner model | Opus (planning) → fast model (implementation) |
| Depends on | 001, 004 (hard); 002, 003 (soft — mocked inputs suffice) |
| Blocks | 006, 007, 008, 009, 010, 011, 012 (all need this surface to render into) |
| Requirements | R2, R4, R8, R9, R11 |
| Estimated size | M-L |

## Context / motivation

This is the ticket that makes the POC a product: the user has a cube state (from a smart cube or a
camera scan) and now needs to *read and execute* the solution. Everything before this is
infrastructure.

It is also the surface every future method ticket renders into. If it is built as "a list of moves
with a 3D cube", then CFOP's cross/F2L/OLL/PLL breakdown, Roux's four blocks, ZZ's EOLine, ZBLL case
labels, and BLD's letter pairs and setup moves will each require restructuring it. So it is built
from the start against ticket 004's recursive `SolutionStage` model — stages, substages, case
labels, and an optional `MemoBlock` — with the POC's single-stage Kociemba plan being just the
degenerate case of that structure. When ticket 011 lands a BLD plan with target groups and memo,
this UI renders it with no structural change.

The design constraint from the brief is "clean, minimalistic" and "realize the solution as fast as
possible". Concretely: the solution is visible without scrolling on a phone, the first move is
readable at arm's length, and nothing animates that the user did not ask for.

## Dependencies

- Ticket 001 (`<CubeView>`, `CubeState`, `applyMoves`).
- Ticket 004 (`SolutionPlan`, `SolutionStage`, `MemoBlock`, method registry, `KociembaPlanner`).
- Tickets 002/003 soft: this ticket is developed against fixture plans and fixture states, and wired
  to the real inputs when they land. A fixture-state entry point (`?s=<facelets>`) means development
  never blocks on hardware or a camera.

## Scope

**In scope**

- `/solve` route: given a `CubeState` (from BLE tracker, camera scan, URL, or a generated scramble),
  show the solution.
- Method picker over the ticket-004 registry, with unimplemented methods visibly marked and
  disabled rather than hidden.
- Move list presentation: grouped by stage, with the current move prominent and the next few
  readable ahead.
- Playback controls: prev/next move, jump to stage, play/pause with adjustable tempo, reset.
- `<CubeView>` synchronised to the current move index, with hint facelets toggle.
- **Live mode** for smart cubes: the user's actual turns advance the solution pointer; correct moves
  advance, wrong moves are flagged with a recovery affordance.
- **Stage navigation** structure ready for per-method breakdowns (collapsible stages, substages,
  case labels, per-stage move counts).
- **Memo presentation** for BLD: letter pairs, targets, setup/swap/undo move annotation, parity
  marker — rendered from `MemoBlock`, behind the same component that renders geometric stages.
- Deep-linkable state + method (`/solve?s=<facelets>&m=<method>`).
- Keyboard controls, mobile layout, accessibility, reduced-motion support.

**Out of scope**

- Implementing any method planner (006-011). This ticket renders what 004's registry returns,
  including `NotImplementedError` states.
- Solve timing, statistics, history, persistence (013).
- Algorithm trainers / reference pages (014).
- Camera or Bluetooth implementation (002/003) — consumed, not built.
- AR overlay of moves onto the live camera feed. Tempting; separate ticket.

## Detailed requirements

- **005-R1** `/solve` accepts a state from, in priority order: the live BLE tracker (002), the
  completed camera scan (003), a `?s=` URL parameter, or a "scramble a virtual cube" action. If no
  state is available it shows the two input choices (connect / scan) and nothing else.
- **005-R2** Method picker: a single compact control listing every `MethodId` from the 004 registry.
  Implemented methods are selectable; unimplemented ones render with a "coming soon" affordance and
  their owning ticket number in a tooltip (honest, and it documents the roadmap in the product).
  Selection is reflected in the URL and persisted to `localStorage`.
- **005-R3** Solution panel renders `plan.stages` recursively:
  - Stage header: `label`, move count, `algName`/`caseId` when present, collapse toggle.
  - Moves rendered as individual tappable tokens in standard notation, monospaced, with
    `annotation` shown as a subtle qualifier (`setup`, `swap`, `undo`, `parity`, `AUF`).
  - A single-stage plan (the POC's Kociemba output) renders as a flat list with no stage chrome —
    the structure must not add visual noise when there is only one stage.
  - `substeps` nest one level visually; deeper nesting collapses by default.
- **005-R4** Current-move emphasis: the active move is visually dominant; the preceding move and
  the next three are legible; the rest is de-emphasised but present. The active move must be
  readable at 360 px width without zoom.
- **005-R5** Controls: `prev`, `next`, `play/pause`, `tempo` (0.5×/1×/2×), `reset`, `jump to stage`.
  Tapping any move token jumps directly to it. All reachable within one thumb-zone row on mobile.
- **005-R6** `<CubeView>` sync: the 3D cube shows the state at the current move index, driven
  through `<CubeView>`'s imperative handle (001-R9) — never by remounting. Jumping to a stage
  boundary uses that stage's `stateBefore` (004-R1) rather than replaying from the start.
- **005-R7** Hint facelets toggle (`cubing/twisty`'s `hintFacelets`) so the user can see the two
  hidden faces; persisted.
- **005-R8** **Live mode** (when a smart cube is connected): the solution pointer advances on the
  user's real turns.
  - A move matching the expected move advances the pointer.
  - A non-matching move puts the UI in `diverged` state showing what was done versus expected, with
    two recoveries: "undo that move" (shows the inverse) or "re-solve from here" (re-plans from the
    tracker's current state — the actually useful option, and it exercises 004's cancellation path).
  - Rotations and whole-cube reorientations must not be treated as divergences.
  - Live mode is off and hidden when no cube is connected.
- **005-R9** Divergence detection compares the tracker's state to the expected state at the pointer,
  not just the move label — so an equivalent-but-differently-notated turn (`U'` vs `U3`) or a slice
  performed as two wide turns does not false-positive.
- **005-R10** `MemoBlock` rendering (data arrives in ticket 011; the component and its tests ship
  now, driven by fixture memo data):
  - Corner and edge target sequences as letters, chunked into letter pairs, in reading order.
  - Each pair expandable to show its targets, setup moves, swap alg and undo.
  - Parity shown as an explicit badge with its algorithm.
  - Flipped edges / twisted corners listed separately from the target sequence.
  - A "memo only" view that hides all moves and shows just the letter pairs — what a blindfold solver
    actually stares at.
  - Buffer and letter scheme named on screen.
- **005-R11** `NotImplementedError` from a stub planner renders as a clear in-panel message naming
  the method and its ticket, with the implemented methods still selectable. It must never surface as
  a crash or an empty panel.
- **005-R12** Solving states: `idle` → `planning` (skeleton, no spinner jitter; if the solve returns
  in under 150 ms show no loading state at all, to avoid a flash) → `ready` | `error`. Invalid input
  state routes back to the camera correction UI (003-R10) with the validator's message intact.
- **005-R13** Keyboard: `←`/`→` prev/next move, `Space` play/pause, `↑`/`↓` previous/next stage,
  `H` hint facelets, `R` reset. Documented in a discoverable shortcut hint.
- **005-R14** Accessibility: the move list is a labelled list where each move's accessible name is
  its spoken form ("R prime", "U two"); the current move is announced via a polite live region on
  change; all controls have accessible names; focus is visible; axe reports no serious/critical
  violations.
- **005-R15** Reduced motion: with `prefers-reduced-motion`, cube transitions are instant rather
  than animated, and `play` steps discretely.
- **005-R16** Mobile layout: at 360×640 the cube, the active move, and the controls are all above
  the fold without scrolling. The full move list is reachable by scrolling the panel, not the page.
- **005-R17** Deep link: `/solve?s=<base64url facelets>&m=<method>` restores state and method
  exactly (uses 004-R16's encoding). A share action copies the current link.
- **005-R18** No layout shift when a plan arrives: the panel reserves its space. CLS ≈ 0.

## Architecture / approach notes

**Render the recursive model, not the POC's shape.** `SolutionStage` from 004-R1 is deliberately
recursive and carries `algName`, `caseId`, `substeps`, `memo`, and per-stage `stateBefore/After`.
This ticket builds exactly one `<StageList>` component that handles all of it. The POC's Kociemba
plan has one stage and no substeps, so it renders flat — but the component that renders CFOP's
`cross / f2l-1..4 / oll / pll`, Roux's `fb / sb / cmll / lse`, ZZ's `eoline / zzf2l / ll`, and BLD's
target groups is the same component, already tested against fixture plans of each shape. That is
the "no rework" requirement made concrete: **ship fixture plans for all six future methods in this
ticket's test suite**, so the UI is proven against CFOP/Roux/ZZ/ZB/BLD shapes before those planners
exist.

**O(1) scrubbing.** Jumping to a stage uses the stored `stateBefore`; jumping to a move within a
stage replays only that stage's moves (≤ ~15). Nothing ever replays from the scramble. This keeps
scrubbing instant on a phone and keeps `<CubeView>` as the only stateful piece.

**Live mode compares states, not labels.** Move-label matching breaks immediately on notation
equivalences, wide-move substitutions, and whole-cube rotations. Comparing the tracker's facelets to
the expected facelets at the pointer is both simpler and correct, and it is free because 004 already
stores per-stage states and 001 already has `applyMoves`. "Re-solve from here" then falls out
naturally and is the recovery users actually want.

**No loading flash.** A warm min2phase solve is ~60 ms p50 (004-R3). Showing a spinner for 60 ms is
worse than showing nothing. Hence the 150 ms threshold in 005-R12 — a small detail that is most of
the perceived-latency win on this screen.

**Minimal by subtraction.** One screen, one primary action, Tailwind only, no component library, no
icon set beyond a handful of inline SVGs, no animation that was not requested. The typographic
hierarchy does the work: the active move is the largest text on the page.

## Tasks

- [ ] 005-T1 `/solve` route and state-source priority: BLE → camera → `?s=` → scramble (005-R1) (TDD: src/app/solve/page.test.tsx) (BDD: @005-S1, @005-S2)
- [ ] 005-T2 Method picker over the 004 registry, URL + localStorage persistence (005-R2) (TDD: src/components/solve/MethodPicker.test.tsx) (BDD: @005-S15)
- [ ] 005-T3 `<StageList>` recursive stage/substep renderer (005-R3)
  - [ ] 005-T3.1 Stage header: label, move count, algName/caseId, collapse toggle (TDD: src/components/solve/StageList.test.tsx) (BDD: @005-S9)
  - [ ] 005-T3.2 Move tokens with annotation qualifiers (TDD: src/components/solve/MoveToken.test.tsx)
  - [ ] 005-T3.3 Flat rendering with no stage chrome for single-stage plans (TDD: src/components/solve/StageList.test.tsx) (BDD: @005-S8)
- [ ] 005-T4 Current-move emphasis and lookahead styling (005-R4) (TDD: src/components/solve/MoveToken.test.tsx) (BDD: @005-S4)
- [ ] 005-T5 Playback controls: prev/next/play/pause/tempo/reset/jump-to-stage (005-R5) (TDD: src/components/solve/PlaybackControls.test.tsx) (BDD: @005-S5)
- [ ] 005-T6 `<CubeView>` sync via imperative handle; stage-boundary jumps use stored `stateBefore` (005-R6) (TDD: src/cube/solve/playback/pointer.test.ts) (BDD: @005-S3, @005-S12)
- [ ] 005-T7 Hint facelets toggle, persisted (005-R7) (TDD: src/components/solve/PlaybackControls.test.tsx) (BDD: @005-S20)
- [ ] 005-T8 Live mode (005-R8, 005-R9)
  - [ ] 005-T8.1 Pointer advance on matching real turns (TDD: src/cube/solve/playback/live.test.ts) (BDD: @005-S16)
  - [ ] 005-T8.2 Divergence detection by state comparison, not move labels (TDD: src/cube/solve/playback/live.test.ts) (BDD: @005-S17)
  - [ ] 005-T8.3 "Undo" and "re-solve from here" recoveries, with prior search cancellation (TDD: src/cube/solve/playback/live.test.ts) (BDD: @005-S17)
  - [ ] 005-T8.4 Whole-cube rotations excluded from divergence (TDD: src/cube/solve/playback/live.test.ts) (BDD: @005-S18)
- [ ] 005-T9 `<MemoPanel>` BLD rendering incl. memo-only view (005-R10) (TDD: src/components/solve/MemoPanel.test.tsx) (BDD: @005-S13, @005-S14)
- [ ] 005-T10 Honest `NotImplementedError` rendering naming the method and owning ticket (005-R11) (TDD: src/components/solve/SolutionPanel.test.tsx) (BDD: @005-S15)
- [ ] 005-T11 Solving state machine idle/planning/ready/error with the 150 ms no-flash threshold (005-R12) (TDD: src/components/solve/SolutionPanel.test.tsx) (BDD: @005-S1, @005-S7)
- [ ] 005-T12 Keyboard shortcuts: arrows, space, H, R (005-R13) (TDD: src/components/solve/PlaybackControls.test.tsx) (BDD: @005-S20)
- [ ] 005-T13 Accessibility: labelled move list, polite live region, focus visibility, axe-clean (005-R14) (BDD: @005-S21) (reasoning: axe scan reports zero serious/critical violations, reviewed per release)
- [ ] 005-T14 Reduced-motion support (005-R15) (BDD: @005-S22)
- [ ] 005-T15 Mobile above-the-fold layout at 360x640 (005-R16) (TDD: src/components/solve/SolutionPanel.test.tsx) (BDD: @005-S23)
- [ ] 005-T16 Deep link encode/decode (`?s=`&`?m=`) and share action (005-R17) (TDD: src/app/solve/page.test.tsx) (BDD: @005-S19)
- [ ] 005-T17 Reserved panel space so plan arrival causes no layout shift (005-R18) (TDD: src/components/solve/SolutionPanel.test.tsx) (BDD: @005-S23)
- [ ] 005-T18 Author the six future-method fixture plans (kociemba/cfop/roux/zz/zb/bld-shaped) (logical-eval: `<StageList>` and `<MemoPanel>` render every fixture shape correctly with no component changes needed per shape — @005-S9, @005-S10, @005-S11, @005-S13)
- [ ] 005-T19 Write every test in the TDD plan (component/unit/integration/E2E/perf) and make it pass (logical-eval: `npm run test` is green and `check-scenarios.mjs` reports zero orphaned scenario ids)
- [ ] 005-T20 Record both end-to-end POC demonstrations (camera→solved, smart-cube→solved) in Verification notes (reasoning: both demonstrated manually and timings transcribed, not estimated)

## BDD acceptance scenarios

```gherkin
Feature: 005 Solution playback and presentation

  Scenario: @005-S1 A camera-scanned state yields a readable solution immediately
    Given a completed camera scan of a scrambled cube
    When the solve screen opens
    Then a move sequence is displayed with the first move emphasised
    And the 3D cube shows the scanned state
    And no loading indicator was shown for longer than 150 ms

  Scenario: @005-S2 A smart-cube state yields a solution without any scan step
    Given a connected smart cube with a scrambled tracked state
    When the user chooses Solve
    Then a verified solution is displayed for the tracked state

  Scenario: @005-S3 Stepping forward and back moves the cube and the pointer together
    Given a displayed solution of at least 15 moves
    When the user advances 5 moves and then goes back 2
    Then the pointer is at move 3
    And the 3D cube's state equals the input state with the first 3 moves applied

  Scenario: @005-S4 Tapping a move jumps directly to it
    Given a displayed solution
    When the user taps the 11th move token
    Then the pointer is at move 11 and the cube reflects 10 applied moves

  Scenario: @005-S5 Playback runs at the selected tempo and can be paused
    Given a displayed solution
    When the user presses play at 2x tempo
    Then moves advance automatically at roughly twice the base rate
    And pausing stops advancement at the current move

  Scenario: @005-S6 Completing the sequence shows the solved cube
    Given a displayed solution
    When the pointer reaches the final move
    Then the 3D cube shows the solved state
    And a completion indicator is shown

  Scenario: @005-S7 Already-solved input is handled gracefully
    Given a solved cube state
    When the solve screen opens
    Then it says the cube is already solved
    And no empty move list or error is rendered

  Scenario: @005-S8 A single-stage plan renders flat with no stage chrome
    Given a Kociemba plan with one stage
    When the solution panel renders
    Then no stage header or collapse control is displayed
    And the moves appear as one list

  Scenario: @005-S9 A multi-stage CFOP-shaped plan renders grouped and collapsible
    Given a fixture plan with stages cross, f2l-1 to f2l-4, oll and pll
    When the solution panel renders
    Then seven stage headers are shown with their labels and move counts
    And the OLL and PLL headers show their case ids and algorithm names
    And collapsing F2L hides its moves while keeping its header and count

  Scenario: @005-S10 A Roux-shaped plan renders its four blocks
    Given a fixture plan with stages fb, sb, cmll and lse
    When the solution panel renders
    Then four stage headers appear in that order with correct labels

  Scenario: @005-S11 A ZZ-shaped plan renders EOLine as its first stage
    Given a fixture plan with stages eoline, zzf2l and ll
    When the solution panel renders
    Then the first stage is labelled EOLine

  Scenario: @005-S12 Jumping to a stage is instant and uses the stored state
    Given a multi-stage plan
    When the user jumps to the OLL stage
    Then the cube shows that stage's stateBefore
    And no replay from the initial state occurs

  Scenario: @005-S13 A BLD plan shows letter pairs, setup moves and parity
    Given a fixture BLD plan with a memo block containing 11 edge targets, 8 corner targets and parity
    When the solution panel renders
    Then corner and edge letter pairs are shown in reading order
    And expanding a pair reveals its setup moves, swap algorithm and undo moves
    And a parity badge is shown with its algorithm
    And the buffer pieces and letter scheme are named

  Scenario: @005-S14 BLD memo-only view hides the moves
    Given a displayed BLD plan
    When the user switches to memo-only view
    Then only the letter pairs, parity marker and any flipped or twisted pieces are shown
    And no move tokens are visible

  Scenario: @005-S15 Unimplemented methods are honest, not broken
    Given the method picker
    When the user selects Roux while its planner is a stub
    Then an in-panel message names the method and its owning ticket
    And the previously selected implemented method remains selectable
    And no error boundary is triggered

  Scenario: @005-S16 Live mode advances the pointer on the user's real turns
    Given a connected smart cube and a displayed solution
    When the user performs the first three expected moves on the cube
    Then the pointer advances to move 4 without any on-screen interaction
    And the 3D cube mirrors the physical cube

  Scenario: @005-S17 A wrong turn in live mode is detected and recoverable
    Given live mode at move 4 of the solution
    When the user performs a move that is not the expected one
    Then the UI shows the diverged state with what was done and what was expected
    And choosing "re-solve from here" produces a new verified plan for the cube's current state
    And the previous in-flight plan request, if any, is cancelled

  Scenario: @005-S18 Whole-cube rotations in live mode are not divergences
    Given live mode at any move
    When the user rotates the whole cube without turning a layer
    Then the pointer does not change and no divergence is reported

  Scenario: @005-S19 Deep link restores state and method exactly
    Given a solve screen with a scanned state and a chosen method
    When the share link is copied and opened in a fresh session
    Then the same state and method are restored and the same solution is shown

  Scenario: @005-S20 Keyboard controls drive the whole screen
    Given a displayed solution with focus on the page
    When the user presses right arrow, right arrow, left arrow, space and H
    Then the pointer is at move 1, playback toggled once, and hint facelets toggled

  Scenario: @005-S21 Screen readers announce the current move
    Given a displayed solution
    When the pointer advances
    Then a polite live region announces the new move in spoken form such as "R prime"
    And an axe scan reports no serious or critical violations

  Scenario: @005-S22 Reduced motion disables cube animation
    Given prefers-reduced-motion is set
    When the pointer advances
    Then the cube state changes without an animated transition

  Scenario: @005-S23 Mobile layout keeps cube, active move and controls above the fold
    Given a 360x640 viewport with a displayed solution
    When the screen is measured
    Then the cube, the active move and the control row are all within the viewport without scrolling
    And cumulative layout shift when the plan arrives is below 0.02

  Scenario: @005-S24 Invalid input routes back to correction rather than erroring
    Given an input state that fails validation
    When the solve screen opens
    Then the user is returned to the scan correction view with the validator's message
```

## TDD plan

**Component (Vitest + RTL)** — the bulk of this ticket, driven by fixture plans.

| File | Asserts |
| --- | --- |
| `src/components/solve/StageList.test.tsx` | Flat render for single-stage (@005-S8); grouped render for CFOP/Roux/ZZ fixture shapes (@005-S9, @005-S10, @005-S11); collapse behaviour; case id and alg name display; one-level `substeps` nesting; annotation rendering. |
| `src/components/solve/MoveToken.test.tsx` | Notation display; active/next/past styling states; tap handler (@005-S4); accessible name is the spoken form (@005-S21). |
| `src/components/solve/PlaybackControls.test.tsx` | prev/next clamping; play/pause; tempo change; reset; jump-to-stage; keyboard map (@005-S5, @005-S20). |
| `src/components/solve/MemoPanel.test.tsx` | Letter-pair chunking incl. an odd final letter; expansion reveals setup/swap/undo (@005-S13); parity badge; flipped/twisted lists; memo-only view (@005-S14); buffer and scheme named. |
| `src/components/solve/MethodPicker.test.tsx` | Enumerates the 004 registry; stubs disabled with ticket number (@005-S15); selection persisted and reflected in the URL. |
| `src/components/solve/SolutionPanel.test.tsx` | State machine idle/planning/ready/error; no loading indicator under 150 ms (@005-S1); already-solved copy (@005-S7); `NotImplementedError` handling (@005-S15); invalid-state redirect (@005-S24); reserved space / no layout shift (@005-S23). |
| `src/app/solve/page.test.tsx` | State source priority order (@005-S1, @005-S2); `?s=`/`?m=` parsing and restoration (@005-S19); no-state empty view offering connect/scan. |

**Unit (Vitest, `node`)**

| File | Asserts |
| --- | --- |
| `src/cube/solve/playback/pointer.test.ts` | Pure pointer reducer: next/prev/jump-to-move/jump-to-stage across nested stages; clamping; derived `stateAt(index)` uses the nearest stage `stateBefore` and replays ≤ that stage's moves (@005-S3, @005-S12). |
| `src/cube/solve/playback/live.test.ts` | Divergence detection by state comparison: matching move advances (@005-S16); notation-equivalent moves advance; rotations ignored (@005-S18); genuine divergence flagged with done-vs-expected (@005-S17); re-solve request carries the tracker's current state and aborts the prior request. |
| `src/cube/solve/playback/memo-format.test.ts` | Letter-pair chunking, odd-count tail handling, reading order, pair-to-target mapping. |

**Integration (Vitest)**

| File | Asserts |
| --- | --- |
| `tests/integration/solve-screen.test.ts` | Fixture camera state → 004 kociemba planner → pointer reducer → rendered panel, asserting the cube state at each of 20 pointer positions equals `applyMoves` from the input (the golden invariant, enforced through the UI layer). |
| `tests/integration/live-follow.test.ts` | BLE replay trace (002 fixture) driving live mode through a full solution, including one injected wrong move and recovery (@005-S16, @005-S17, @005-S18). |

**E2E (Playwright, `tests/e2e/005-solve.spec.ts`)**

@005-S1 through @005-S7, @005-S12, @005-S19 through @005-S23 — real browser, real `twisty-player`,
real URL handling, real `prefers-reduced-motion` and viewport emulation, axe scan.

**Perf (Playwright, `tests/perf/005-playback.spec.ts`)** — step latency, stage-jump latency, CLS,
and time-to-first-move-visible, all against the table below.

**Fixtures (`tests/fixtures/plans/`)** — frozen `SolutionPlan` JSON for: `kociemba-flat.json`,
`cfop-shaped.json` (cross + 4 F2L + OLL(caseId `OLL-27`) + PLL(caseId `PLL-Ja`)),
`roux-shaped.json` (fb/sb/cmll/lse), `zz-shaped.json` (eoline/zzf2l/ll),
`zb-shaped.json` (cross/F2L/ZBLL), `bld-m2-op.json` (full `MemoBlock`: 8 corner targets, 11 edge
targets, parity true, one flipped edge, setup/swap/undo annotated), `solved.json`.
**These fixtures are the mechanism that proves "no rework needed for later methods" — they are
hand-authored to the 004 model now, and tickets 006-011 must produce plans that match their shapes.**

## Non-functional requirements

| Metric | Target | Measurement |
| --- | --- | --- |
| Scan/BLE state → first move visible | ≤ 250 ms p95 (warm solver) | `tests/perf/005-playback.spec.ts` |
| Step forward/back | ≤ 16 ms to pointer+cube update | Perf spec |
| Jump to stage | ≤ 32 ms | Perf spec |
| Live-mode turn → pointer advance | ≤ 100 ms p95 end-to-end from BLE event | Perf spec, chained with 002's budget |
| Loading indicator | never shown for a solve completing in < 150 ms | @005-S1 |
| CLS on plan arrival | < 0.02 | Perf spec |
| `/solve` route JS (excl. twisty + solver chunks) | ≤ 90 kB gzip | `next build` assertion |
| Mobile | cube + active move + controls above the fold at 360×640 | @005-S23 |
| Accessibility | 0 serious/critical axe violations; full keyboard operation | @005-S20, @005-S21 |
| Reduced motion | honoured | @005-S22 |

## Acceptance criteria

1. All twenty-four `@005-Sn` scenarios have passing tests; `check-scenarios.mjs` passes.
2. End-to-end POC demonstrated twice: camera scan → solution stepped to solved; smart cube →
   solution stepped to solved. Both recorded in *Verification notes*.
3. `<StageList>` and `<MemoPanel>` render all seven fixture plan shapes correctly, including the BLD
   memo fixture, with no component changes needed per shape.
4. Live mode follows a full BLE replay trace, including divergence and re-solve recovery.
5. All six unimplemented methods appear in the picker and degrade honestly.
6. Pointer logic is a pure reducer with no React dependency and ≥ 95% line coverage.
7. Every latency and layout figure above is measured and recorded.
8. Deep links round-trip; the screen works offline after first load.

## Open questions / risks

- **R1 Stage shapes could still be wrong.** The fixture plans are our best guess at what CFOP/Roux/
  ZZ/ZB/BLD planners will emit. If ticket 006 discovers a shape the model cannot express (e.g. F2L
  needing per-pair *alternatives*, or BLD needing interleaved corner/edge execution order), that is a
  change to 004's model and a PRD amendment here — exactly the escalation path in
  `.tickets/Agents.md` §5.1. Reviewing the fixtures with a method-specific eye before implementation
  starts is the cheapest way to catch this.
- **R2 Live-mode divergence UX** is the subtlest part of this ticket. Users turn fast and will
  overshoot; a pointer that fights them is worse than no live mode. Mitigation: state comparison
  rather than label matching, plus "re-solve from here" as the always-correct escape. If testing
  shows it still feels wrong, consider auto-re-solving silently on any divergence.
- **R3 `cubing/twisty` timeline API is pre-1.0** (001-R1). All interaction goes through
  `<CubeView>`'s handle; if the upstream API shifts, the fix is in one file. Do not let pointer logic
  reach into the player.
- **R4 Mobile above-the-fold budget** is tight: a 3D cube, a large active move, a readable lookahead,
  and a control row at 360×640. If it does not fit, shrink the cube before shrinking the move type —
  the move text is the product.
- **R5 BLD memo UI is being built before real memo data exists** (011). The fixture is authored from
  the jperm.net/bld and speedsolving M2 references, so it should be representative, but expect
  refinement when real decompositions arrive — particularly around how many pairs fit on screen and
  whether corners or edges are shown first.
- **R6 Tempo-based autoplay** is of limited value for a human executing moves on a physical cube
  (they are slower than any tempo). Keep it, but do not spend design effort there; prev/next and
  live mode are the real interactions.

## Verification notes

_To be completed during review._
