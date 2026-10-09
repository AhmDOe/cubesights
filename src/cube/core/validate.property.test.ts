import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FACE_ORDER, SOLVED_FACELETS } from "./facelets";
import { validateFacelets, type CubeStateErrorCode } from "./validate";

const KNOWN_CODES: readonly CubeStateErrorCode[] = [
  "WRONG_LENGTH",
  "FACELET_COUNT",
  "INVALID_CENTRE",
  "EDGE_EXISTENCE",
  "CORNER_EXISTENCE",
  "CORNER_ORIENTATION_PARITY",
  "EDGE_ORIENTATION_PARITY",
  "PERMUTATION_PARITY",
];

describe("validateFacelets (property-based)", () => {
  it("never throws, and always returns either ok:true or a known error code, for any single-character mutation of the solved state", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 53 }),
        fc.constantFrom(...FACE_ORDER),
        (index, letter) => {
          const chars = SOLVED_FACELETS.split("");
          chars[index] = letter;
          const mutated = chars.join("");

          const result = validateFacelets(mutated);
          if (!result.ok) {
            expect(KNOWN_CODES).toContain(result.error.code);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("is idempotent: validating the same (valid) string twice gives the same verdict", () => {
    const first = validateFacelets(SOLVED_FACELETS);
    const second = validateFacelets(SOLVED_FACELETS);
    expect(first).toEqual(second);
  });

  // Deferred until applyMoves exists (ticket 001-T5.3): the stronger property "300 random move
  // sequences from solved always validate" needs a real move-applier to generate reachable
  // states. Hand-rolling "random reachable state" without it would just re-implement applyMoves
  // badly inside the test.
});
