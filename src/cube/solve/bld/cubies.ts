import { CORNERS, EDGES } from "~/cube/core/validate";
import type { Face } from "~/cube/core/facelets";
import type { CubieId, Sticker } from "~/cube/model/solution";

/**
 * Cubie/sticker model (004-R10/T9.1), derived entirely from 001's CORNERS/EDGES tables in
 * validate.ts -- no geometry is re-derived or hand-duplicated here. A "sticker" names one physical
 * sticker by (cubie, face) -- e.g. the ULB corner's sticker on its U face -- which is distinct
 * from a facelet index (a slot in the 54-char string): a sticker is always one of the 48
 * non-centre positions, named in a way a BLD memo can reference ("the UBL corner's U sticker"),
 * while a facelet index is 0-53 including the 6 centres BLD never targets.
 *
 * `Sticker`/`CubieId` are the branded types already defined in ~/cube/model/solution (MemoBlock's
 * own Target type uses them) -- reused here rather than redeclared, so a sticker produced by this
 * module is directly usable wherever the result model expects one.
 */

export type { CubieId, Sticker };

export type PieceType = "corner" | "edge";

export interface CubieSticker {
  readonly sticker: Sticker;
  readonly cubie: CubieId;
  readonly face: Face;
  /** This sticker's facelet index in the SOLVED cube -- i.e. its home slot. */
  readonly facelet: number;
  readonly pieceType: PieceType;
}

function makeSticker(cubieId: string, face: Face): Sticker {
  return `${cubieId}:${face}` as Sticker;
}

export const CORNER_STICKERS: readonly CubieSticker[] = CORNERS.flatMap((corner) =>
  corner.faces.map(
    (face, i): CubieSticker => ({
      sticker: makeSticker(corner.id, face),
      cubie: corner.id as CubieId,
      face,
      facelet: corner.indices[i]!,
      pieceType: "corner",
    }),
  ),
);

export const EDGE_STICKERS: readonly CubieSticker[] = EDGES.flatMap((edge) =>
  edge.faces.map(
    (face, i): CubieSticker => ({
      sticker: makeSticker(edge.id, face),
      cubie: edge.id as CubieId,
      face,
      facelet: edge.indices[i]!,
      pieceType: "edge",
    }),
  ),
);

export const ALL_STICKERS: readonly CubieSticker[] = [...CORNER_STICKERS, ...EDGE_STICKERS];

const BY_STICKER = new Map<Sticker, CubieSticker>(ALL_STICKERS.map((s) => [s.sticker, s]));
const BY_FACELET = new Map<number, CubieSticker>(ALL_STICKERS.map((s) => [s.facelet, s]));

export function stickerInfo(sticker: Sticker): CubieSticker {
  const info = BY_STICKER.get(sticker);
  if (!info) throw new RangeError(`Unknown sticker: ${sticker}`);
  return info;
}

export function stickerToFacelet(sticker: Sticker): number {
  return stickerInfo(sticker).facelet;
}

export function faceletToSticker(facelet: number): Sticker {
  const info = BY_FACELET.get(facelet);
  if (!info) throw new RangeError(`Facelet ${facelet} is not a sticker (it may be a centre)`);
  return info.sticker;
}

export function cubieStickers(cubie: CubieId, pieceType: PieceType): readonly CubieSticker[] {
  const source = pieceType === "corner" ? CORNER_STICKERS : EDGE_STICKERS;
  return source.filter((s) => s.cubie === cubie);
}
