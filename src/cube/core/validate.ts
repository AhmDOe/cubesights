import { FACE_ORDER, faceletPositionToIndex, isFaceletString, type Face, type FaceletString } from "./facelets";

/**
 * validateFacelets (001-R6): the single source of truth for "is this a legal, reachable 3x3x3
 * cube state". Runs eight checks in order, each with its own error code and the offending
 * facelet indices, so the camera UI (003) can highlight exactly which stickers to re-check.
 */

export type CubeStateErrorCode =
  | "WRONG_LENGTH"
  | "FACELET_COUNT"
  | "INVALID_CENTRE"
  | "EDGE_EXISTENCE"
  | "CORNER_EXISTENCE"
  | "CORNER_ORIENTATION_PARITY"
  | "EDGE_ORIENTATION_PARITY"
  | "PERMUTATION_PARITY";

export interface CubeStateError {
  readonly code: CubeStateErrorCode;
  readonly message: string;
  readonly indices: readonly number[];
}

export type ValidateResult =
  | { readonly ok: true; readonly facelets: FaceletString }
  | { readonly ok: false; readonly error: CubeStateError };

function err(code: CubeStateErrorCode, indices: readonly number[], message: string): ValidateResult {
  return { ok: false, error: { code, indices, message } };
}

// --- Cubie tables -----------------------------------------------------------------------
// Derived geometrically (U up, F front; each face read by tilting the physical cube to face
// the viewer, keeping a consistent reference) and cross-checked against the standard
// Kociemba facelet-cubie convention. See ticket 001's Architecture notes for the derivation.

interface CornerDef {
  readonly id: string;
  readonly faces: readonly [Face, Face, Face];
  readonly indices: readonly [number, number, number];
}

interface EdgeDef {
  readonly id: string;
  readonly faces: readonly [Face, Face];
  readonly indices: readonly [number, number];
}

function idx(face: Face, row: number, col: number): number {
  return faceletPositionToIndex(face, row, col);
}

export const CORNERS: readonly CornerDef[] = [
  { id: "URF", faces: ["U", "R", "F"], indices: [idx("U", 2, 2), idx("R", 0, 0), idx("F", 0, 2)] },
  { id: "UBR", faces: ["U", "B", "R"], indices: [idx("U", 0, 2), idx("B", 0, 0), idx("R", 0, 2)] },
  { id: "ULB", faces: ["U", "L", "B"], indices: [idx("U", 0, 0), idx("L", 0, 0), idx("B", 0, 2)] },
  { id: "UFL", faces: ["U", "F", "L"], indices: [idx("U", 2, 0), idx("F", 0, 0), idx("L", 0, 2)] },
  { id: "DFR", faces: ["D", "F", "R"], indices: [idx("D", 0, 2), idx("F", 2, 2), idx("R", 2, 0)] },
  { id: "DLF", faces: ["D", "L", "F"], indices: [idx("D", 0, 0), idx("L", 2, 2), idx("F", 2, 0)] },
  { id: "DBL", faces: ["D", "B", "L"], indices: [idx("D", 2, 0), idx("B", 2, 2), idx("L", 2, 0)] },
  { id: "DRB", faces: ["D", "R", "B"], indices: [idx("D", 2, 2), idx("R", 2, 2), idx("B", 2, 0)] },
] as const;

