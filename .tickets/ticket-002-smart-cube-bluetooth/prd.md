# Ticket 002 — Smart cube Bluetooth input: connection, live move stream, state reconstruction

| Field | Value |
| --- | --- |
| Status | in-progress |
| Owner model | Opus (planning) → fast model (implementation) |
| Depends on | 001 |
| Blocks | 005 (soft), 010, 013 |
| Requirements | R5, R2, R11 |
| Estimated size | M |

## Context / motivation

A smart cube is the lowest-latency input path we have: the cube itself tells us its state, so there
is no vision step and no user-driven capture flow. Connect, and the app already knows the scramble.
It is also the path that enables live solve tracking — every turn arrives as an event in tens of
milliseconds, which later tickets use for move-by-move progress through a solution and for solve
timing.

Smart cube vendors use proprietary, obfuscated, frequently-changed BLE protocols. We will not
reverse-engineer them. This ticket wraps existing, actively-maintained reverse-engineering work
behind a driver interface narrow enough that we can swap or add a vendor library without touching
anything upstream of it.

## Dependencies

- Ticket 001 (`CubeState`, `Move`, validator, `applyMoves`, `<CubeView>`).
- External: a Chromium-based browser with Web Bluetooth; HTTPS or `localhost` (secure context);
  a user gesture to open the device chooser. Physical hardware is needed for manual sign-off but
  **not** for the automated suite (see TDD plan).

## Scope

**In scope**

- `CubeDriver` interface and a driver registry.
- One concrete multi-vendor driver built on `smartcube-web-bluetooth`, covering GAN Gen2/Gen3/Gen4,
  Giiker/Mi, GoCube/Rubik's Connected, MoYu, QiYi.
- `cubing/bluetooth` as a secondary driver behind the same interface (HEYKUBE and older GAN/GiiKER
  devices it covers that the primary does not).
- A deterministic `ReplayDriver` that plays recorded BLE traces — the backbone of the test suite and
  of local development without hardware.
- State reconstruction: seed from the cube's reported facelets, then apply the move stream; detect
  and recover from drift.
- Capability reporting (`facelets`, `moves`, `gyro`, `battery`) so the UI only offers what the
  connected device supports.
- Connection lifecycle UI: availability detection, connect button, status, battery, reconnect,
  explicit "set as solved" calibration.
- Feature detection with an honest, actionable message when Web Bluetooth is absent, routing the
  user to the camera scanner (003).

**Out of scope**

- Solve timing, statistics, persistence (013).
- Gyro-based auto-orientation of the 3D view (nice-to-have; a follow-up ticket). We *capture* gyro
  if available but do not depend on it.
- Writing to the cube (LED/haptics on devices that support it).
- Implementing any BLE protocol from scratch. If a vendor is unsupported upstream, the answer is
  the camera scanner, not new protocol work.

## Detailed requirements

- **002-R1** Define `src/cube/input/bluetooth/driver.ts`:

  ```ts
  export interface CubeDriver {
    readonly id: string;                       // "smartcube-web-bluetooth" | "cubing-bluetooth" | "replay"
    readonly deviceName: string;
    readonly capabilities: DriverCapabilities; // { facelets, moves, gyro, battery: boolean }
    requestDevice(): Promise<void>;            // must be called from a user gesture
    readFacelets(): Promise<FaceletString>;    // throws CapabilityError if unsupported
    onMove(cb: (e: MoveEvent) => void): Unsubscribe;      // { move: Move; deviceTimestamp: number; receivedAt: number; serial?: number }
    onOrientation(cb: (q: Quaternion) => void): Unsubscribe;
    onBattery(cb: (pct: number) => void): Unsubscribe;
    onConnectionChange(cb: (s: ConnectionState) => void): Unsubscribe;
    disconnect(): Promise<void>;
  }
  ```

  Nothing outside `src/cube/input/bluetooth/` may import a vendor library.
