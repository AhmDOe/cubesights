import { describe, expect, it, vi } from "vitest";
import { applyMoves } from "~/cube/core/apply";
import { createCubeState } from "~/cube/core/cube-state";
import { SOLVED_FACELETS, type FaceletString } from "~/cube/core/facelets";
import { parseAlg } from "~/cube/core/notation";
import { SearchEngine } from "~/cube/solve/engines/search-engine";
import { ONE_FLIPPED_EDGE, SUPERFLIP } from "../../../../tests/fixtures/states";
import { getPlanner } from "./index";

async function scramble(alg: string): Promise<FaceletString> {
  const result = await applyMoves(createCubeState(SOLVED_FACELETS, "manual"), parseAlg(alg));
  return result.facelets;
}

const SCRAMBLES = ["R U2 F' L2 D B' R2", "U R' D2 L B2", "F2 R U' L D' R2 B", "L U R' F2 D L'"];

describe("KociembaPlanner", () => {
  it("@004-S1 solves a scrambled state with a verified plan, htm within budget", async () => {
    const planner = getPlanner("kociemba");
    for (const alg of SCRAMBLES) {
      const scrambled = await scramble(alg);
      const plan = await planner.plan(createCubeState(scrambled, "manual"));
      expect(plan.verified).toBe(true);
      expect(plan.stages.length).toBeGreaterThanOrEqual(1);
      expect(plan.moveCount.htm).toBeLessThanOrEqual(22);
    }
  }, 30000);

  it("@004-S1 also solves SUPERFLIP within budget", async () => {
    const planner = getPlanner("kociemba");
    const plan = await planner.plan(createCubeState(SUPERFLIP, "manual"));
    expect(plan.verified).toBe(true);
    expect(plan.moveCount.htm).toBeLessThanOrEqual(22);
  }, 20000);

  it("@004-S2 the solved cube yields a verified zero-move plan with an already-solved note", async () => {
    const planner = getPlanner("kociemba");
    const plan = await planner.plan(createCubeState(SOLVED_FACELETS, "manual"));
    expect(plan.verified).toBe(true);
    expect(plan.moveCount).toEqual({ htm: 0, qtm: 0, stm: 0, etm: 0 });
    expect(plan.stages[0]!.notes).toContain("Already solved");
  }, 20000);

  it("@004-S5 an invalid state is refused before any search begins", async () => {
    const solveSpy = vi.spyOn(SearchEngine.prototype, "solve");
    const planner = getPlanner("kociemba");
    const invalidState = createCubeState(ONE_FLIPPED_EDGE, "manual");
    await expect(planner.plan(invalidState)).rejects.toThrow(/invalid cube state/i);
    expect(solveSpy).not.toHaveBeenCalled();
    solveSpy.mockRestore();
  });
});
