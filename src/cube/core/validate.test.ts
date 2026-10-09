import { describe, expect, it } from "vitest";
import { SOLVED_FACELETS } from "./facelets";
import { validateFacelets } from "./validate";
import {
  ONE_FLIPPED_EDGE,
  ONE_TWISTED_CORNER,
  SOLVED,
  SUPERFLIP,
  TWO_SWAPPED_CORNERS,
  WRONG_COUNTS,
} from "../../../tests/fixtures/states";

describe("validateFacelets", () => {
  it("accepts the solved state", () => {
    const result = validateFacelets(SOLVED);
    expect(result.ok).toBe(true);
  });

  it("accepts superflip (legally reachable: identity permutation, all edges flipped)", () => {
    const result = validateFacelets(SUPERFLIP);
    expect(result.ok).toBe(true);
  });

  it("@001-S4 rejects a single flipped edge with EDGE_ORIENTATION_PARITY and both facelet indices", () => {
    const result = validateFacelets(ONE_FLIPPED_EDGE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EDGE_ORIENTATION_PARITY");
      expect(result.error.indices).toHaveLength(2);
    }
  });

  it("@001-S5 rejects a single twisted corner with CORNER_ORIENTATION_PARITY", () => {
    const result = validateFacelets(ONE_TWISTED_CORNER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CORNER_ORIENTATION_PARITY");
      expect(result.error.indices).toHaveLength(3);
    }
  });

  it("rejects two swapped corners with PERMUTATION_PARITY", () => {
    const result = validateFacelets(TWO_SWAPPED_CORNERS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERMUTATION_PARITY");
    }
  });

  it("@001-S6 rejects wrong sticker counts with FACELET_COUNT naming over/under faces", () => {
    const result = validateFacelets(WRONG_COUNTS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FACELET_COUNT");
      expect(result.error.message).toMatch(/U/);
      expect(result.error.message).toMatch(/D/);
    }
  });

  it("rejects the wrong length before any other check", () => {
    const result = validateFacelets("UUU");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WRONG_LENGTH");
  });

  it("rejects a corrupted centre (count-preserving, so FACELET_COUNT doesn't fire first)", () => {
    // Swap the U-centre (index 4) and R-centre (index 13) values: counts stay 9/9, only the
    // centre positions are wrong, isolating the INVALID_CENTRE check from FACELET_COUNT.
    const chars = SOLVED_FACELETS.split("");
    [chars[4], chars[13]] = [chars[13]!, chars[4]!];
    const corrupted = chars.join("");
    const result = validateFacelets(corrupted);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_CENTRE");
  });
});
