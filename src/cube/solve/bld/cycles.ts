import type { CubeState } from "~/cube/core/cube-state";
import type { Face } from "~/cube/core/facelets";
import { CORNERS, EDGES, validateFacelets } from "~/cube/core/validate";
import { stickerInfo, type CubieId, type Sticker } from "./cubies";
import type { LetterScheme } from "./scheme";

/**
 * Cycle decomposition (004-R10/T9.3): BLD has no search space -- it's a solved permutation-theory
 * problem. This module computes, for one piece type (corners or edges) and a chosen buffer, the
 * exact ordered target sequence a solver executes, purely from the input state's permutation --
 * no real moves are simulated or executed here. setup.ts separately verifies that its real
 * algorithms perform the abstract 2-swap this module assumes; decoupling the two means each is
 * independently testable (this file's own correctness claim -- "replaying these swaps solves the
 * cube" -- is checked by cycles.property.test.ts via pure permutation simulation).
 *
 * Mechanics, worked through from the buffer's perspective: the buffer is a fixed home SLOT, read
 * at a fixed reference face (its "component 0", matching both the OP corner buffer UBL/U, the OP
 * edge buffer UR/U, and the M2 edge buffer DF/D -- all happen to be component 0 of their slot's
 * own `faces` tuple, which is this module's one hard assumption, checked at runtime). Reading the
 * buffer tells you which piece is physically there (its target letter); shooting it home swaps it
 * with whatever was originally sitting at *its* home slot, which becomes the buffer's new content
 * -- so the next target is read from that piece's *original* slot, not simulated state. A cycle
 * closes when the buffer's own home piece arrives. If pieces outside that cycle remain unsolved,
 * cycle-breaking starts a fresh cycle at the first remaining unsolved slot (array order), reading
 * its content as the new cycle's first target exactly like the real buffer would.
 */

interface SlotAnalysis {
  readonly pieceAtSlot: CubieId;
  readonly orientation: number;
  readonly referenceFace: Face;
}

interface PieceDef {
  readonly id: string;
  readonly faces: readonly string[];
  readonly indices: readonly number[];
}

/** The rotation amount o (0..n-1) such that reading piece.faces starting o positions in, wrapping
 * modulo its own length, reproduces `read` exactly. Written generally so it's correct for both
 * 3-length corners and 2-length edges without reusing validate.ts's 3-tuple-only rotate3. */
