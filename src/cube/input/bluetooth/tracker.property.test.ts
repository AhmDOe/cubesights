import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CubeStateTracker } from "./tracker";
import { applyMoves } from "~/cube/core/apply";
import { createCubeState } from "~/cube/core/cube-state";
import { SOLVED_FACELETS } from "~/cube/core/facelets";
import { validateFacelets } from "~/cube/core/validate";
import { parseAlg } from "~/cube/core/notation";

const TOKENS = ["U", "U'", "U2", "D", "D'", "D2", "F", "F'", "F2", "B", "B'", "B2", "L", "L'", "L2", "R", "R'", "R2"];

describe("CubeStateTracker (property-based)", () => {
  it("for any in-order, fully-serialed move stream, the tracker's state always equals applyMoves(seed, stream) and always validates", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom(...TOKENS), { minLength: 0, maxLength: 20 }), async (tokens) => {
        const tracker = new CubeStateTracker({ requestFaceletRead: async () => SOLVED_FACELETS });
        tracker.seed(SOLVED_FACELETS);

        for (let i = 0; i < tokens.length; i++) {
          await tracker.handleMove({
            move: tokens[i] as never,
            deviceTimestamp: i,
            receivedAt: i,
            serial: i,
          });
        }

        const moves = tokens.join(" ");
        const expected = await applyMoves(createCubeState(SOLVED_FACELETS, "scramble"), parseAlg(moves));

        expect(tracker.getState()!.facelets).toBe(expected.facelets);
        expect(validateFacelets(tracker.getState()!.facelets).ok).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
