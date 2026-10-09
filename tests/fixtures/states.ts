import { SOLVED_FACELETS, faceletPositionToIndex, type FaceletString } from "~/cube/core/facelets";
import type { ColorFacelets } from "~/cube/core/colors";
import { EDGES, CORNERS } from "~/cube/core/validate";

function mutate(base: FaceletString, edits: Record<number, string>): FaceletString {
  const chars = base.split("");
  for (const [indexStr, value] of Object.entries(edits)) {
    chars[Number(indexStr)] = value;
  }
  return chars.join("") as FaceletString;
}

export const SOLVED: FaceletString = SOLVED_FACELETS;

/** Superflip: identity permutation, every one of the 12 edges flipped in place. Legally reachable. */
export const SUPERFLIP: FaceletString = (() => {
  const edits: Record<number, string> = {};
  for (const edge of EDGES) {
    const [i0, i1] = edge.indices;
    edits[i0] = SOLVED[i1]!;
    edits[i1] = SOLVED[i0]!;
  }
  return mutate(SOLVED, edits);
})();

/** Exactly one edge (UF) flipped in place — everything else solved. Invalid: fails edge parity. */
export const ONE_FLIPPED_EDGE: FaceletString = (() => {
  const uf = EDGES.find((e) => e.id === "UF")!;
  const [i0, i1] = uf.indices;
  return mutate(SOLVED, { [i0]: SOLVED[i1]!, [i1]: SOLVED[i0]! });
})();

/** Exactly one corner (URF) twisted in place by one step — everything else solved. Invalid: fails corner parity. */
export const ONE_TWISTED_CORNER: FaceletString = (() => {
  const urf = CORNERS.find((c) => c.id === "URF")!;
  const [i0, i1, i2] = urf.indices;
  // rotate the three stickers one step: (a,b,c) -> (c,a,b)
  return mutate(SOLVED, { [i0]: SOLVED[i2]!, [i1]: SOLVED[i0]!, [i2]: SOLVED[i1]! });
})();

/** The URF and UBR corner pieces swapped wholesale, orientation-preserving. Invalid: permutation parity. */
export const TWO_SWAPPED_CORNERS: FaceletString = (() => {
  const urf = CORNERS.find((c) => c.id === "URF")!;
  const ubr = CORNERS.find((c) => c.id === "UBR")!;
  const [a0, a1, a2] = urf.indices;
  const [b0, b1, b2] = ubr.indices;
  return mutate(SOLVED, {
    [a0]: SOLVED[b0]!,
    [a1]: SOLVED[b1]!,
    [a2]: SOLVED[b2]!,
    [b0]: SOLVED[a0]!,
    [b1]: SOLVED[a1]!,
    [b2]: SOLVED[a2]!,
  });
})();

/** 10 U stickers, 8 D stickers (one D sticker overwritten with U) — everything else solved. Invalid: facelet count. */
export const WRONG_COUNTS: FaceletString = (() => {
  return mutate(SOLVED, { [faceletPositionToIndex("D", 1, 0)]: "U" });
})();

/** Colour facelets (standard scheme) where the R and O centres are both reported as the same colour. */
export const DUPLICATE_CENTRES_COLORS: ColorFacelets = (() => {
  const colors: string[] = new Array(54).fill("W");
  // Build a plausible standard-scheme colour layout, then corrupt two centres to collide.
  const faceColor: Record<string, string> = { U: "W", R: "R", F: "G", D: "Y", L: "O", B: "B" };
  const faces = ["U", "R", "F", "D", "L", "B"] as const;
  for (let f = 0; f < faces.length; f++) {
    for (let i = 0; i < 9; i++) colors[f * 9 + i] = faceColor[faces[f]!]!;
  }
  // Corrupt: make the L centre (index 4*9+4=40) report "R" instead of "O", colliding with R's centre.
  colors[40] = "R";
  return colors as unknown as ColorFacelets;
})();

/**
 * TODO (deferred to when applyMoves/scramble land, tickets 001-T5.3/001-T6):
 * - CHECKERBOARD: derive via applyMoves(SOLVED, parseAlg("U2 D2 F2 B2 L2 R2")) once applyMoves
 *   exists, rather than hand-encoding a pattern that's easy to get subtly wrong.
 * - SCRAMBLES_50: a frozen list of 50 WCA-legal scrambles, generated once via generateScramble()
 *   and pinned here so property tests are deterministic across runs.
 */
