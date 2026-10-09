import { describe, expect, it } from "vitest";
import { CENTRE_INDICES, FACE_ORDER, SOLVED_FACELETS } from "./facelets";
import { ColorResolutionError, resolveColorFaceletsToFacelets, type ColorFacelets } from "./colors";
import { DUPLICATE_CENTRES_COLORS } from "../../../tests/fixtures/states";

const STANDARD_SCHEME: Record<string, string> = { U: "W", R: "R", F: "G", D: "Y", L: "O", B: "B" };
const JAPANESE_SCHEME: Record<string, string> = { U: "W", R: "B", F: "R", D: "Y", L: "G", B: "O" };

function colorsForScheme(scheme: Record<string, string>): ColorFacelets {
  const colors = new Array<string>(54).fill("W");
  for (let f = 0; f < FACE_ORDER.length; f++) {
    const face = FACE_ORDER[f]!;
    for (let i = 0; i < 9; i++) colors[f * 9 + i] = scheme[face]!;
  }
  return colors as unknown as ColorFacelets;
}

describe("resolveColorFaceletsToFacelets", () => {
  it("@001-S7 resolves a standard-scheme solved cube to the solved facelet string", () => {
    const colors = colorsForScheme(STANDARD_SCHEME);
    expect(resolveColorFaceletsToFacelets(colors)).toBe(SOLVED_FACELETS);
  });

  it("resolves a Japanese-scheme cube to the same solved facelet string", () => {
    const colors = colorsForScheme(JAPANESE_SCHEME);
    expect(resolveColorFaceletsToFacelets(colors)).toBe(SOLVED_FACELETS);
  });

  it("@001-S8 rejects colour facelets with duplicate centres, naming both indices", () => {
    expect.assertions(3);
    try {
      resolveColorFaceletsToFacelets(DUPLICATE_CENTRES_COLORS);
    } catch (e) {
      expect(e).toBeInstanceOf(ColorResolutionError);
      const error = e as ColorResolutionError;
      expect(error.code).toBe("AMBIGUOUS_CENTRES");
      expect(error.indices).toEqual([CENTRE_INDICES.R, CENTRE_INDICES.L]);
    }
  });

  it("rejects the wrong number of colour facelets", () => {
    expect(() => resolveColorFaceletsToFacelets([])).toThrow(
      ColorResolutionError,
    );
  });

  it("rejects an unknown centre", () => {
    const colors = colorsForScheme(STANDARD_SCHEME).slice() as string[];
    colors[CENTRE_INDICES.F] = "unknown";
    expect(() => resolveColorFaceletsToFacelets(colors as unknown as ColorFacelets)).toThrow(
      ColorResolutionError,
    );
  });
});
