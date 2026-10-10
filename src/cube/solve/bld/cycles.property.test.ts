import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyMoves } from "~/cube/core/apply";
import { createCubeState, type CubeState } from "~/cube/core/cube-state";
import { SOLVED_FACELETS } from "~/cube/core/facelets";
import { parseAlg } from "~/cube/core/notation";
import { CORNERS, EDGES } from "~/cube/core/validate";
import { decompose, type CycleTarget } from "./cycles";
import { SPEFFZ_SCHEME } from "./scheme";

/**
 * Property proof for 004-R10/T9.3: replaying the decomposed buffer-target swaps, as pure
 * permutation swaps (not real algorithms -- setup.ts verifies those separately against 004-R11),
 * always fully solves the relevant piece type, for OP corners, OP edges and M2 edges
 * independently. `fromSlot` (see cycles.ts) makes the swap sequence replayable unambiguously
 * without re-deriving cycle boundaries.
 */

const OP_CORNER_BUFFER = { corners: "ULB:U", edges: "UR:U" } as never;
const OP_EDGE_BUFFER = { corners: "ULB:U", edges: "UR:U" } as never;
const M2_EDGE_BUFFER = { corners: "ULB:U", edges: "DF:D" } as never;

function homeSlotIndex(defs: readonly { id: string }[], id: string): number {
  return defs.findIndex((d) => d.id === id);
}

function replaySolves(defs: readonly { id: string }[], initialPieceAtSlot: readonly string[], targets: readonly CycleTarget[]): boolean {
  const arr = [...initialPieceAtSlot];
  for (const target of targets) {
    const targetSlot = homeSlotIndex(defs, target.cubie);
    const tmp = arr[target.fromSlot]!;
    arr[target.fromSlot] = arr[targetSlot]!;
    arr[targetSlot] = tmp;
  }
  return arr.every((pieceId, slot) => pieceId === defs[slot]!.id);
}

function currentPieceAtSlots(facelets: string, defs: readonly { id: string; faces: readonly string[]; indices: readonly number[] }[]): string[] {
  return defs.map((def) => {
    const read = def.indices.map((i) => facelets[i]!);
    const readSet = new Set(read);
    const piece = defs.find((p) => {
      const s = new Set(p.faces);
      return s.size === readSet.size && [...s].every((f) => readSet.has(f));
    })!;
    return piece.id;
  });
}

const randomMoveSequence = fc
  .array(fc.constantFrom("U", "U'", "U2", "R", "R'", "R2", "F", "F'", "F2", "D", "D'", "D2", "L", "L'", "L2", "B", "B'", "B2"), {
    minLength: 10,
    maxLength: 40,
  })
  .map((moves) => moves.join(" "));

async function randomLegalState(alg: string): Promise<CubeState> {
  return applyMoves(createCubeState(SOLVED_FACELETS, "manual"), parseAlg(alg));
}

describe("cycles property test: OP corner buffer (ULB)", () => {
  it("replaying the decomposed corner targets always solves all 8 corners", async () => {
    await fc.assert(
      fc.asyncProperty(randomMoveSequence, async (alg) => {
        const state = await randomLegalState(alg);
        const result = decompose(state, OP_CORNER_BUFFER, SPEFFZ_SCHEME);
        const initial = currentPieceAtSlots(state.facelets, CORNERS);
        expect(replaySolves(CORNERS, initial, result.cornerTargets)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});

describe("cycles property test: OP edge buffer (UR)", () => {
  it("replaying the decomposed edge targets always solves all 12 edges", async () => {
    await fc.assert(
      fc.asyncProperty(randomMoveSequence, async (alg) => {
        const state = await randomLegalState(alg);
        const result = decompose(state, OP_EDGE_BUFFER, SPEFFZ_SCHEME);
        const initial = currentPieceAtSlots(state.facelets, EDGES);
        expect(replaySolves(EDGES, initial, result.edgeTargets)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});

describe("cycles property test: M2 edge buffer (DF)", () => {
  it("replaying the decomposed edge targets always solves all 12 edges", async () => {
    await fc.assert(
      fc.asyncProperty(randomMoveSequence, async (alg) => {
        const state = await randomLegalState(alg);
        const result = decompose(state, M2_EDGE_BUFFER, SPEFFZ_SCHEME);
        const initial = currentPieceAtSlots(state.facelets, EDGES);
        expect(replaySolves(EDGES, initial, result.edgeTargets)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});
