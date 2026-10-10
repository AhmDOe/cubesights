import type { StickerColor } from "~/cube/core/colors";
import type { FaceReading, StickerReading } from "./classify";

/**
 * Temporal stability gate (003-R6): a face auto-commits once its 9 stickers have reported the
 * same label, with none `uncertain`, for 5 consecutive frames — no shutter press needed. The ring
 * buffer keeps the last 8 frames so the caller can inspect recent history (e.g. for a "hold
 * steady" UI hint), but the stability decision itself only ever needs to look back as far as the
 * most recent run of agreeing frames, which is at most 8 and at least the 5 that trigger commit.
 */

export const RING_BUFFER_SIZE = 8;
export const AUTO_COMMIT_FRAMES = 5;

export interface StabilityState {
  readonly history: readonly (readonly StickerReading[])[];
}

export function createStabilityState(): StabilityState {
  return { history: [] };
}

export function pushFrame(state: StabilityState, reading: FaceReading): StabilityState {
  const history = [...state.history, reading.stickers].slice(-RING_BUFFER_SIZE);
  return { history };
}

export interface StabilityResult {
  readonly stable: boolean;
  readonly consecutiveStableFrames: number;
}

function framesAgree(a: readonly StickerReading[], b: readonly StickerReading[]): boolean {
  return a.length === b.length && a.every((sticker, i) => sticker.color === b[i]!.color);
}

export function evaluateStability(state: StabilityState): StabilityResult {
  const { history } = state;
  if (history.length === 0) return { stable: false, consecutiveStableFrames: 0 };

  const latest = history[history.length - 1]!;
  if (latest.some((s) => s.uncertain)) return { stable: false, consecutiveStableFrames: 0 };

  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const frame = history[i]!;
    if (frame.some((s) => s.uncertain) || !framesAgree(frame, latest)) break;
    count++;
  }

  return { stable: count >= AUTO_COMMIT_FRAMES, consecutiveStableFrames: count };
}

/** The 9 committed colours once stable, or null otherwise — ready to feed into assemble.ts. */
export function committedColors(state: StabilityState): readonly StickerColor[] | null {
  const result = evaluateStability(state);
  if (!result.stable) return null;
  return state.history[state.history.length - 1]!.map((s) => s.color);
}
