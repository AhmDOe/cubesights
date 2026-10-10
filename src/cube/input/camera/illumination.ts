import type { Rect } from "./geometry";

/**
 * Illumination adaptation (003-R9): grey-world/white-patch normalisation using the brightest 5%
 * of ROI pixels as the white point, so a tinted or shadowed scene is corrected back toward
 * neutral before classification runs. The darkness and glare gates run on the *raw* frame (before
 * normalisation can mask either problem) and give a one-line, actionable hint rather than
 * silently misclassifying.
 *
 * Glare detection deliberately keys on fully-clipped, desaturated pixels (min channel >= 253)
 * rather than "near white", because a genuine solved white face is uniformly bright but never
 * fully saturated on every channel — see the comment on STANDARD_PALETTE_RGB.W in the synthetic
 * fixture generator. A real specular highlight blows out all three channels; a matte sticker does
 * not.
 */

interface RGBA {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

function luminance({ r, g, b }: RGBA): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function* roiPixels(pixels: Uint8ClampedArray, imageWidth: number, roi: Rect): Generator<{ idx: number; rgb: RGBA }> {
  const x0 = Math.round(roi.x);
  const y0 = Math.round(roi.y);
  const x1 = Math.round(roi.x + roi.width);
  const y1 = Math.round(roi.y + roi.height);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * imageWidth + x) * 4;
      yield { idx, rgb: { r: pixels[idx]!, g: pixels[idx + 1]!, b: pixels[idx + 2]! } };
    }
  }
}

/** The average colour of the brightest 5% (by luminance) of ROI pixels — the white-point estimate. */
export function computeWhitePoint(pixels: Uint8ClampedArray, imageWidth: number, roi: Rect): RGBA {
  const samples = [...roiPixels(pixels, imageWidth, roi)].map(({ rgb }) => rgb);
  samples.sort((a, b) => luminance(b) - luminance(a));
  const topCount = Math.max(1, Math.round(samples.length * 0.05));
  const top = samples.slice(0, topCount);
  let r = 0;
  let g = 0;
  let b = 0;
  for (const s of top) {
    r += s.r;
    g += s.g;
    b += s.b;
  }
  return { r: r / top.length, g: g / top.length, b: b / top.length };
}

/** Scales every pixel so the ROI's estimated white point maps to neutral (255,255,255). */
export function normalizeIllumination(pixels: Uint8ClampedArray, imageWidth: number, roi: Rect): Uint8ClampedArray {
  const white = computeWhitePoint(pixels, imageWidth, roi);
  const gain = {
    r: 255 / Math.max(white.r, 1),
    g: 255 / Math.max(white.g, 1),
    b: 255 / Math.max(white.b, 1),
  };
  const out = new Uint8ClampedArray(pixels);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = out[i]! * gain.r;
    out[i + 1] = out[i + 1]! * gain.g;
    out[i + 2] = out[i + 2]! * gain.b;
  }
  return out;
}

export const DARKNESS_MEAN_LUMINANCE_FLOOR = 40;
export const GLARE_CLIP_THRESHOLD = 253;
export const GLARE_PIXEL_FRACTION_THRESHOLD = 0.08;

export type IlluminationGateResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "too_dark"; readonly hint: string }
  | { readonly ok: false; readonly reason: "too_much_glare"; readonly hint: string };

export function checkIlluminationGates(pixels: Uint8ClampedArray, imageWidth: number, roi: Rect): IlluminationGateResult {
  let sumLuma = 0;
  let clipped = 0;
  let n = 0;
  for (const { rgb } of roiPixels(pixels, imageWidth, roi)) {
    sumLuma += luminance(rgb);
    if (Math.min(rgb.r, rgb.g, rgb.b) >= GLARE_CLIP_THRESHOLD) clipped++;
    n++;
  }
  const meanLuma = sumLuma / n;

  if (meanLuma < DARKNESS_MEAN_LUMINANCE_FLOOR) {
    return { ok: false, reason: "too_dark", hint: "Add more light" };
  }
  if (clipped / n > GLARE_PIXEL_FRACTION_THRESHOLD) {
    return { ok: false, reason: "too_much_glare", hint: "Reduce glare — tilt the cube or move away from direct light" };
  }
  return { ok: true };
}
