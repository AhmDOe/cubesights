import { describe, expect, it, vi } from "vitest";
import { generateScramble, scrambledState } from "./scramble";
import { SOLVED_FACELETS } from "./facelets";
import { validateFacelets } from "./validate";

describe("generateScramble / scrambledState", () => {
  it("@001-S2 generates a scramble of 19 or more moves in standard notation", async () => {
    const moves = await generateScramble();
    expect(moves.length).toBeGreaterThanOrEqual(19);
    for (const move of moves) expect(typeof move).toBe("string");
  });

  it("@001-S2 the resulting state is valid and not solved", async () => {
    const state = await scrambledState();
    expect(validateFacelets(state.facelets).ok).toBe(true);
    expect(state.facelets).not.toBe(SOLVED_FACELETS);
    expect(state.source).toBe("scramble");
  });

  it("produces a different scramble on successive calls", async () => {
    const a = await generateScramble();
    const b = await generateScramble();
    expect(a.join(" ")).not.toBe(b.join(" "));
  });

  it("falls back to a random-move scramble if cubing/scramble throws (ticket 001 Open question R5)", async () => {
    vi.doMock("cubing/scramble", () => ({
      randomScrambleForEvent: vi.fn(async () => {
        throw new Error("Module worker instantiation failed.");
      }),
    }));
    vi.resetModules();
    const { generateScramble: generateScrambleFresh } = await import("./scramble");

    const moves = await generateScrambleFresh();
    expect(moves.length).toBeGreaterThanOrEqual(20);

    vi.doUnmock("cubing/scramble");
    vi.resetModules();
  });
});
