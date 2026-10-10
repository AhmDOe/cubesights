import { FACE_ORDER, type Face } from "~/cube/core/facelets";
import { ColorResolutionError, resolveColorFaceletsToFacelets, type ColorFacelets, type ObservedColor } from "~/cube/core/colors";
import { validateFacelets } from "~/cube/core/validate";
import { createCubeState, type CubeState } from "~/cube/core/cube-state";
import type { FaceReading } from "./classify";

/**
 * Assembly (003-R10/R11): because the guided flow (003-R7) tells the user exactly how to hold
 * the cube for each of the six prompts — matching facelets.ts's own "each face read row-major
 * from its own top-left with U up and F front" convention — each captured face's 3x3 reading is
 * already in canonical row/col order. Assembly is therefore pure concatenation in U R F D L B
 * order, with no per-face rotation table: the orientation is known because we asked for it, not
 * inferred.
 */

export type AssembleErrorCode = "COLOR_RESOLUTION" | "VALIDATION";

export interface AssembleError {
  readonly code: AssembleErrorCode;
  readonly message: string;
  readonly indices: readonly number[];
}

export type AssembleResult =
  | { readonly ok: true; readonly cubeState: CubeState; readonly colorFacelets: ColorFacelets }
  | { readonly ok: false; readonly error: AssembleError; readonly colorFacelets: ColorFacelets };

export type FaceReadings = Readonly<Record<Face, FaceReading>>;

export function buildColorFacelets(faceReadings: FaceReadings): ColorFacelets {
  const colors = new Array<ObservedColor>(54).fill("unknown");
  for (const face of FACE_ORDER) {
    const base = FACE_ORDER.indexOf(face) * 9;
    const reading = faceReadings[face];
    reading.stickers.forEach((sticker, i) => {
      colors[base + i] = sticker.color;
    });
  }
  return colors;
}

/** 003-R11: stickers surfaced for extra scrutiny in the correction net. */
export const LOW_CONFIDENCE_MARGIN_THRESHOLD = 10;

export function lowConfidenceIndices(faceReadings: FaceReadings): readonly number[] {
  const indices: number[] = [];
  for (const face of FACE_ORDER) {
    const base = FACE_ORDER.indexOf(face) * 9;
    faceReadings[face].stickers.forEach((sticker, i) => {
      if (sticker.uncertain || sticker.margin < LOW_CONFIDENCE_MARGIN_THRESHOLD) indices.push(base + i);
    });
  }
  return indices;
}

export function assemble(faceReadings: FaceReadings): AssembleResult {
  const colorFacelets = buildColorFacelets(faceReadings);

  try {
    const facelets = resolveColorFaceletsToFacelets(colorFacelets);
    const validation = validateFacelets(facelets);
    if (!validation.ok) {
      return {
        ok: false,
        error: { code: "VALIDATION", message: validation.error.message, indices: validation.error.indices },
        colorFacelets,
      };
    }

    const lowConfidenceCount = lowConfidenceIndices(faceReadings).length;
    const confidence = 1 - lowConfidenceCount / 54;
    const cubeState = createCubeState(facelets, "camera", { confidence });
    return { ok: true, cubeState, colorFacelets };
  } catch (e) {
    if (e instanceof ColorResolutionError) {
      return { ok: false, error: { code: "COLOR_RESOLUTION", message: e.message, indices: e.indices }, colorFacelets };
    }
    throw e;
  }
}
