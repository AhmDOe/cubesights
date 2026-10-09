import { describe, expect, it } from "vitest";
import { applyMoves } from "./apply";
import { createCubeState } from "./cube-state";
import { SOLVED_FACELETS } from "./facelets";
import { parseAlg } from "./notation";
import { SINGLE_MOVE_FACELETS } from "../../../tests/fixtures/single-moves";

function solvedState() {
  return createCubeState(SOLVED_FACELETS, "scramble");
}

describe("applyMoves", () => {
  it.each(Object.entries(SINGLE_MOVE_FACELETS))(
    "applies %s to match the hand-computed expected facelets",
    async (token, expected) => {
      const result = await applyMoves(solvedState(), parseAlg(token));
      expect(result.facelets).toBe(expected);
    },
  );

  it("@001-S3 applying a scramble and its inverse returns to solved", async () => {
    const scramble = parseAlg("R U2 F' L D R' B U L2 F");
    const afterScramble = await applyMoves(solvedState(), scramble);
    const inverse = [...scramble].reverse().map(invertToken);
    const afterInverse = await applyMoves(afterScramble, inverse as never);
    expect(afterInverse.facelets).toBe(SOLVED_FACELETS);
  });

  it("U^4 is the identity", async () => {
    const fourUs = parseAlg("U U U U");
    const result = await applyMoves(solvedState(), fourUs);
    expect(result.facelets).toBe(SOLVED_FACELETS);
  });

  it("an empty move sequence returns the same state object", async () => {
    const state = solvedState();
    const result = await applyMoves(state, []);
    expect(result).toBe(state);
  });

  it("applying moves preserves the requested source, defaulting to the input state's source", async () => {
    const state = createCubeState(SOLVED_FACELETS, "camera");
    const result = await applyMoves(state, parseAlg("R"));
    expect(result.source).toBe("camera");
  });
});

function invertToken(token: string): string {
  if (token.endsWith("'")) return token.slice(0, -1);
  if (token.endsWith("2")) return token;
  return `${token}'`;
}
