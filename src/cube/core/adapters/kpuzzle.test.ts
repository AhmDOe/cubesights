import { describe, expect, it } from "vitest";
import { fromKPattern, toKPattern, toKTransformation } from "./kpuzzle";
import { SOLVED_FACELETS } from "../facelets";
import { validateFacelets } from "../validate";
import { SINGLE_MOVE_FACELETS } from "../../../../tests/fixtures/single-moves";

describe("toKPattern / fromKPattern", () => {
  it("@001-S1 round-trips the solved state byte-identically", async () => {
    const pattern = await toKPattern(SOLVED_FACELETS);
    const back = await fromKPattern(pattern);
    expect(back).toBe(SOLVED_FACELETS);
  });

  it("round-trips every single-move fixture state byte-identically", async () => {
    for (const facelets of Object.values(SINGLE_MOVE_FACELETS)) {
      const pattern = await toKPattern(facelets);
      const back = await fromKPattern(pattern);
      expect(back).toBe(facelets);
    }
  });

  it("toKTransformation produces a pattern identical to toKPattern for the solved and every single-move state", async () => {
    for (const facelets of [SOLVED_FACELETS, ...Object.values(SINGLE_MOVE_FACELETS)]) {
      const viaPattern = await toKPattern(facelets);
      const viaTransformation = (await toKTransformation(facelets)).toKPattern();
      expect(viaTransformation.isIdentical(viaPattern)).toBe(true);
    }
  });

  it("round-trips 50 pseudo-random move-sequence states, all passing validateFacelets", async () => {
    const tokens = ["U", "U'", "U2", "D", "D'", "D2", "F", "F'", "F2", "B", "B'", "B2", "L", "L'", "L2", "R", "R'", "R2"];
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    let pattern = await toKPattern(SOLVED_FACELETS);
    for (let i = 0; i < 50; i++) {
      const moveCount = 1 + Math.floor(rand() * 5);
      for (let m = 0; m < moveCount; m++) {
        const token = tokens[Math.floor(rand() * tokens.length)]!;
        pattern = pattern.applyMove(token);
      }
      const facelets = await fromKPattern(pattern);
      const result = validateFacelets(facelets);
      expect(result.ok).toBe(true);

      const roundTripped = await toKPattern(facelets);
      const back = await fromKPattern(roundTripped);
      expect(back).toBe(facelets);
    }
  });
});