export const EDGES: readonly EdgeDef[] = [
  { id: "UR", faces: ["U", "R"], indices: [idx("U", 1, 2), idx("R", 0, 1)] },
  { id: "UF", faces: ["U", "F"], indices: [idx("U", 2, 1), idx("F", 0, 1)] },
  { id: "UL", faces: ["U", "L"], indices: [idx("U", 1, 0), idx("L", 0, 1)] },
  { id: "UB", faces: ["U", "B"], indices: [idx("U", 0, 1), idx("B", 0, 1)] },
  { id: "DR", faces: ["D", "R"], indices: [idx("D", 1, 2), idx("R", 2, 1)] },
  { id: "DF", faces: ["D", "F"], indices: [idx("D", 0, 1), idx("F", 2, 1)] },
  { id: "DL", faces: ["D", "L"], indices: [idx("D", 1, 0), idx("L", 2, 1)] },
  { id: "DB", faces: ["D", "B"], indices: [idx("D", 2, 1), idx("B", 2, 1)] },
  { id: "FR", faces: ["F", "R"], indices: [idx("F", 1, 2), idx("R", 1, 0)] },
  { id: "FL", faces: ["F", "L"], indices: [idx("F", 1, 0), idx("L", 1, 2)] },
  { id: "BL", faces: ["B", "L"], indices: [idx("B", 1, 2), idx("L", 1, 0)] },
  { id: "BR", faces: ["B", "R"], indices: [idx("B", 1, 0), idx("R", 1, 2)] },
] as const;

export function rotate3(triple: readonly [string, string, string], o: number): readonly [string, string, string] {
  const n = ((o % 3) + 3) % 3;
  return [triple[n]!, triple[(n + 1) % 3]!, triple[(n + 2) % 3]!];
}

function permutationParity(perm: readonly number[]): 0 | 1 {
  const n = perm.length;
  const visited = new Array<boolean>(n).fill(false);
  let cycles = 0;
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    cycles++;
    let j = i;
    while (!visited[j]) {
      visited[j] = true;
      j = perm[j]!;
    }
  }
  return ((n - cycles) % 2) as 0 | 1;
}

