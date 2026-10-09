/**
 * Canonical cube representation: a 54-character URFDLB facelet string.
 * Index order matches the Kociemba/min2phase convention (001-R2):
 * 0-8 = U, 9-17 = R, 18-26 = F, 27-35 = D, 36-44 = L, 45-53 = B,
 * each face read row-major from its own top-left with U up and F front.
 */

export const FACE_ORDER = ["U", "R", "F", "D", "L", "B"] as const;
export type Face = (typeof FACE_ORDER)[number];

declare const faceletStringBrand: unique symbol;
export type FaceletString = string & { readonly [faceletStringBrand]: true };

export const SOLVED_FACELETS =
  "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB" as FaceletString;

const FACELET_PATTERN = /^[URFDLB]{54}$/;

export function isFaceletString(value: string): value is FaceletString {
  return value.length === 54 && FACELET_PATTERN.test(value);
}

export function assertFaceletString(value: string): FaceletString {
  if (!isFaceletString(value)) {
    throw new TypeError(
      `Expected a 54-character URFDLB facelet string, got (length ${value.length}): ${value}`,
    );
  }
  return value;
}

export interface FaceletPosition {
  readonly face: Face;
  readonly row: number;
  readonly col: number;
}

/** Index (0-53) -> which face, row (0-2) and column (0-2) that slot belongs to. */
export function faceletIndexToPosition(index: number): FaceletPosition {
  if (index < 0 || index > 53 || !Number.isInteger(index)) {
    throw new RangeError(`Facelet index out of range [0, 53]: ${index}`);
  }
  const faceIndex = Math.floor(index / 9);
  const withinFace = index % 9;
  return {
    face: FACE_ORDER[faceIndex]!,
    row: Math.floor(withinFace / 3),
    col: withinFace % 3,
  };
}

/** The inverse of faceletIndexToPosition: (face, row, col) -> index (0-53). */
export function faceletPositionToIndex(face: Face, row: number, col: number): number {
  if (row < 0 || row > 2 || col < 0 || col > 2) {
    throw new RangeError(`row/col out of range [0, 2]: row=${row} col=${col}`);
  }
  const faceIndex = FACE_ORDER.indexOf(face);
  return faceIndex * 9 + row * 3 + col;
}

/** The centre-sticker facelet index for a given face (always slot 4 within the face). */
export function centreIndexOf(face: Face): number {
  return FACE_ORDER.indexOf(face) * 9 + 4;
}

export const CENTRE_INDICES: Readonly<Record<Face, number>> = Object.freeze({
  U: centreIndexOf("U"),
  R: centreIndexOf("R"),
  F: centreIndexOf("F"),
  D: centreIndexOf("D"),
  L: centreIndexOf("L"),
  B: centreIndexOf("B"),
});
