import { describe, expect, it, vi } from "vitest";
import { applyMoves } from "~/cube/core/apply";
import { createCubeState } from "~/cube/core/cube-state";
import { SOLVED_FACELETS, type FaceletString } from "~/cube/core/facelets";
import { parseAlg } from "~/cube/core/notation";
import { AbortedError } from "./engine";
import { SearchEngine } from "./search-engine";
import { SUPERFLIP } from "../../../../tests/fixtures/states";
import type * as KpuzzleAdapterModule from "~/cube/core/adapters/kpuzzle";

async function scramble(alg: string): Promise<FaceletString> {
  const result = await applyMoves(createCubeState(SOLVED_FACELETS, "manual"), parseAlg(alg));
  return result.facelets;
}

describe("SearchEngine", () => {
  it("init() passes the facelet-order assertion under normal conditions", async () => {
    const engine = new SearchEngine();
    await expect(engine.init()).resolves.toBeUndefined();
  });

  it("init() throws if the kpuzzle adapter round-trip disagrees with the solved facelets", async () => {
    vi.resetModules();
    vi.doMock("~/cube/core/adapters/kpuzzle", async () => {
      const actual = await vi.importActual<typeof KpuzzleAdapterModule>("~/cube/core/adapters/kpuzzle");
      return { ...actual, fromKPattern: async () => "not-the-solved-facelets" as FaceletString };
    });
    const { SearchEngine: BrokenSearchEngine } = await import("./search-engine");
    const engine = new BrokenSearchEngine();
    await expect(engine.init()).rejects.toThrow(/facelet-order assertion failed/);
    vi.doUnmock("~/cube/core/adapters/kpuzzle");
    vi.resetModules();
  });

  it("@004-S2 solving the solved cube returns zero moves", async () => {
    const engine = new SearchEngine();
    const moves = await engine.solve(SOLVED_FACELETS);
    expect(moves).toEqual([]);
  }, 20000);

  it("@004-S1 solves a scrambled state, verified by replaying the moves", async () => {
    const engine = new SearchEngine();
    const scrambled = await scramble("R U2 F' L2 D B' R2");
    const moves = await engine.solve(scrambled);
    const result = await applyMoves(createCubeState(scrambled, "manual"), moves);
    expect(result.facelets).toBe(SOLVED_FACELETS);
  }, 20000);

  it("solves SUPERFLIP too", async () => {
    const engine = new SearchEngine();
    const moves = await engine.solve(SUPERFLIP);
    const result = await applyMoves(createCubeState(SUPERFLIP, "manual"), moves);
    expect(result.facelets).toBe(SOLVED_FACELETS);
  }, 20000);

  it("rejects with SolveTimeoutError when the timeout elapses first", async () => {
    // Mocked rather than relying on real search timing: once warm, a real solve can resolve in
    // well under a millisecond, which would make a short-timeout test flaky against real timing.
    vi.resetModules();
    vi.doMock("cubing/search", () => ({ experimentalSolve3x3x3IgnoringCenters: () => new Promise(() => undefined) }));
    const { SearchEngine: SlowSearchEngine } = await import("./search-engine");
    const engine = new SlowSearchEngine();
    await expect(engine.solve(SOLVED_FACELETS, { timeoutMs: 5 })).rejects.toThrow(/timed out/i);
    vi.doUnmock("cubing/search");
    vi.resetModules();
  });

  it("@004-S6 an aborted solve rejects immediately, and a later solve for a new state still succeeds", async () => {
    const engine = new SearchEngine();
    const stateA = await scramble("R U2 F' L2 D B' R2");
    const stateB = await scramble("U R' D2 L B2");

    const controller = new AbortController();
    const firstSolve = engine.solve(stateA, { signal: controller.signal });
    controller.abort();
    await expect(firstSolve).rejects.toThrow(AbortedError);

    const secondSolve = await engine.solve(stateB);
    const result = await applyMoves(createCubeState(stateB, "manual"), secondSolve);
    expect(result.facelets).toBe(SOLVED_FACELETS);
  }, 20000);

  it("throws immediately if the signal is already aborted before solve() is called", async () => {
    const engine = new SearchEngine();
    const controller = new AbortController();
    controller.abort();
    await expect(engine.solve(SOLVED_FACELETS, { signal: controller.signal })).rejects.toThrow(AbortedError);
  });
});
