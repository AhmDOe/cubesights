import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import { CORNERS, EDGES, rotate3 } from "../validate";
import { assertFaceletString, type FaceletString } from "../facelets";

/**
 * Converts between our canonical FaceletString (001-R2) and cubing/kpuzzle's KPattern (001-R7).
 *
 * kpuzzle's 3x3x3 definition uses its own internal slot numbering for the EDGES/CORNERS orbits,
 * unrelated to our facelet order, and its own corner-orientation sign convention. Both were
 * determined empirically (applying each of the 6 face moves to kpuzzle's solved pattern and
 * cross-referencing the resulting permutation/orientation against our own facelet tables) and are
 * encoded below as plain data. The relationship is simple and exact:
 *   - edge piece/slot order matches 1:1 via KP_EDGE_NAMES (identity orientation mapping).
 *   - corner piece/slot order matches 1:1 via KP_CORNER_NAMES; corner orientation is inverted:
 *     ours = (3 - kpuzzle's) % 3 (the two conventions spin corners in opposite directions).
 * This is covered by round-trip tests over random states and by apply.test.ts's single-move
 * fixtures, which were derived independently via 3D coordinate rotation, not via kpuzzle itself.
 */

const KP_CORNER_NAMES = ["URF", "UBR", "ULB", "UFL", "DFR", "DLF", "DBL", "DRB"] as const;
const KP_EDGE_NAMES = ["UF", "UR", "UB", "UL", "DF", "DR", "DB", "DL", "FR", "FL", "BR", "BL"] as const;

let kpuzzlePromise: Promise<KPuzzle> | undefined;

async function getKPuzzle(): Promise<KPuzzle> {
  kpuzzlePromise ??= import("cubing/puzzles").then((m) => m.cube3x3x3.kpuzzle());
  return kpuzzlePromise;
}

interface RawPatternData {
  CORNERS: { pieces: number[]; orientation: number[] };
  EDGES: { pieces: number[]; orientation: number[] };
  CENTERS: { pieces: number[]; orientation: number[]; orientationMod: number[] };
}

function computeKpuzzleOrderedData(facelets: FaceletString): {
  CORNERS: RawPatternData["CORNERS"];
  EDGES: RawPatternData["EDGES"];
} {
  const cornerPieces: number[] = new Array<number>(8).fill(0);
  const cornerOrientation: number[] = new Array<number>(8).fill(0);
  for (let slot = 0; slot < CORNERS.length; slot++) {
    const def = CORNERS[slot]!;
    const [i0, i1, i2] = def.indices;
    const read: [string, string, string] = [facelets[i0]!, facelets[i1]!, facelets[i2]!];
    const pieceIndex = CORNERS.findIndex((p) => {
      const faces = new Set<string>(p.faces);
      return faces.has(read[0]) && faces.has(read[1]) && faces.has(read[2]);
    });
    const piece = CORNERS[pieceIndex]!;
    let orientation = 0;
    for (let o = 0; o < 3; o++) {
      const rotated = rotate3(piece.faces, o);
      if (rotated[0] === read[0] && rotated[1] === read[1] && rotated[2] === read[2]) orientation = o;
    }
    cornerPieces[slot] = KP_CORNER_NAMES.indexOf(piece.id as (typeof KP_CORNER_NAMES)[number]);
    cornerOrientation[slot] = (3 - orientation) % 3;
  }

  const edgePieces: number[] = new Array<number>(12).fill(0);
  const edgeOrientation: number[] = new Array<number>(12).fill(0);
  for (let slot = 0; slot < EDGES.length; slot++) {
    const def = EDGES[slot]!;
    const [i0, i1] = def.indices;
    const read: [string, string] = [facelets[i0]!, facelets[i1]!];
    const pieceIndex = EDGES.findIndex((p) => {
      const faces = new Set<string>(p.faces);
      return faces.has(read[0]) && faces.has(read[1]);
    });
    const piece = EDGES[pieceIndex]!;
    const orientation = read[0] === piece.faces[0] ? 0 : 1;
    edgePieces[slot] = KP_EDGE_NAMES.indexOf(piece.id as (typeof KP_EDGE_NAMES)[number]);
    edgeOrientation[slot] = orientation;
  }

  // Re-order from OUR slot order into KPUZZLE's slot order (both arrays above are indexed by
  // our CORNERS/EDGES order; kpuzzle needs them indexed by its own slot order).
  const kpCorners: RawPatternData["CORNERS"] = { pieces: new Array<number>(8).fill(0), orientation: new Array<number>(8).fill(0) };
  for (let ourSlot = 0; ourSlot < CORNERS.length; ourSlot++) {
    const kpSlot = KP_CORNER_NAMES.indexOf(CORNERS[ourSlot]!.id as (typeof KP_CORNER_NAMES)[number]);
    kpCorners.pieces[kpSlot] = cornerPieces[ourSlot]!;
    kpCorners.orientation[kpSlot] = cornerOrientation[ourSlot]!;
  }
  const kpEdges: RawPatternData["EDGES"] = { pieces: new Array<number>(12).fill(0), orientation: new Array<number>(12).fill(0) };
  for (let ourSlot = 0; ourSlot < EDGES.length; ourSlot++) {
    const kpSlot = KP_EDGE_NAMES.indexOf(EDGES[ourSlot]!.id as (typeof KP_EDGE_NAMES)[number]);
    kpEdges.pieces[kpSlot] = edgePieces[ourSlot]!;
    kpEdges.orientation[kpSlot] = edgeOrientation[ourSlot]!;
  }

  return { CORNERS: kpCorners, EDGES: kpEdges };
}

