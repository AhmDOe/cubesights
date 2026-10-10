import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { CubeStateTracker } from "./tracker";
import { SOLVED_FACELETS } from "~/cube/core/facelets";
import { parseAlg } from "~/cube/core/notation";
import type { MoveEvent } from "./driver";

function moveEvent(move: string, serial?: number): MoveEvent {
  return { move: move as never, deviceTimestamp: Date.now(), receivedAt: Date.now(), serial };
}

describe("CubeStateTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("seeds the tracked state", () => {
    const tracker = new CubeStateTracker({ requestFaceletRead: vi.fn() });
    tracker.seed(SOLVED_FACELETS, "smart-cube");
    expect(tracker.getState()?.facelets).toBe(SOLVED_FACELETS);
    expect(tracker.getState()?.source).toBe("smart-cube");
  });

  it("applies moves sequentially without a serial, trusting arrival order", async () => {
    const tracker = new CubeStateTracker({ requestFaceletRead: vi.fn() });
    tracker.seed(SOLVED_FACELETS);
    await tracker.handleMove(moveEvent("R"));
    await tracker.handleMove(moveEvent("U"));
    await tracker.handleMove(moveEvent("R'"));
    await tracker.handleMove(moveEvent("U'"));
    // Sanity: this is a non-trivial, non-identity sequence.
    expect(tracker.getState()?.facelets).not.toBe(SOLVED_FACELETS);
  });

  it("@002-S5 a duplicate move event (same serial) is applied exactly once", async () => {
    const tracker = new CubeStateTracker({ requestFaceletRead: vi.fn() });
    tracker.seed(SOLVED_FACELETS);
    await tracker.handleMove(moveEvent("R", 1));
    const afterFirst = tracker.getState()!.facelets;
    await tracker.handleMove(moveEvent("R", 1)); // duplicate
    expect(tracker.getState()!.facelets).toBe(afterFirst);
  });

  it("@002-S6 out-of-order moves within the reorder window are corrected", async () => {
    const tracker = new CubeStateTracker({ requestFaceletRead: vi.fn() });
    tracker.seed(SOLVED_FACELETS);
    await tracker.handleMove(moveEvent("U", 4)); // establishes baseline at 4
    await tracker.handleMove(moveEvent("R'", 6)); // arrives early — buffered
    await tracker.handleMove(moveEvent("U'", 5)); // fills the gap — both apply in order

    const expected = await applyExpected(["U", "U'", "R'"]);
    expect(tracker.getState()!.facelets).toBe(expected);
  });

  it("@002-S4 a serial gap triggers a facelet re-read after the stream goes quiet", async () => {
    const deviceFacelets = await applyExpected(["R", "U"]);
    const requestFaceletRead = vi.fn().mockResolvedValue(deviceFacelets);
    const tracker = new CubeStateTracker({ requestFaceletRead, idleReReadMs: 400 });
    tracker.seed(SOLVED_FACELETS);

    const driftSpy = vi.fn();
    tracker.onDrift(driftSpy);

    await tracker.handleMove(moveEvent("R", 1));
    // Serial 2 never arrives (dropped). Nothing else happens until the idle timer fires.
    expect(requestFaceletRead).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(400);

    expect(requestFaceletRead).toHaveBeenCalledTimes(1);
    expect(tracker.getState()!.facelets).toBe(deviceFacelets);
    expect(driftSpy).toHaveBeenCalledTimes(1);
    const [driftEvent] = driftSpy.mock.calls[0] as [{ differingFaceletCount: number }];
    expect(driftEvent.differingFaceletCount).toBeGreaterThan(0);
  });

  it("drift resolution prefers the device's facelets over the replayed stream", async () => {
    const garbledButValid = await applyExpected(["F", "F"]); // different from tracker's own state
    const requestFaceletRead = vi.fn().mockResolvedValue(garbledButValid);
    const tracker = new CubeStateTracker({ requestFaceletRead, idleReReadMs: 50 });
    tracker.seed(SOLVED_FACELETS);
    await tracker.handleMove(moveEvent("R"));

    await vi.advanceTimersByTimeAsync(50);

    expect(tracker.getState()!.facelets).toBe(garbledButValid);
  });

  it("@002-S7 state is retained across a disconnected event and marked stale", async () => {
    const tracker = new CubeStateTracker({ requestFaceletRead: vi.fn() });
    tracker.seed(SOLVED_FACELETS);
    await tracker.handleMove(moveEvent("R"));
    const beforeDisconnect = tracker.getState();

    tracker.handleDisconnected();

    expect(tracker.getState()).toBe(beforeDisconnect);
    expect(tracker.isStale()).toBe(true);
  });

  it("reconnecting re-reads and reconciles, clearing the stale flag", async () => {
    const deviceFacelets = await applyExpected(["R"]);
    const requestFaceletRead = vi.fn().mockResolvedValue(deviceFacelets);
    const tracker = new CubeStateTracker({ requestFaceletRead });
    tracker.seed(SOLVED_FACELETS);
    tracker.handleDisconnected();

    await tracker.handleReconnected();

    expect(tracker.isStale()).toBe(false);
    expect(requestFaceletRead).toHaveBeenCalled();
  });

  it("notifies state-change listeners on every applied move", async () => {
    const tracker = new CubeStateTracker({ requestFaceletRead: vi.fn() });
    const seen: string[] = [];
    tracker.onStateChange((s) => seen.push(s.facelets));
    tracker.seed(SOLVED_FACELETS);
    await tracker.handleMove(moveEvent("R"));
    await tracker.handleMove(moveEvent("U"));
    expect(seen).toHaveLength(3); // seed + 2 moves
  });

  it("throws if a move arrives before seed()", async () => {
    const tracker = new CubeStateTracker({ requestFaceletRead: vi.fn() });
    await expect(tracker.handleMove(moveEvent("R"))).rejects.toThrow(/before seed/);
  });
});

async function applyExpected(moves: string[]): Promise<string> {
  const { applyMoves } = await import("~/cube/core/apply");
  const { createCubeState } = await import("~/cube/core/cube-state");
  const state = createCubeState(SOLVED_FACELETS, "scramble");
  const result = await applyMoves(state, parseAlg(moves.join(" ")));
  return result.facelets;
}
