import { STICKER_COLORS, type StickerColor } from "~/cube/core/colors";
import { deltaE2000, rgbToHsv, rgbToLab, type RGB } from "./color";
import { computeCells, computeROI, computeSampleRegion } from "./geometry";
import { sampleCell } from "./sampling";

/**
 * Classification (003-R5) and the deterministic test seam (003-R13): classifyFrame is a pure
 * function from pixels to a FaceReading. The camera, worker and RAF loop are thin shells around
 * it — every test in this module drives it directly with fixture pixels, no DOM involved.
 */

export type Palette = Record<StickerColor, RGB>;

export interface StickerReading {
  readonly color: StickerColor;
  readonly deltaE: number;
  readonly margin: number;
  readonly uncertain: boolean;
}

export interface FaceReading {
  readonly stickers: readonly StickerReading[]; // 9, row-major (index = row * 3 + col)
}

export const UNCERTAIN_MARGIN_THRESHOLD = 6;

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function classifySticker(
  sampleLab: ReturnType<typeof rgbToLab>,
  sampleHsv: ReturnType<typeof rgbToHsv>,
  palette: Palette,
): StickerReading {
  const distances = STICKER_COLORS.map((color) => ({
    color,
    d: deltaE2000(sampleLab, rgbToLab(palette[color])),
  })).sort((a, b) => a.d - b.d);

  let [best, runnerUp] = distances as [(typeof distances)[number], (typeof distances)[number]];

  // Red/orange hue tiebreak (003-R5): the one genuinely hard discrimination on a standard cube —
  // red and orange are ~25deg apart in hue and both drift together under warm light, so when
  // they're the top two ΔE candidates, hue proximity to each centroid's own hue is the more
  // reliable signal.
  if ((best.color === "R" || best.color === "O") && (runnerUp.color === "R" || runnerUp.color === "O")) {
    const redHue = rgbToHsv(palette.R).h;
    const orangeHue = rgbToHsv(palette.O).h;
    const closerToRed = hueDistance(sampleHsv.h, redHue) <= hueDistance(sampleHsv.h, orangeHue);
    const huePreferred = closerToRed ? "R" : "O";
    if (huePreferred !== best.color) [best, runnerUp] = [runnerUp, best];
  }

  const margin = runnerUp.d - best.d;
  return { color: best.color, deltaE: best.d, margin, uncertain: margin < UNCERTAIN_MARGIN_THRESHOLD };
}

export function classifyFrame(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  palette: Palette,
): FaceReading {
  const roi = computeROI(imageWidth, imageHeight);
  const cells = computeCells(roi);
  const stickers = cells.map((cell) => {
    const region = computeSampleRegion(cell);
    const { lab, hsv } = sampleCell(pixels, imageWidth, region);
    return classifySticker(lab, hsv, palette);
  });
  return { stickers };
}
