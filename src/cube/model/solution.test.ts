import { describe, expect, it } from "vitest";
import { applyMoves } from "~/cube/core/apply";
import { createCubeState } from "~/cube/core/cube-state";
import { SOLVED_FACELETS, type FaceletString } from "~/cube/core/facelets";
import { parseAlg } from "~/cube/core/notation";
import {
  allMoves,
  checkGoldenInvariant,
  checkStageConsistency,
  decodeCubeStateFromURL,
  deserializePlan,
  encodeCubeStateForURL,
  serializePlan,
  type SolutionMove,
  type SolutionPlan,
  type SolutionStage,
} from "./solution";

function moveList(alg: string): SolutionMove[] {
  return parseAlg(alg).map((move, index) => ({ move, index }));
}

async function scramble(alg: string): Promise<FaceletString> {
  const result = await applyMoves(createCubeState(SOLVED_FACELETS, "manual"), parseAlg(alg));
  return result.facelets;
}

function basePlan(stages: readonly SolutionStage[], input: FaceletString): SolutionPlan {
  return {
    method: "kociemba",
    input: createCubeState(input, "manual"),
    stages,
    moveCount: { htm: 0, qtm: 0, stm: 0, etm: 0 },
    generatedAt: 0,
    engine: "test",
    computeMs: 0,
    verified: false,
  };
}

describe("allMoves", () => {
  it("flattens a single flat stage", () => {
    const moves = moveList("R U");
    const plan = basePlan(
      [{ id: "solution", label: "Solution", moves, stateBefore: SOLVED_FACELETS, stateAfter: SOLVED_FACELETS }],
      SOLVED_FACELETS,
    );
    expect(allMoves(plan)).toEqual(moves);
  });

  it("flattens nested substeps without double-counting the parent's own moves", () => {
    const sub1 = moveList("R");
    const sub2 = moveList("U");
    const plan = basePlan(
      [
        {
          id: "parent",
          label: "Parent",
          moves: [], // per this file's documented convention: substeps carry the real data
          stateBefore: SOLVED_FACELETS,
          stateAfter: SOLVED_FACELETS,
          substeps: [
            { id: "sub1", label: "Sub 1", moves: sub1, stateBefore: SOLVED_FACELETS, stateAfter: SOLVED_FACELETS },
            { id: "sub2", label: "Sub 2", moves: sub2, stateBefore: SOLVED_FACELETS, stateAfter: SOLVED_FACELETS },
          ],
        },
      ],
      SOLVED_FACELETS,
    );
    expect(allMoves(plan)).toEqual([...sub1, ...sub2]);
  });
});

describe("checkStageConsistency (@004-S8)", () => {
  it("passes for a correctly chained single-stage plan", async () => {
    const scrambled = await scramble("R U2 F'");
    const solution = moveList("F U2 R'"); // the exact inverse
    const plan = basePlan(
      [{ id: "solution", label: "Solution", moves: solution, stateBefore: scrambled, stateAfter: SOLVED_FACELETS }],
      scrambled,
    );
    expect(await checkStageConsistency(plan)).toEqual({ ok: true });
  });

  it("fails when a stage's stateAfter doesn't match what its moves actually produce", async () => {
    const scrambled = await scramble("R U2 F'");
    const wrongSolution = moveList("R U2 F'"); // does not solve it
    const plan = basePlan(
      [{ id: "solution", label: "Solution", moves: wrongSolution, stateBefore: scrambled, stateAfter: SOLVED_FACELETS }],
      scrambled,
    );
    const result = await checkStageConsistency(plan);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.stageId).toBe("solution");
  });

  it("fails when a later stage's stateBefore doesn't chain from the previous stage's stateAfter", async () => {
    const scrambled = await scramble("R U2 F'");
    const plan = basePlan(
      [
        { id: "stage-1", label: "Stage 1", moves: [], stateBefore: scrambled, stateAfter: scrambled },
        // Deliberately wrong: stateBefore here doesn't match stage-1's stateAfter.
        { id: "stage-2", label: "Stage 2", moves: moveList("U"), stateBefore: SOLVED_FACELETS, stateAfter: SOLVED_FACELETS },
      ],
      scrambled,
    );
    const result = await checkStageConsistency(plan);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.stageId).toBe("stage-2");
  });

  it("checks nested substeps and the parent/substep stateAfter boundary", async () => {
    const scrambled = await scramble("R U2 F'");
    const plan = basePlan(
      [
        {
          id: "parent",
          label: "Parent",
          moves: [],
          stateBefore: scrambled,
          stateAfter: SOLVED_FACELETS,
          substeps: [
            { id: "sub1", label: "F", moves: moveList("F"), stateBefore: scrambled, stateAfter: await scramble("R U2 F' F") },
            {
              id: "sub2",
              label: "Rest",
              moves: moveList("U2 R'"),
              stateBefore: await scramble("R U2 F' F"),
              stateAfter: SOLVED_FACELETS,
            },
          ],
        },
      ],
      scrambled,
    );
    expect(await checkStageConsistency(plan)).toEqual({ ok: true });
  });
});