export function validateFacelets(facelets: string): ValidateResult {
  // (a) length 54
  if (facelets.length !== 54) {
    return err("WRONG_LENGTH", [], `Expected 54 facelets, got ${facelets.length}`);
  }
  if (!isFaceletString(facelets)) {
    return err("WRONG_LENGTH", [], `Facelets must contain only the letters U R F D L B`);
  }

  // (b) exactly 9 of each face letter
  const counts: Record<Face, number> = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
  for (const ch of facelets) counts[ch as Face]++;
  const over: Face[] = [];
  const under: Face[] = [];
  for (const face of FACE_ORDER) {
    if (counts[face] > 9) over.push(face);
    if (counts[face] < 9) under.push(face);
  }
  if (over.length > 0 || under.length > 0) {
    return err(
      "FACELET_COUNT",
      [],
      `Expected exactly 9 of each facelet; over-represented: ${over.join(",") || "none"}; under-represented: ${under.join(",") || "none"}`,
    );
  }

  // (c) 6 distinct centres — each centre must equal its own face's letter
  for (const face of FACE_ORDER) {
    const centreIndex = idx(face, 1, 1);
    const actual = facelets[centreIndex];
    if (actual !== face) {
      return err(
        "INVALID_CENTRE",
        [centreIndex],
        `Centre of face ${face} (index ${centreIndex}) reads '${actual}', expected '${face}'`,
      );
    }
  }

  // (d) all 12 edge pairs exist and are unique
  const edgePermutation: number[] = new Array<number>(EDGES.length).fill(-1);
  const edgeOrientations: number[] = new Array<number>(EDGES.length).fill(0);
  const usedEdgePieces = new Set<number>();

  for (let slot = 0; slot < EDGES.length; slot++) {
    const def = EDGES[slot]!;
    const [i0, i1] = def.indices;
    const read: [string, string] = [facelets[i0]!, facelets[i1]!];
    const readSet = new Set(read);

    const pieceIndex = EDGES.findIndex((p) => {
      const s = new Set(p.faces as readonly string[]);
      return s.size === readSet.size && [...s].every((f) => readSet.has(f));
    });

    if (pieceIndex === -1) {
      return err(
        "EDGE_EXISTENCE",
        [i0, i1],
        `No valid edge piece matches the stickers at slot ${def.id} (indices ${i0}, ${i1}): ${read.join(",")}`,
      );
    }
    if (usedEdgePieces.has(pieceIndex)) {
      return err(
        "EDGE_EXISTENCE",
        [i0, i1],
        `Edge piece ${EDGES[pieceIndex]!.id} appears more than once (duplicate at slot ${def.id})`,
      );
    }
    usedEdgePieces.add(pieceIndex);
    edgePermutation[slot] = pieceIndex;

    const piece = EDGES[pieceIndex]!;
    edgeOrientations[slot] = read[0] === piece.faces[0] ? 0 : 1;
  }

  // (e) all 8 corner triples exist, are unique and are not mirrored/invalid
  const cornerPermutation: number[] = new Array<number>(CORNERS.length).fill(-1);
  const cornerOrientations: number[] = new Array<number>(CORNERS.length).fill(0);
  const usedCornerPieces = new Set<number>();

  for (let slot = 0; slot < CORNERS.length; slot++) {
    const def = CORNERS[slot]!;
    const [i0, i1, i2] = def.indices;
    const read: [string, string, string] = [facelets[i0]!, facelets[i1]!, facelets[i2]!];
    const readSet = new Set(read);

    const pieceIndex = CORNERS.findIndex((p) => {
      const s = new Set(p.faces as readonly string[]);
      return s.size === readSet.size && [...s].every((f) => readSet.has(f));
    });

    if (pieceIndex === -1 || readSet.size !== 3) {
      return err(
        "CORNER_EXISTENCE",
        [i0, i1, i2],
        `No valid corner piece matches the stickers at slot ${def.id} (indices ${i0}, ${i1}, ${i2}): ${read.join(",")}`,
      );
    }
    if (usedCornerPieces.has(pieceIndex)) {
      return err(
        "CORNER_EXISTENCE",
        [i0, i1, i2],
        `Corner piece ${CORNERS[pieceIndex]!.id} appears more than once (duplicate at slot ${def.id})`,
      );
    }
    usedCornerPieces.add(pieceIndex);
    cornerPermutation[slot] = pieceIndex;

    const piece = CORNERS[pieceIndex]!;
    let orientation = -1;
    for (let o = 0; o < 3; o++) {
      const rotated = rotate3(piece.faces, o);
      if (rotated[0] === read[0] && rotated[1] === read[1] && rotated[2] === read[2]) {
        orientation = o;
        break;
      }
    }
    if (orientation === -1) {
      return err(
        "CORNER_EXISTENCE",
        [i0, i1, i2],
        `Corner piece ${piece.id} at slot ${def.id} has an impossible (mirrored) sticker order: ${read.join(",")}`,
      );
    }
    cornerOrientations[slot] = orientation;
  }

  // (f) corner orientation sum ≡ 0 (mod 3)
  const cornerOrientationSum = cornerOrientations.reduce((a, b) => a + b, 0) % 3;
  if (cornerOrientationSum !== 0) {
    const twisted: number[] = [];
    for (let i = 0; i < cornerOrientations.length; i++) {
      if (cornerOrientations[i] !== 0) twisted.push(...CORNERS[i]!.indices);
    }
    return err(
      "CORNER_ORIENTATION_PARITY",
      twisted,
      `Corner orientations sum to ${cornerOrientationSum} mod 3, expected 0 — a corner is twisted in place`,
    );
  }

  // (g) edge orientation sum ≡ 0 (mod 2)
  const edgeOrientationSum = edgeOrientations.reduce((a, b) => a + b, 0) % 2;
  if (edgeOrientationSum !== 0) {
    const flipped: number[] = [];
    for (let i = 0; i < edgeOrientations.length; i++) {
      if (edgeOrientations[i] !== 0) flipped.push(...EDGES[i]!.indices);
    }
    return err(
      "EDGE_ORIENTATION_PARITY",
      flipped,
      `Edge orientations sum to ${edgeOrientationSum} mod 2, expected 0 — an edge is flipped in place`,
    );
  }

  // (h) permutation parity of corners equals that of edges
  const cornerParity = permutationParity(cornerPermutation);
  const edgeParity = permutationParity(edgePermutation);
  if (cornerParity !== edgeParity) {
    return err(
      "PERMUTATION_PARITY",
      [],
      `Corner permutation parity (${cornerParity}) does not match edge permutation parity (${edgeParity})`,
    );
  }

  return { ok: true, facelets: facelets };
}
