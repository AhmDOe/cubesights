import { describe, expect, it } from "vitest";
import { createCubeState } from "~/cube/core/cube-state";
import { SOLVED_FACELETS } from "~/cube/core/facelets";
import type { MethodId } from "~/cube/model/solution";
import { getPlanner, listPlanners, NotImplementedError } from "./index";

const ALL_METHOD_IDS: readonly MethodId[] = ["kociemba", "cfop", "roux", "zz", "zb", "oh", "bld"];
const STUB_TICKETS: Record<string, number> = { cfop: 6, roux: 7, zz: 8, zb: 9, oh: 10, bld: 11 };

describe("method registry (@004-S7)", () => {
  it("has an entry for every one of the seven method ids", () => {
    const planners = listPlanners();
    expect(planners.map((p) => p.id).sort()).toEqual([...ALL_METHOD_IDS].sort());
  });

  it("only bld declares memo support", () => {
    for (const id of ALL_METHOD_IDS) {
      const planner = getPlanner(id);
      expect(planner.capabilities.memo).toBe(id === "bld");
    }
  });

  it("kociemba is the only non-structured method (a flat single-stage result)", () => {
    expect(getPlanner("kociemba").capabilities.structured).toBe(false);
    for (const id of ALL_METHOD_IDS.filter((m) => m !== "kociemba")) {
      expect(getPlanner(id).capabilities.structured).toBe(true);
    }
  });

  it.each(Object.entries(STUB_TICKETS))("%s throws NotImplementedError naming ticket %i", async (id, ticket) => {
    const planner = getPlanner(id as MethodId);
    const state = createCubeState(SOLVED_FACELETS, "manual");
    await expect(planner.plan(state)).rejects.toThrow(NotImplementedError);
    try {
      await planner.plan(state);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(NotImplementedError);
      if (e instanceof NotImplementedError) {
        expect(e.ticketNumber).toBe(ticket);
        expect(e.methodId).toBe(id);
      }
    }
  });

  it("getPlanner throws a plain error for an unregistered id", () => {
    // @ts-expect-error -- deliberately an invalid MethodId to exercise the guard.
    expect(() => getPlanner("not-a-real-method")).toThrow(/No planner registered/);
  });
});