function orientationOf(pieceFaces: readonly string[], read: readonly string[]): number {
  const n = pieceFaces.length;
  for (let o = 0; o < n; o++) {
    let matches = true;
    for (let i = 0; i < n; i++) {
      if (pieceFaces[(o + i) % n] !== read[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return o;
  }
  throw new RangeError(`No orientation of [${pieceFaces.join(",")}] reproduces [${read.join(",")}]`);
}

function analyze(facelets: string, defs: readonly PieceDef[]): SlotAnalysis[] {
  return defs.map((def) => {
    const read = def.indices.map((i) => facelets[i]!);
    const readSet = new Set(read);
    const pieceIndex = defs.findIndex((p) => {
      const s = new Set(p.faces);
      return s.size === readSet.size && [...s].every((f) => readSet.has(f));
    });
    const piece = defs[pieceIndex]!;
    const orientation = orientationOf(piece.faces, read);
    return { pieceAtSlot: piece.id as CubieId, orientation, referenceFace: read[0] as Face };
  });
}

export interface CycleTarget {
  readonly sticker: Sticker;
  readonly letter: string;
  readonly cubie: CubieId;
  /** The home-slot index this target was read from -- the virtual buffer slot active for its
   * cycle (the real buffer's own slot for the first cycle, or that cycle-break's start slot for
   * later ones). Exposed mainly so cycles.property.test.ts can replay the exact swap sequence
   * without re-deriving cycle boundaries from the flat target list. */
  readonly fromSlot: number;
}

export interface PieceTypeResult {
  readonly targets: readonly CycleTarget[];
  readonly solvedInPlace: readonly CubieId[];
  readonly misoriented: readonly CycleTarget[]; // flipped edges / twisted corners, solved in position
}

function makeTarget(cubie: CubieId, face: Face, fromSlot: number, scheme: LetterScheme, pieceType: "corner" | "edge"): CycleTarget {
  const sticker = `${cubie}:${face}` as Sticker;
  const letterMap = pieceType === "corner" ? scheme.cornerStickerToLetter : scheme.edgeStickerToLetter;
  const letter = letterMap.get(sticker);
  if (letter === undefined) throw new RangeError(`Scheme ${scheme.id} has no letter for sticker ${sticker}`);
  return { sticker, letter, cubie, fromSlot };
}

function decomposePieceType(
  defs: readonly PieceDef[],
  analyses: readonly SlotAnalysis[],
  bufferCubie: CubieId,
  bufferFace: Face,
  scheme: LetterScheme,
  pieceType: "corner" | "edge",
): PieceTypeResult {
  const bufferSlot = defs.findIndex((d) => d.id === bufferCubie);
  if (bufferSlot === -1) throw new RangeError(`Buffer cubie ${bufferCubie} is not a known ${pieceType}`);
  if (defs[bufferSlot]!.faces[0] !== bufferFace) {
    throw new RangeError(
      `Buffer face ${bufferFace} must be the reference (first) face of ${bufferCubie}'s home slot (${defs[bufferSlot]!.faces[0]})`,
    );
  }

  const homeSlotOf = new Map<string, number>(defs.map((d, i) => [d.id, i]));
  const solvedInPlace: CubieId[] = [];
  const misoriented: CycleTarget[] = [];
  const visited = new Array<boolean>(defs.length).fill(false);

  for (let slot = 0; slot < defs.length; slot++) {
    const analysis = analyses[slot]!;
    if (analysis.pieceAtSlot === defs[slot]!.id) {
      visited[slot] = true;
      if (analysis.orientation === 0) {
        solvedInPlace.push(analysis.pieceAtSlot);
      } else {
        misoriented.push(makeTarget(analysis.pieceAtSlot, analysis.referenceFace, slot, scheme, pieceType));
      }
    }
  }

  const targets: CycleTarget[] = [];

  function runCycle(startSlot: number): void {
    const bufferForThisCycle = startSlot; // the virtual buffer slot stays fixed for the whole cycle.
    let currentSlot = startSlot;
    const startPiece = defs[startSlot]!.id;
    for (;;) {
      visited[currentSlot] = true;
      const analysis = analyses[currentSlot]!;
      const currentPiece = analysis.pieceAtSlot;
      if (currentPiece === startPiece) return; // this cycle has closed.
      targets.push(makeTarget(currentPiece, analysis.referenceFace, bufferForThisCycle, scheme, pieceType));
      currentSlot = homeSlotOf.get(currentPiece)!;
    }
  }

  runCycle(bufferSlot);
  for (let slot = 0; slot < defs.length; slot++) {
    if (!visited[slot]) runCycle(slot);
  }

  return { targets, solvedInPlace, misoriented };
}

export interface BldBuffer {
  readonly corners: Sticker;
  readonly edges: Sticker;
}

export interface DecomposeResult {
  readonly scheme: string;
  readonly cornerTargets: readonly CycleTarget[];
  readonly edgeTargets: readonly CycleTarget[];
  readonly solvedCorners: readonly CubieId[];
  readonly solvedEdges: readonly CubieId[];
  readonly twistedCorners: readonly CycleTarget[];
  readonly flippedEdges: readonly CycleTarget[];
  readonly parity: boolean;
}

export function decompose(state: CubeState, buffer: BldBuffer, scheme: LetterScheme): DecomposeResult {
  const validation = validateFacelets(state.facelets);
  if (!validation.ok) {
    throw new RangeError(`Cannot decompose an invalid cube state: ${validation.error.message}`);
  }

  const cornerBuffer = stickerInfo(buffer.corners);
  const edgeBuffer = stickerInfo(buffer.edges);

  const cornerAnalyses = analyze(state.facelets, CORNERS);
  const edgeAnalyses = analyze(state.facelets, EDGES);

  const cornerResult = decomposePieceType(CORNERS, cornerAnalyses, cornerBuffer.cubie, cornerBuffer.face, scheme, "corner");
  const edgeResult = decomposePieceType(EDGES, edgeAnalyses, edgeBuffer.cubie, edgeBuffer.face, scheme, "edge");

  return {
    scheme: scheme.id,
    cornerTargets: cornerResult.targets,
    edgeTargets: edgeResult.targets,
    solvedCorners: cornerResult.solvedInPlace,
    solvedEdges: edgeResult.solvedInPlace,
    twistedCorners: cornerResult.misoriented,
    flippedEdges: edgeResult.misoriented,
    parity: edgeResult.targets.length % 2 === 1,
  };
}
