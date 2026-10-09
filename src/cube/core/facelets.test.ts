import { describe, expect, it } from "vitest";
import {
  CENTRE_INDICES,
  FACE_ORDER,
  SOLVED_FACELETS,
  assertFaceletString,
  centreIndexOf,
  faceletIndexToPosition,
  faceletPositionToIndex,
  isFaceletString,
} from "./facelets";

describe("SOLVED_FACELETS", () => {
  it("is 54 characters, 9 of each face letter, in URFDLB order", () => {
    expect(SOLVED_FACELETS).toHaveLength(54);
    for (let f = 0; f < FACE_ORDER.length; f++) {
      const face = FACE_ORDER[f]!;
      const segment = SOLVED_FACELETS.slice(f * 9, f * 9 + 9);
      expect(segment).toBe(face.repeat(9));
    }
  });
});

describe("faceletIndexToPosition / faceletPositionToIndex", () => {
  it("round-trips for all 54 indices", () => {
    for (let i = 0; i < 54; i++) {
      const pos = faceletIndexToPosition(i);
      expect(faceletPositionToIndex(pos.face, pos.row, pos.col)).toBe(i);
    }
  });

  it("maps index 0 to U face, row 0, col 0 and index 53 to B face, row 2, col 2", () => {
    expect(faceletIndexToPosition(0)).toEqual({ face: "U", row: 0, col: 0 });
    expect(faceletIndexToPosition(53)).toEqual({ face: "B", row: 2, col: 2 });
  });

  it("rejects out-of-range indices", () => {
    expect(() => faceletIndexToPosition(-1)).toThrow(RangeError);
    expect(() => faceletIndexToPosition(54)).toThrow(RangeError);
  });
});

describe("centreIndexOf / CENTRE_INDICES", () => {
  it("is slot 4 within each face's 9-slot block", () => {
    for (let f = 0; f < FACE_ORDER.length; f++) {
      const face = FACE_ORDER[f]!;
      expect(centreIndexOf(face)).toBe(f * 9 + 4);
      expect(CENTRE_INDICES[face]).toBe(f * 9 + 4);
    }
  });
});

describe("isFaceletString / assertFaceletString", () => {
  it("accepts a well-formed 54-character URFDLB string", () => {
    expect(isFaceletString(SOLVED_FACELETS)).toBe(true);
    expect(() => assertFaceletString(SOLVED_FACELETS)).not.toThrow();
  });

  it("rejects wrong length", () => {
    expect(isFaceletString("UUU")).toBe(false);
    expect(() => assertFaceletString("UUU")).toThrow(TypeError);
  });

  it("rejects characters outside U R F D L B", () => {
    const bad = "X".repeat(54);
    expect(isFaceletString(bad)).toBe(false);
    expect(() => assertFaceletString(bad)).toThrow(TypeError);
  });
});