describe("checkGoldenInvariant (@004-S8)", () => {
  it("is true for a plan whose full move list actually solves the input", async () => {
    const scrambled = await scramble("R U2 F'");
    const plan = basePlan(
      [{ id: "solution", label: "Solution", moves: moveList("F U2 R'"), stateBefore: scrambled, stateAfter: SOLVED_FACELETS }],
      scrambled,
    );
    expect(await checkGoldenInvariant(plan, SOLVED_FACELETS)).toBe(true);
  });

  it("is false for a plan that doesn't actually solve the input", async () => {
    const scrambled = await scramble("R U2 F'");
    const plan = basePlan(
      [{ id: "solution", label: "Solution", moves: moveList("R"), stateBefore: scrambled, stateAfter: scrambled }],
      scrambled,
    );
    expect(await checkGoldenInvariant(plan, SOLVED_FACELETS)).toBe(false);
  });
});

describe("serializePlan / deserializePlan (@004-S17)", () => {
  it("round-trips a plan through JSON with deep equality", async () => {
    const scrambled = await scramble("R U2 F'");
    const plan: SolutionPlan = {
      ...basePlan(
        [{ id: "solution", label: "Solution", moves: moveList("F U2 R'"), stateBefore: scrambled, stateAfter: SOLVED_FACELETS }],
        scrambled,
      ),
      moveCount: { htm: 3, qtm: 4, stm: 3, etm: 3 },
      verified: true,
      warnings: ["example warning"],
    };
    const roundTripped = deserializePlan(serializePlan(plan));
    expect(roundTripped).toEqual(plan);
  });
});

describe("encodeCubeStateForURL / decodeCubeStateFromURL (@004-S17)", () => {
  it("round-trips the solved state", () => {
    const state = createCubeState(SOLVED_FACELETS, "manual");
    const decoded = decodeCubeStateFromURL(encodeCubeStateForURL(state));
    expect(decoded.facelets).toBe(state.facelets);
  });

  it("round-trips a scrambled state", async () => {
    const scrambled = await scramble("R U2 F' L2 D B'");
    const state = createCubeState(scrambled, "manual");
    const decoded = decodeCubeStateFromURL(encodeCubeStateForURL(state));
    expect(decoded.facelets).toBe(scrambled);
  });

  it("produces a URL-safe string with no +, / or = characters", async () => {
    const scrambled = await scramble("R U2 F' L2 D B'");
    const encoded = encodeCubeStateForURL(createCubeState(scrambled, "manual"));
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("rejects a decoded value that isn't a valid facelet string", () => {
    expect(() => decodeCubeStateFromURL(btoa("not-a-valid-facelet-string"))).toThrow(/not a valid facelet string/);
  });
});
