import { CENTRE_INDICES, FACE_ORDER, assertFaceletString, type Face, type FaceletString } from "./facelets";

/** Observed sticker colours, as seen by the camera, before colour->face resolution (001-R3). */
export const STICKER_COLORS = ["W", "Y", "R", "O", "G", "B"] as const;
export type StickerColor = (typeof STICKER_COLORS)[number];
export type ObservedColor = StickerColor | "unknown";

/** Same 54 slots as FaceletString, holding observed colours instead of resolved faces. */
export type ColorFacelets = readonly ObservedColor[];

export type ColorResolutionErrorCode =
  | "WRONG_LENGTH"
  | "UNKNOWN_CENTRE"
  | "AMBIGUOUS_CENTRES"
  | "UNRESOLVABLE_COLOR";

export class ColorResolutionError extends Error {
  readonly code: ColorResolutionErrorCode;
  readonly indices: readonly number[];

  constructor(code: ColorResolutionErrorCode, indices: readonly number[], message: string) {
    super(message);
    this.name = "ColorResolutionError";
    this.code = code;
    this.indices = indices;
  }
}

/**
 * Maps observed colours to canonical faces using the six centre stickers, so a non-standard
 * colour scheme (Japanese, stickerless pastel, ...) is handled by this one function rather than
 * by special cases scattered through the camera pipeline (001-R3).
 */
export function resolveColorFaceletsToFacelets(colors: ColorFacelets): FaceletString {
  if (colors.length !== 54) {
    throw new ColorResolutionError(
      "WRONG_LENGTH",
      [],
      `Expected 54 colour facelets, got ${colors.length}`,
    );
  }

  const colorToFace = new Map<StickerColor, Face>();

  for (const face of FACE_ORDER) {
    const centreIndex = CENTRE_INDICES[face];
    const color = colors[centreIndex]!;

    if (color === "unknown") {
      throw new ColorResolutionError(
        "UNKNOWN_CENTRE",
        [centreIndex],
        `Centre sticker for face ${face} (index ${centreIndex}) is unknown`,
      );
    }

    const existingFace = colorToFace.get(color);
    if (existingFace !== undefined) {
      const otherIndex = CENTRE_INDICES[existingFace];
      const [lo, hi] = [otherIndex, centreIndex].sort((a, b) => a - b) as [number, number];
      throw new ColorResolutionError(
        "AMBIGUOUS_CENTRES",
        [lo, hi],
        `Centres for ${existingFace} (index ${otherIndex}) and ${face} (index ${centreIndex}) are both ${color}`,
      );
    }

    colorToFace.set(color, face);
  }

  const chars = new Array<string>(54);
  for (let i = 0; i < 54; i++) {
    const color = colors[i]!;
    if (color === "unknown") {
      throw new ColorResolutionError("UNRESOLVABLE_COLOR", [i], `Facelet ${i} has unknown colour`);
    }
    const face = colorToFace.get(color);
    if (face === undefined) {
      throw new ColorResolutionError(
        "UNRESOLVABLE_COLOR",
        [i],
        `Facelet ${i} has colour ${color}, which matches no centre`,
      );
    }
    chars[i] = face;
  }

  return assertFaceletString(chars.join(""));
}
