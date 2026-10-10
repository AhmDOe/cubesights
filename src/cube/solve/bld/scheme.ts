import { FACE_ORDER, faceletPositionToIndex, type Face } from "~/cube/core/facelets";
import { faceletToSticker, type Sticker } from "./cubies";

/**
 * Letter schemes (004-R10/T9.2): each of the 24 corner stickers and 24 edge stickers gets its own
 * letter, A-X, so a BLD memo can name a target as "corner A" or "edge Q". Corners and edges use
 * independent A-X alphabets (the same letter can appear on one corner sticker and one edge
 * sticker) because MemoBlock already keeps `cornerTargets`/`edgeTargets` as separate lists, so
 * there's no ambiguity in practice -- and because @004-S14's "bijection over all 48 stickers" is
 * satisfied per piece-type (24 corner stickers <-> 24 letters, 24 edge stickers <-> 24 letters),
 * which is what every published scheme (Speffz included) actually does.
 *
 * IMPORTANT: this file's assignment of *which* position gets *which* letter (the reading order
 * below) is a self-consistent, internally-verified convention, not a verified transcription of
 * the published Speffz lettering. I could not find an unambiguous, authoritative source for the
 * exact Speffz letter-to-position mapping to check this against during this session, and the
 * directive for this work was explicit that an internally-consistent scheme beats an unverified
 * claim of matching an external standard. Nothing downstream depends on matching the published
 * lettering -- only on the scheme being a genuine bijection, which is machine-verified below.
 */

export type LetterSchemeId = string;

export interface LetterScheme {
  readonly id: LetterSchemeId;
  readonly cornerStickerToLetter: ReadonlyMap<Sticker, string>;
  readonly cornerLetterToSticker: ReadonlyMap<string, Sticker>;
  readonly edgeStickerToLetter: ReadonlyMap<Sticker, string>;
  readonly edgeLetterToSticker: ReadonlyMap<string, Sticker>;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWX".split("");

// Reading order within one face's own 3x3 grid, clockwise starting from the top-left-ish slot.
const CORNER_POSITIONS: readonly [number, number][] = [
  [0, 0],
  [0, 2],
  [2, 2],
  [2, 0],
];
const EDGE_POSITIONS: readonly [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 1],
  [1, 0],
];

function readingOrderStickers(face: Face, positions: readonly [number, number][]): Sticker[] {
  return positions.map(([row, col]) => faceletToSticker(faceletPositionToIndex(face, row, col)));
}

function buildScheme(id: LetterSchemeId, cornerOrder: readonly Sticker[], edgeOrder: readonly Sticker[]): LetterScheme {
  if (cornerOrder.length !== 24 || edgeOrder.length !== 24) {
    throw new RangeError(`A letter scheme needs exactly 24 corner stickers and 24 edge stickers`);
  }
  return {
    id,
    cornerStickerToLetter: new Map(cornerOrder.map((s, i) => [s, LETTERS[i]!])),
    cornerLetterToSticker: new Map(cornerOrder.map((s, i) => [LETTERS[i]!, s])),
    edgeStickerToLetter: new Map(edgeOrder.map((s, i) => [s, LETTERS[i]!])),
    edgeLetterToSticker: new Map(edgeOrder.map((s, i) => [LETTERS[i]!, s])),
  };
}

const SPEFFZ_CORNER_ORDER: readonly Sticker[] = FACE_ORDER.flatMap((face) => readingOrderStickers(face, CORNER_POSITIONS));
const SPEFFZ_EDGE_ORDER: readonly Sticker[] = FACE_ORDER.flatMap((face) => readingOrderStickers(face, EDGE_POSITIONS));

export const SPEFFZ_SCHEME: LetterScheme = buildScheme("speffz", SPEFFZ_CORNER_ORDER, SPEFFZ_EDGE_ORDER);

/** Builds a user-defined scheme from explicit 24-long corner/edge sticker orderings (each ordering's
 * position `i` gets letter `LETTERS[i]`). */
export function createCustomScheme(id: LetterSchemeId, cornerOrder: readonly Sticker[], edgeOrder: readonly Sticker[]): LetterScheme {
  return buildScheme(id, cornerOrder, edgeOrder);
}

export interface SchemeValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

function checkBijection(
  stickerToLetter: ReadonlyMap<Sticker, string>,
  letterToSticker: ReadonlyMap<string, Sticker>,
  expectedStickers: readonly Sticker[],
): string[] {
  const errors: string[] = [];
  if (stickerToLetter.size !== 24 || letterToSticker.size !== 24) {
    errors.push(`Expected 24 entries each way, got ${stickerToLetter.size} stickers and ${letterToSticker.size} letters`);
  }
  for (const sticker of expectedStickers) {
    const letter = stickerToLetter.get(sticker);
    if (letter === undefined) {
      errors.push(`Sticker ${sticker} has no letter`);
      continue;
    }
    if (letterToSticker.get(letter) !== sticker) {
      errors.push(`Letter ${letter} does not map back to sticker ${sticker}`);
    }
  }
  for (const letter of LETTERS) {
    const sticker = letterToSticker.get(letter);
    if (sticker === undefined) {
      errors.push(`Letter ${letter} has no sticker`);
      continue;
    }
    if (stickerToLetter.get(sticker) !== letter) {
      errors.push(`Sticker ${sticker} does not map back to letter ${letter}`);
    }
  }
  return errors;
}

export function validateScheme(scheme: LetterScheme): SchemeValidationResult {
  const errors = [
    ...checkBijection(scheme.cornerStickerToLetter, scheme.cornerLetterToSticker, SPEFFZ_CORNER_ORDER),
    ...checkBijection(scheme.edgeStickerToLetter, scheme.edgeLetterToSticker, SPEFFZ_EDGE_ORDER),
  ];
  return { ok: errors.length === 0, errors };
}