export async function toKPattern(facelets: FaceletString): Promise<KPattern> {
  const kpuzzle = await getKPuzzle();
  const { CORNERS: kpCorners, EDGES: kpEdges } = computeKpuzzleOrderedData(facelets);

  const patternData: RawPatternData = {
    CORNERS: kpCorners,
    EDGES: kpEdges,
    CENTERS: { pieces: [0, 1, 2, 3, 4, 5], orientation: [0, 0, 0, 0, 0, 0], orientationMod: [1, 1, 1, 1, 1, 1] },
  };

  const { KPattern } = await import("cubing/kpuzzle");
  return new KPattern(kpuzzle, patternData as never);
}

/**
 * Builds a KTransformation representing "solved -> this state" directly from facelets, without
 * going through KPattern. This is what <CubeView> feeds to TwistyPlayer's
 * `experimentalModel.setupTransformation` to display an arbitrary state (one that didn't come
 * from a known alg, e.g. a camera scan) — KTransformation's permutation/orientationDelta use the
 * exact same numeric convention as KPattern's pieces/orientation (verified empirically), so no
 * separate conversion is needed beyond the field renaming below.
 */
export async function toKTransformation(facelets: FaceletString) {
  const kpuzzle = await getKPuzzle();
  const { CORNERS: kpCorners, EDGES: kpEdges } = computeKpuzzleOrderedData(facelets);

  const transformationData = {
    CORNERS: { permutation: kpCorners.pieces, orientationDelta: kpCorners.orientation },
    EDGES: { permutation: kpEdges.pieces, orientationDelta: kpEdges.orientation },
    CENTERS: { permutation: [0, 1, 2, 3, 4, 5], orientationDelta: [0, 0, 0, 0, 0, 0] },
  };

  const { KTransformation } = await import("cubing/kpuzzle");
  return new KTransformation(kpuzzle, transformationData);
}

export async function fromKPattern(pattern: KPattern): Promise<FaceletString> {
  const { patternData } = pattern.toJSON() as { patternData: RawPatternData };
  const chars = new Array<string>(54);

  for (let i = 0; i < 6; i++) {
    const face = ["U", "R", "F", "D", "L", "B"][i]!;
    chars[i * 9 + 4] = face;
  }

  for (let kpSlot = 0; kpSlot < 8; kpSlot++) {
    const slotName = KP_CORNER_NAMES[kpSlot]!;
    const ourSlotDef = CORNERS.find((c) => c.id === slotName)!;
    const kpPieceIndex = patternData.CORNERS.pieces[kpSlot]!;
    const kpOrientation = patternData.CORNERS.orientation[kpSlot]!;
    const pieceName = KP_CORNER_NAMES[kpPieceIndex]!;
    const piece = CORNERS.find((c) => c.id === pieceName)!;
    const ourOrientation = (3 - kpOrientation) % 3;
    const letters = rotate3(piece.faces, ourOrientation);
    const [i0, i1, i2] = ourSlotDef.indices;
    chars[i0] = letters[0]!;
    chars[i1] = letters[1]!;
    chars[i2] = letters[2]!;
  }

  for (let kpSlot = 0; kpSlot < 12; kpSlot++) {
    const slotName = KP_EDGE_NAMES[kpSlot]!;
    const ourSlotDef = EDGES.find((e) => e.id === slotName)!;
    const kpPieceIndex = patternData.EDGES.pieces[kpSlot]!;
    const kpOrientation = patternData.EDGES.orientation[kpSlot]!;
    const pieceName = KP_EDGE_NAMES[kpPieceIndex]!;
    const piece = EDGES.find((e) => e.id === pieceName)!;
    const letters: [string, string] = kpOrientation === 0 ? [piece.faces[0], piece.faces[1]] : [piece.faces[1], piece.faces[0]];
    const [i0, i1] = ourSlotDef.indices;
    chars[i0] = letters[0];
    chars[i1] = letters[1];
  }

  return assertFaceletString(chars.join(""));
}
