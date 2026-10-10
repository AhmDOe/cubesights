import { describe, expect, it } from "vitest";
import type { StickerColor } from "~/cube/core/colors";
import type { FaceReading, StickerReading } from "./classify";
import {
  AUTO_COMMIT_FRAMES,
  committedColors,
  createStabilityState,
  evaluateStability,
  pushFrame,
  RING_BUFFER_SIZE,
  type StabilityState,
} from "./stability";

function reading(colors: readonly StickerColor[], uncertainIndices: readonly number[] = []): FaceReading {
  const stickers: StickerReading[] = colors.map((color, i) => ({
    color,
    deltaE: 1,
    margin: uncertainIndices.includes(i) ? 1 : 20,
    uncertain: uncertainIndices.includes(i),
  }));
  return { stickers };
}

const SOLID_GREEN = new Array(9).fill("G") as StickerColor[];
const SOLID_BLUE = new Array(9).fill("B") as StickerColor[];

function pushN(state: StabilityState, face: FaceReading, n: number): StabilityState {
  let s = state;
  for (let i = 0; i < n; i++) s = pushFrame(s, face);
  return s;
}

describe("stability gate (@003-S2, @003-S3)", () => {
  it("is not stable with zero frames pushed", () => {
    expect(evaluateStability(createStabilityState())).toEqual({ stable: false, consecutiveStableFrames: 0 });
  });

  it("is not stable below the auto-commit threshold", () => {
    let state = createStabilityState();
    state = pushN(state, reading(SOLID_GREEN), AUTO_COMMIT_FRAMES - 1);
    const result = evaluateStability(state);
    expect(result.stable).toBe(false);
    expect(result.consecutiveStableFrames).toBe(AUTO_COMMIT_FRAMES - 1);
  });

  it("@003-S2 commits after exactly 5 consecutive agreeing frames", () => {
    let state = createStabilityState();
    state = pushN(state, reading(SOLID_GREEN), AUTO_COMMIT_FRAMES);
    const result = evaluateStability(state);
    expect(result.stable).toBe(true);
    expect(result.consecutiveStableFrames).toBe(AUTO_COMMIT_FRAMES);
    expect(committedColors(state)).toEqual(SOLID_GREEN);
  });

  it("does not commit while any sticker is uncertain, even if labels agree", () => {
    let state = createStabilityState();
    state = pushN(state, reading(SOLID_GREEN, [4]), AUTO_COMMIT_FRAMES + 2);
    const result = evaluateStability(state);
    expect(result.stable).toBe(false);
    expect(committedColors(state)).toBeNull();
  });

  it("@003-S3 resets the run on a single disagreeing frame", () => {
    let state = createStabilityState();
    state = pushN(state, reading(SOLID_GREEN), AUTO_COMMIT_FRAMES - 1);
    state = pushFrame(state, reading(SOLID_BLUE)); // one disagreeing frame
    state = pushN(state, reading(SOLID_GREEN), AUTO_COMMIT_FRAMES - 1); // not enough to recover yet
    const result = evaluateStability(state);
    expect(result.stable).toBe(false);
    expect(result.consecutiveStableFrames).toBe(AUTO_COMMIT_FRAMES - 1);
  });

  it("@003-S3 flickering between two labels for ten frames never commits", () => {
    let state = createStabilityState();
    for (let i = 0; i < 10; i++) {
      state = pushFrame(state, reading(i % 2 === 0 ? SOLID_GREEN : SOLID_BLUE));
    }
    expect(evaluateStability(state).stable).toBe(false);
  });

  it("the ring buffer never retains more than RING_BUFFER_SIZE frames", () => {
    let state = createStabilityState();
    state = pushN(state, reading(SOLID_GREEN), RING_BUFFER_SIZE + 10);
    expect(state.history.length).toBe(RING_BUFFER_SIZE);
  });

  it("recovers and commits once a new steady run reaches the threshold after a disagreement", () => {
    let state = createStabilityState();
    state = pushN(state, reading(SOLID_GREEN), 3);
    state = pushFrame(state, reading(SOLID_BLUE));
    state = pushN(state, reading(SOLID_BLUE), AUTO_COMMIT_FRAMES - 1);
    const result = evaluateStability(state);
    expect(result.stable).toBe(true);
    expect(committedColors(state)).toEqual(SOLID_BLUE);
  });
});
