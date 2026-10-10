import { applyMoves } from "~/cube/core/apply";
import { createCubeState } from "~/cube/core/cube-state";
import { SOLVED_FACELETS } from "~/cube/core/facelets";
import { parseAlg } from "~/cube/core/notation";
import type { BleTrace } from "~/cube/input/bluetooth/replay-driver";

const driftTrueFacelets = (
  await applyMoves(createCubeState(SOLVED_FACELETS, "scramble"), parseAlg("R U"))
).facelets;

const FULL_CAPS = { facelets: true, moves: true, gyro: true, battery: true } as const;

function moveEvents(tokens: readonly string[], opts: { startT?: number; gapMs?: number; startSerial?: number } = {}) {
  const startT = opts.startT ?? 0;
  const gapMs = opts.gapMs ?? 50;
  const startSerial = opts.startSerial ?? 0;
  return tokens.map((move, i) => ({
    t: startT + i * gapMs,
    kind: "move" as const,
    payload: { move, serial: startSerial + i },
  }));
}

const SCRAMBLE = ["R", "U2", "F'", "L", "D", "R'", "B", "U", "L2", "F"];
const SOLVE = [...SCRAMBLE].reverse().map(invert);

function invert(token: string): string {
  if (token.endsWith("'")) return token.slice(0, -1);
  if (token.endsWith("2")) return token;
  return `${token}'`;
}

/** GAN Gen3: scramble, then solve. Final state is solved. */
export const GAN_GEN3_SCRAMBLE_AND_SOLVE: BleTrace = {
  device: "GAN12 ui FreePlay",
  capabilities: FULL_CAPS,
  initialFacelets: SOLVED_FACELETS,
  events: [
    ...moveEvents(SCRAMBLE, { startT: 0, gapMs: 300 }),
    { t: 3500, kind: "battery", payload: 87 },
    ...moveEvents(SOLVE, { startT: 5000, gapMs: 300, startSerial: SCRAMBLE.length }),
  ],
};

/** QiYi: a short solve from an already-scrambled state (no scramble phase recorded). */
export const QIYI_SOLVE: BleTrace = {
  device: "QY-QiYi Smart Cube",
  capabilities: { facelets: true, moves: true, gyro: false, battery: true },
  initialFacelets: SOLVED_FACELETS,
  events: [
    ...moveEvents(["R", "U", "R'", "U'"], { startT: 0, gapMs: 250 }),
    ...moveEvents(["U'", "R", "U", "R'"], { startT: 1200, gapMs: 250, startSerial: 4 }),
  ],
};

/** A mid-solve unexpected disconnect, then a reconnect. */
export const MID_SOLVE_DISCONNECT_RECONNECT: BleTrace = {
  device: "GAN12 ui FreePlay",
  capabilities: FULL_CAPS,
  initialFacelets: SOLVED_FACELETS,
  events: [
    ...moveEvents(["R", "U", "R'"], { startT: 0, gapMs: 200 }),
    { t: 700, kind: "disconnect", payload: null },
    { t: 1500, kind: "reconnect", payload: null },
    ...moveEvents(["U'"], { startT: 1600, gapMs: 200, startSerial: 3 }),
  ],
};

/** A dropped move: serial 1 (the "U" move) never arrives, simulating a lost BLE packet. */
export const DROPPED_MOVE_GAP: BleTrace = {
  device: "GAN12 ui FreePlay",
  capabilities: FULL_CAPS,
  initialFacelets: SOLVED_FACELETS,
  events: [
    { t: 0, kind: "move", payload: { move: "R", serial: 0 } },
    // serial 1 ("U") deliberately omitted.
    { t: 200, kind: "move", payload: { move: "R'", serial: 2 } },
  ],
};

/** The same move event delivered twice with the same serial (a BLE notification duplicate). */
export const DUPLICATE_EVENT_BURST: BleTrace = {
  device: "QY-QiYi Smart Cube",
  capabilities: { facelets: true, moves: true, gyro: false, battery: true },
  initialFacelets: SOLVED_FACELETS,
  events: [
    { t: 0, kind: "move", payload: { move: "R", serial: 0 } },
    { t: 20, kind: "move", payload: { move: "R", serial: 0 } }, // duplicate notification
    { t: 220, kind: "move", payload: { move: "U", serial: 1 } },
  ],
};

/**
 * A drift case: the replayed moves alone would produce one state, but the device's own facelet
 * report (injected via a "facelets" event) disagrees — e.g. a move was double-registered by the
 * cube's sensors without a corresponding BLE notification. The tracker must prefer the device.
 */
export const DRIFT_DISAGREEMENT: BleTrace = {
  device: "GAN12 ui FreePlay",
  capabilities: FULL_CAPS,
  initialFacelets: SOLVED_FACELETS,
  events: [
    { t: 0, kind: "move", payload: { move: "R", serial: 0 } },
    // The device's internal sensors actually registered "R U" (an extra physical turn the BLE
    // layer never notified), so its own facelet report reflects that, not just "R".
    { t: 450, kind: "facelets", payload: driftTrueFacelets },
  ],
};

export const ALL_FIXTURE_TRACES = {
  GAN_GEN3_SCRAMBLE_AND_SOLVE,
  QIYI_SOLVE,
  MID_SOLVE_DISCONNECT_RECONNECT,
  DROPPED_MOVE_GAP,
  DUPLICATE_EVENT_BURST,
  DRIFT_DISAGREEMENT,
} as const;