- **002-R2** Implement `SmartCubeWebBluetoothDriver` over
  [`smartcube-web-bluetooth`](https://github.com/poliva/smartcube-web-bluetooth) using its
  **generic** (auto-detecting) API, mapping its `FACELETS`, `MOVE`, `GYRO`, `BATTERY` RxJS events
  onto the `CubeDriver` callbacks. Convert its facelet representation into our canonical URFDLB
  `FaceletString` (001-R2) and validate before accepting. RxJS is confined to this file; the
  interface above is callback-based so RxJS does not leak into the app.
- **002-R3** Implement `CubingBluetoothDriver` over
  [`cubing/bluetooth`](https://js.cubing.net/cubing/bluetooth/) using `connectSmartPuzzle()` +
  `addAlgLeafListener()` + `addOrientationListener()`. Note it does not expose a move stream for
  MoYu; report that honestly via `capabilities.moves = false` and fall back to facelet polling.
- **002-R4** Driver registry `connectCube(preferred?: DriverId): Promise<CubeDriver>` tries the
  primary driver, then the secondary, surfacing a single typed error union
  (`UnsupportedBrowser | PermissionDenied | NoDeviceChosen | ConnectionFailed | UnsupportedDevice`).
  Each error maps to one specific UI message. Driver selection is overridable via a query param for
  debugging.
- **002-R5** `CubeStateTracker`: holds the authoritative `CubeState`. On connect it seeds from
  `readFacelets()` when available, otherwise from an explicit user "my cube is solved now" action.
  Each `MoveEvent` applies one move via `applyMoves` (001-R7) and emits the new state. The tracker
  is pure and synchronous — it takes events in and emits states out, with no knowledge of BLE.
- **002-R6** Drift detection and recovery: for devices with `capabilities.facelets`, re-read
  facelets (a) 400 ms after the move stream goes quiet, (b) on reconnect, (c) on demand. If the
  authoritative state disagrees with the device's report, the **device wins**; emit a
  `drift-corrected` event with the number of differing facelets so the UI can show a brief
  "resynced" indicator. Log the diff for diagnosis.
- **002-R7** Out-of-order / duplicate handling: where the driver exposes a move serial number, drop
  duplicates and reorder within a 100 ms window; if a gap in serials is detected, do not guess —
  trigger a facelet re-read (002-R6). Where there is no serial, trust arrival order.
- **002-R8** Reconnect: on unexpected disconnect, attempt automatic reconnection with backoff
  (250 ms, 1 s, 3 s), preserving the tracked state across the gap, then re-read facelets to confirm.
  After three failures, surface a manual "Reconnect" affordance. Never silently discard a tracked
  state.
- **002-R9** Capability-aware, minimal UI at `/connect`: Web Bluetooth availability check first; a
  single primary "Connect cube" button (user gesture); then device name, battery (if reported),
  live-move indicator, a `<CubeView>` mirroring the tracked state, and "Use camera instead" as an
  always-visible alternative. No modal stacks, no wizard.
- **002-R10** When `navigator.bluetooth` is absent, render — instead of a disabled button — a
  one-line explanation naming the actual cause ("Your browser doesn't support Web Bluetooth. Safari
  and Firefox don't implement it.") and a prominent link to the camera scanner. This path is the
  common case on iOS, so it must not read like an error state.
- **002-R11** `ReplayDriver` consumes a JSON trace
  (`{ device, capabilities, initialFacelets, events: [{ t, kind, payload }] }`) and replays it with
  real or compressed timing. Ship traces in `tests/fixtures/ble/` for: GAN Gen3 scramble+solve,
  QiYi solve, a mid-solve disconnect/reconnect, a dropped-move gap, a duplicate-event burst, and a
  drift case where reported facelets disagree with the applied moves.
- **002-R12** Instrument end-to-end move latency: for every move, record
  `receivedAt - deviceTimestamp` (where the device clock is usable) and
  `renderedAt - receivedAt`. Expose p50/p95 in a dev-only overlay and assert them in `tests/perf/`.

## Architecture / approach notes

**Primary library choice.** [`smartcube-web-bluetooth`](https://github.com/poliva/smartcube-web-bluetooth)
(MIT) is the broadest actively-maintained Web Bluetooth smart cube library: GAN Gen1-Gen4,
Giiker/Mi/Hi, GoCube/Rubik's Connected, MoYu (AI 2023, MHC, WRM), QiYi, XMD Tornado V4, behind one
auto-detecting generic API that emits `FACELETS` / `MOVE` / `GYRO` / `BATTERY` and ships
`cubeTimestampLinearFit()` for device-clock calibration. It is a superset-oriented evolution of
[`gan-web-bluetooth`](https://github.com/afedotov/gan-web-bluetooth) (MIT, GAN Gen2/3/4 + GAN Smart
Timer, last published ~2 years ago, GAN-only). We take the multi-vendor one as primary and keep
`gan-web-bluetooth` as the reference implementation to consult for GAN-specific quirks.

Caveat to verify at implementation time: the README documents installation as
`npm i github:poliva/smartcube-web-bluetooth`. Confirm whether a registry build is published; if
not, pin the exact commit SHA in `package.json` (MIT permits vendoring, which is the fallback).
Record the resolved decision in *Verification notes*.

`cubing/bluetooth` is the secondary because it covers devices the primary does not (HEYKUBE, some
older GiiKER/GAN revisions) and because it is maintained by the same team as the rest of our stack.
Its own documentation is blunt about the situation: vendors "use proprietary protocols that they
purposely obfuscate and change without warning". Two drivers behind one interface is the correct
hedge.

**Why a tracker separate from the driver.** The tracker is pure, synchronous and trivially testable
against recorded traces; the driver is the only part that is hard to test. This split is what makes
automated coverage of 002 possible without hardware, and it is reused verbatim by ticket 005's live
move-following and by any future solve-timer ticket.

**Device beats dead reckoning.** Applying a move stream is cheap but accumulates error on any
dropped packet. Any device that can report facelets is the ground truth, consulted whenever the
stream goes quiet — which is exactly when the user has stopped turning and is about to look at the
screen, so the re-read costs nothing perceptible.

**Secure-context and gesture constraints.** `requestDevice()` requires a transient user activation
and a secure context. The connect button must therefore call it directly in its handler — no
`await` before it, no deferral into an effect. This is a common and silent failure mode; the lint
rule and @002-S11 exist to catch it.

## Tasks

- [x] 002-T1 `CubeDriver` interface and capability types (002-R1) (logical-eval: `SmartCubeWebBluetoothDriver`, `CubingBluetoothDriver` and `ReplayDriver` all type-check against this interface with no widening)
- [x] 002-T2 `SmartCubeWebBluetoothDriver` (002-R2)
  - [x] 002-T2.1 Map FACELETS/MOVE/GYRO/BATTERY RxJS events to callback-based `CubeDriver` methods (BDD: @002-S2, @002-S13) (TDD: src/cube/input/bluetooth/smartcube-web-bluetooth-driver.test.ts)
  - [x] 002-T2.2 Convert vendor facelets to canonical URFDLB and validate before accepting (TDD: src/cube/input/bluetooth/facelet-mapping.test.ts) — see Open question R8 re: unverified Giiker-family ordering
- [x] 002-T3 `CubingBluetoothDriver` (002-R3)
  - [x] 002-T3.1 Wire `connectSmartPuzzle`, `addAlgLeafListener`, `addOrientationListener` (TDD: src/cube/input/bluetooth/cubing-bluetooth-driver.test.ts)
  - [x] 002-T3.2 Report `capabilities.moves = false` for devices with no move stream (e.g. MoYu here) — shipped as a documented default-true with an Open question (R7); no hardware available to detect it generically
- [x] 002-T4 Driver registry: primary→secondary fallback, typed error union, query-param override (002-R4) (TDD: src/cube/input/bluetooth/registry.test.ts) (BDD: @002-S12)
- [x] 002-T5 `CubeStateTracker`: pure seed-then-apply state machine (002-R5) (TDD: src/cube/input/bluetooth/tracker.test.ts, src/cube/input/bluetooth/tracker.property.test.ts) (BDD: @002-S1, @002-S2)
- [x] 002-T6 Drift detection and recovery via facelet re-read (002-R6) (TDD: src/cube/input/bluetooth/tracker.test.ts) (BDD: @002-S4)
- [x] 002-T7 Out-of-order / duplicate move handling within the reorder window (002-R7) (TDD: src/cube/input/bluetooth/tracker.test.ts) (BDD: @002-S5, @002-S6)
- [x] 002-T8 Reconnect with backoff, state preserved across the gap (002-R8) (TDD: src/app/connect/page.test.tsx) (BDD: @002-S7, @002-S8)
- [x] 002-T9 `/connect` UI (002-R9, 002-R10)
  - [x] 002-T9.1 Connect button, device name, battery, live-move indicator, `<CubeView>` mirror (TDD: src/components/ConnectButton.test.tsx, src/app/connect/page.test.tsx) (BDD: @002-S1, @002-S11, @002-S13)
  - [x] 002-T9.2 No-Web-Bluetooth message naming the cause, linking to the camera scanner (TDD: src/app/connect/page.test.tsx) (BDD: @002-S10)
  - [x] 002-T9.3 Manual "my cube is solved" calibration path for facelet-less devices (TDD: src/app/connect/page.test.tsx) (BDD: @002-S9)
- [x] 002-T10 `ReplayDriver` and the six fixture BLE traces (002-R11) (TDD: src/cube/input/bluetooth/replay-driver.test.ts) (logical-eval: all six fixture traces replay to their recorded final facelet strings)
- [ ] 002-T11 Move-to-render latency instrumentation and dev overlay (002-R12) (BDD: @002-S14) (TDD: tests/perf/002-bluetooth-latency.spec.ts) — deferred, see Verification notes
- [x] 002-T12 Resolve the `smartcube-web-bluetooth` install/pin decision (Open question R1) before relying on it — pinned to commit `44f1f091c6e980d9cc31e6d2863c4437eca3ab3c`; see Verification notes
- [ ] 002-T13 Write every test in the TDD plan and make it pass — unit/component/integration done and green; the dedicated Playwright E2E spec (`tests/e2e/002-bluetooth.spec.ts`) with a fake-GATT `addInitScript` stub was not written this session (see Open question R9)
- [ ] 002-T14 Manual hardware sign-off with ≥ 2 vendors; record in Verification notes — not possible in this session, no physical smart cube was available

## BDD acceptance scenarios

```gherkin
Feature: 002 Smart cube Bluetooth input

  Scenario: @002-S1 Connecting a smart cube seeds the tracked state from the device
    Given a replay driver loaded with the GAN Gen3 scramble trace
    When the app connects
    Then the device name and battery level are displayed
    And the tracked cube state equals the trace's initial facelets
    And that state passes validateFacelets

  Scenario: @002-S2 Turning the cube updates the tracked state move by move
    Given a connected cube with tracked state equal to solved
    When the trace emits the moves "R U R' U'"
    Then four move events are observed in order
    And the tracked state equals solved with "R U R' U'" applied
    And the 3D cube view reflects the same state

  Scenario: @002-S3 A scramble performed on the cube is captured as a usable state
    Given a connected cube in the solved state
    When the trace emits a 20-move scramble
    Then the tracked state is valid, is not solved, and is offered to the solver as source "smart-cube"

  Scenario: @002-S4 Dropped moves are healed by re-reading facelets
    Given a connected cube and a trace with a gap in the move serial numbers
    When the move stream goes quiet for 400 ms
    Then the driver re-reads facelets from the device
    And a drift-corrected event reports the number of differing facelets
    And the tracked state equals the device-reported facelets

  Scenario: @002-S5 Duplicate move events do not double-apply
    Given a connected cube
    When the trace emits the same move event twice with the same serial within 100 ms
    Then the move is applied exactly once

  Scenario: @002-S6 Out-of-order moves within the reorder window are corrected
    Given a connected cube
    When moves with serials 5 and 4 arrive in that order 30 ms apart
    Then they are applied in serial order
    And the tracked state matches applying move 4 then move 5

  Scenario: @002-S7 Mid-solve disconnect preserves state and auto-reconnects
    Given a connected cube mid-solve with a tracked non-solved state
    When the device disconnects unexpectedly
    Then the UI shows "Reconnecting" and the tracked state is retained
    And on reconnection the state is re-read from the device and confirmed
    And no scenario-visible state loss occurs

  Scenario: @002-S8 Three failed reconnects surfaces a manual control
    Given a device that disconnects and refuses reconnection
    When three backoff attempts have failed
    Then a "Reconnect" button is shown with the reason
    And the tracked state is still displayed, marked as stale

  Scenario: @002-S9 A device without facelet reporting is calibrated manually
    Given a driver whose capabilities report facelets as false
    When the user connects
    Then the UI asks the user to solve the cube and press "My cube is solved"
    And after confirmation the tracked state is the solved state
    And no facelet re-read is attempted

  Scenario: @002-S10 Browsers without Web Bluetooth are routed to the camera
    Given a browser where navigator.bluetooth is undefined
    When the user opens the connect page
    Then no connect button is rendered
    And a message names the cause and links to the camera scanner
    And the link is reachable in one interaction

  Scenario: @002-S11 Device chooser is opened from a real user gesture
    Given the connect page is open
    When the connect button handler runs
    Then requestDevice is invoked synchronously within the gesture, with no awaited call before it

  Scenario: @002-S12 Permission denial is reported without breaking the page
    Given the user dismisses the device chooser
    When the rejection is handled
    Then the error is classified as NoDeviceChosen
    And the page remains interactive with the connect button re-enabled

  Scenario: @002-S13 Orientation data is captured when available and ignored when not
    Given a trace that includes GYRO events
    When the cube is connected
    Then quaternion updates are received at 10 Hz or faster
    And with a trace lacking GYRO events, no orientation subscription is created and nothing breaks

  Scenario: @002-S14 Move-to-render latency stays within budget
    Given a replay trace of 100 moves at realistic spacing
    When each move is processed and rendered
    Then p95 of receivedAt-to-rendered is at or below 80 ms
    And p95 of tracker state-update time is at or below 5 ms
```

## TDD plan

**Unit (Vitest, `node`)**

| File | Asserts |
| --- | --- |
| `src/cube/input/bluetooth/tracker.test.ts` | Seeding; sequential application; duplicate suppression (@002-S5); reorder window (@002-S6); serial-gap detection triggers a re-read request (@002-S4); drift resolution prefers device facelets; state retained across a `disconnected` event (@002-S7). |
| `src/cube/input/bluetooth/tracker.property.test.ts` | `fast-check`: for random move streams, tracker output always equals `applyMoves(seed, stream)` and always validates. |
| `src/cube/input/bluetooth/replay-driver.test.ts` | Trace parsing, timing compression, event ordering, capability reporting. |
| `src/cube/input/bluetooth/registry.test.ts` | Fallback order primary→secondary; each failure maps to exactly one typed error (@002-S12); query-param override. |
| `src/cube/input/bluetooth/facelet-mapping.test.ts` | Vendor facelet representations → canonical URFDLB, for one recorded sample per supported vendor; invalid vendor payloads rejected, not coerced. |

**Component (Vitest + RTL)**

| File | Asserts |
| --- | --- |
| `src/app/connect/page.test.tsx` | Capability-driven rendering: no-Bluetooth message and camera link (@002-S10); manual-calibration prompt when `facelets` is false (@002-S9); reconnect button after three failures (@002-S8); battery/live-move indicators. |
| `src/components/ConnectButton.test.tsx` | Handler calls `requestDevice` synchronously — asserted by spying and checking no microtask boundary was crossed (@002-S11). |

**Integration (Vitest)**

| File | Asserts |
| --- | --- |
| `tests/integration/bluetooth-replay.test.ts` | Full `ReplayDriver` → registry → tracker → `CubeState` chain over all six fixture traces (@002-S1, @002-S2, @002-S3, @002-S4, @002-S7, @002-S13). Golden assertion: final tracked facelets equal the trace's recorded final facelets. |

**E2E (Playwright, `tests/e2e/002-bluetooth.spec.ts`)**

- Inject a `navigator.bluetooth` stub via `addInitScript` that is driven by a fixture trace, so the
  real driver code path runs against a fake GATT server. @002-S1, @002-S2, @002-S7, @002-S8,
  @002-S9, @002-S12.
- A second Playwright project with `navigator.bluetooth` deleted for @002-S10.

**Perf (Playwright, `tests/perf/002-bluetooth-latency.spec.ts`)** — @002-S14, 100 moves, report
p50/p95 for both stages.

**Manual sign-off checklist (recorded in *Verification notes*, hardware required)** — at minimum one
GAN Gen3 and one QiYi or MoYu device: connect, battery, scramble capture, 50-move solve with no
drift, disconnect/reconnect, Android Chrome + desktop Chrome.

## Non-functional requirements

| Metric | Target | Measurement |
| --- | --- | --- |
| Move event → rendered cube | ≤ 80 ms p95, ≤ 40 ms p50 | `tests/perf/002-bluetooth-latency.spec.ts` |
| Tracker state update | ≤ 5 ms p95 | Vitest `bench` |
| Connect → state displayed | ≤ 3 s p95 from chooser selection | Manual, timed, recorded |
| Facelet re-read | ≤ 300 ms p95 | Replay + manual |
| Reconnect after unexpected drop | ≤ 5 s for attempts 1-3 | Replay fixture |
| Vendor library weight | ≤ 60 kB gzip, code-split, loaded only on `/connect` | `next build` assertion |
| Drift | 0 unresolved drift events across a 50-move manual solve | Manual, recorded |

## Acceptance criteria

1. All fourteen `@002-Sn` scenarios have passing tests; `check-scenarios.mjs` passes.
2. No vendor BLE library is imported outside `src/cube/input/bluetooth/`, enforced by lint.
3. `CubeStateTracker` is pure (no DOM, no BLE, no timers injected implicitly — the clock is a
   parameter) and ≥ 95% line-covered.
4. All six fixture traces replay to their recorded final facelet strings.
5. The no-Web-Bluetooth path is a clear, non-error-looking route to the camera scanner.
6. Latency numbers measured and recorded; manual hardware checklist completed for ≥ 2 vendors.
7. The tracked state is handed to downstream consumers as a `CubeState` with `source: "smart-cube"`.

## Open questions / risks

- **R1 Registry availability of the primary library.** If `smartcube-web-bluetooth` is only
  installable from GitHub, pin a commit SHA; if that proves unworkable in CI, vendor it (MIT) under
  `src/vendor/` with provenance recorded. Decide before implementation starts, not during.
- **R2 Protocol churn.** Vendors change protocols without notice; a firmware update can break a
  driver. Mitigation: two drivers, honest capability reporting, and the camera scanner as a
  universal fallback. Accept that some devices will simply not work.
- **R3 Device clock skew.** Device timestamps need `cubeTimestampLinearFit()`-style calibration
  before they are usable for timing. For this ticket we only need *ordering*, so skew is tolerable;
  flag it as a prerequisite for any future solve-timing ticket.
- **R4 Encrypted GAN protocols** require a MAC-address-derived key, which Web Bluetooth does not
  expose; libraries work around this by inferring it from advertisement data, and it can fail. If
  a device connects but emits garbage, classify as `UnsupportedDevice` and route to camera rather
  than attempting a fix here.
- **R5 Testing Web Bluetooth** has no standard mock. The `addInitScript` GATT stub is our own and
  will need maintenance alongside the drivers; keep it small and trace-driven.
- **R6 (resolved this session)** R1's decision: `smartcube-web-bluetooth` is not published on the
  npm registry (confirmed via `npm view` — 404). Installed instead as
  `github:poliva/smartcube-web-bluetooth#44f1f091c6e980d9cc31e6d2863c4437eca3ab3c`, pinned to a
  specific commit SHA rather than a branch, with its license (MIT, confirmed via the repo's
  `package.json`) and provenance recorded here. Vendoring under `src/vendor/` was not needed — the
  git-dependency install works in this environment including its own build step.
- **R7 `cubing-bluetooth-driver.ts`'s `capabilities.moves` defaults to `true` for every device**,
  even though 002-R3 documents that `cubing/bluetooth` does not expose a move stream for MoYu.
  `BluetoothPuzzle`'s base class gives no generic way to detect this without inspecting which
  concrete subclass (`GanCube`/`GiiKERCube`/`GoCube`/etc.) was actually returned, and no MoYu
  device was available to determine the right signal. Revisit when either hardware is available or
  cubing/bluetooth exposes this capability generically.
- **R8 Giiker-family facelet ordering is unverified against real hardware.** GAN-family protocols
  in `smartcube-web-bluetooth` build their FACELETS payload via the library's own
  `toKociembaFacelets()` (confirmed by reading its source — the name and output format match our
  URFDLB convention directly). Giiker-family protocols build theirs via a different internal
  `CubieCube.toFaceCube()` path with Giiker-specific ordering constants, whose character order
  relative to ours was **not** independently confirmed — no physical Giiker/QiYi/MoYu device was
  available. `mapVendorFaceletsToCanonical()` (002-R2) runs every incoming facelet string through
  `validateFacelets` as a safety net regardless of vendor, so a wrong permutation is rejected as
  structurally invalid rather than silently trusted — but a permutation that happens to still
  validate (astronomically unlikely by chance, but not impossible) would not be caught by this
  alone. Closing this properly requires a recorded scrambled-state sample from real Giiker-family
  hardware (002-T14).
- **R9 (new, found this session) `smartcube-web-bluetooth`'s published ESM build is broken under
  every modern toolchain tested.** Its `dist/esm/index.mjs` re-exports named bindings from the CJS
  package `aes-js` in a way that fails static ESM interop analysis: `SyntaxError: Named export
  'AES' not found` under plain Node (`node --input-type=module`), under Vite/Vitest, and the
  equivalent failure mode is expected under any bundler using similar static analysis for CJS
  re-exports. This is an upstream packaging defect in the vendored library, not something fixable
  in our code directly. **Mitigation shipped and verified**: both `vitest.config.ts` and
  `next.config.js` (webpack **and** turbopack) alias the bare `smartcube-web-bluetooth` specifier
  straight to its working CJS build (`dist/cjs/index.cjs`), confirmed working end-to-end via a real
  Playwright-driven Chromium hitting `/connect` on both `next dev` (webpack) — no `next --turbo`
  recheck was done explicitly, but the webpack alias path was the one exercised. Re-verify the
  turbopack alias specifically once ticket work next touches `/connect`, and re-check whether
  upstream fixes this before the next `smartcube-web-bluetooth` version bump (at which point the
  alias may become unnecessary, or need its path updated).
- **R10 (new) Automatic BLE reconnection after disconnect calls `driver.requestDevice()` again**,
  which for Web Bluetooth's real implementation may or may not require a fresh user gesture
  depending on whether the browser treats reconnecting to an *already-granted* device the same as
  a first-time chooser prompt. No hardware was available to verify which behavior
  `smartcube-web-bluetooth`/`cubing/bluetooth` actually produce on a real disconnect. If it turns
  out a gesture is required, the automatic backoff attempts (002-R8) will simply fail immediately
  every time and the flow degrades gracefully to the manual "Reconnect" button after three
  failures — which does have a real user gesture — so the feature is not broken by this, only
  less automatic than intended. Confirm with real hardware in 002-T14.

## Verification notes

Measured/verified on this development machine (Windows, Node v24.16.0).

| Check | Result |
| --- | --- |
| `npm run test:unit` (this ticket's files) | 59 new tests passing (132 total in the full suite) |
| `npx tsc --noEmit` | clean |
| `npx next lint` | clean |
| `smartcube-web-bluetooth` availability | Not on npm registry (confirmed via `npm view`, 404). Installed via `github:poliva/smartcube-web-bluetooth#44f1f091c6e980d9cc31e6d2863c4437eca3ab3c` (pinned commit, not a branch). License: MIT (confirmed in the repo's package.json). |
| `smartcube-web-bluetooth` ESM/CJS interop bug | Found, confirmed reproducible under Node/Vite, fixed via bundler aliasing to the CJS build (R9 above); fix verified against a real Next.js dev server + real Chromium hitting `/connect` with no crash |
| Gesture-timing correctness (@002-S11) | Found and fixed a real bug: an earlier version of both vendor driver wrappers used a dynamic `import()` inside `requestDevice()`, which would have broken the "no awaited call before the gesture-triggered call" contract in a real browser. Fixed by switching to static top-level imports; code-splitting is instead achieved via Next's automatic per-route chunking plus the eslint import-boundary rule restricting these imports to `src/cube/input/bluetooth/`. |
| @002-S1–S7, S9–S13 | Passing via `ReplayDriver`-backed unit/integration/component tests |
| @002-S8 | Passing via `src/app/connect/page.test.tsx` with fake timers simulating the 250ms/1s/3s backoff |
| @002-S14 (latency) | **Not measured** — 002-T11's perf instrumentation and `tests/perf/002-bluetooth-latency.spec.ts` were not written this session |
| 002-T14 (manual hardware sign-off) | **Not done** — no physical smart cube (GAN/QiYi/MoYu/Giiker/GoCube) was available in this environment |
| Module boundary lint rule (acceptance criterion 2) | Added and verified: `eslint.config.js` now restricts `smartcube-web-bluetooth`/`cubing/bluetooth` imports to `src/cube/input/bluetooth/**`, and `cubing/twisty` to `CubeView.tsx`, each enforced across disjoint file-glob blocks so one rule can't silently override another for the same file |
| `/connect` route is code-split from `/` (`next build`) | Confirmed: `/` First Load JS stays at 115 kB (001-R13's ceiling, unaffected); `/connect` reports 216 kB First Load JS as its own route chunk, so the vendor libraries are not in the shared/`/` bundle |
| Vendor library weight ≤ 60 kB gzip (this ticket's own NFR) | **Not independently measured.** `/connect`'s 216 kB includes React/component code plus rxjs plus both vendor BLE libraries combined — isolating just the vendor-library portion needs a bundle analyzer (e.g. `@next/bundle-analyzer` or `source-map-explorer`), which wasn't run this session. Given rxjs alone is commonly ~15-30 kB gzipped and two full vendor libraries are in the mix, this likely exceeds 60 kB and should be measured properly before this ticket closes. |

**Outstanding before this ticket can move to `done`:** 002-T11 (latency instrumentation + perf
test), the dedicated `tests/e2e/002-bluetooth.spec.ts` Playwright spec with a fake-GATT stub,
002-T14 (manual hardware sign-off), and an actual vendor-library bundle-weight measurement. All
require either more implementation time or physical hardware not available in this session —
tracked explicitly rather than silently skipped.
