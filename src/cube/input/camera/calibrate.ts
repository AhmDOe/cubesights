import { STICKER_COLORS, type StickerColor } from "~/cube/core/colors";
import { deltaE2000, rgbToLab, type RGB } from "./color";
import type { Palette } from "./classify";
import type { StickerReading } from "./classify";

/**
 * Palette calibration (003-R8): the six centre stickers give one clean sample per colour, which
 * is the initial centroid set. Refining against the edge/corner samples with a couple of k-means
 * iterations pulls the centroids toward the cube's actual pigments and current lighting, which
 * matters most for pastel/stickerless cubes (Open question R5) where the "standard" palette is a
 * poor prior. Cluster *assignment* uses ΔE2000 in CIELAB (perceptually correct); centroid *update*
 * averages in RGB rather than inverting back from a Lab mean (no sRGB<-Lab inverse exists in this
 * codebase, and RGB-space averaging of a tight, already-correctly-clustered bucket is an adequate
 * approximation for this use).
 */

export function deriveInitialCentroids(centerSamples: Record<StickerColor, RGB>): Palette {
  return { ...centerSamples };
}

/**
 * A reasonable standard-scheme bootstrap palette, used before per-cube calibration (003-R8) has
 * run — e.g. the first few frames of a scan, before the six centres have all been seen. Not pure
 * {255,255,255} for white: a real matte sticker never fully saturates every channel, which is
 * what lets the glare gate (illumination.ts) tell a genuine white face apart from a clipped
 * highlight.
 */
export const DEFAULT_PALETTE: Palette = {
  W: { r: 248, g: 248, b: 246 },
  Y: { r: 255, g: 213, b: 0 },
  R: { r: 183, g: 18, b: 52 },
  O: { r: 255, g: 88, b: 0 },
  G: { r: 0, g: 140, b: 70 },
  B: { r: 0, g: 65, b: 151 },
};

function nearestCentroid(sample: RGB, palette: Palette): StickerColor {
  const sampleLab = rgbToLab(sample);
  let best: StickerColor = STICKER_COLORS[0];
  let bestD = Infinity;
  for (const color of STICKER_COLORS) {
    const d = deltaE2000(sampleLab, rgbToLab(palette[color]));
    if (d < bestD) {
      bestD = d;
      best = color;
    }
  }
  return best;
}

function meanRGB(samples: readonly RGB[]): RGB {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const s of samples) {
    r += s.r;
    g += s.g;
    b += s.b;
  }
  return { r: r / samples.length, g: g / samples.length, b: b / samples.length };
}

export function refineCentroids(initial: Palette, samples: readonly RGB[], iterations = 2): Palette {
  let current = initial;
  for (let iter = 0; iter < iterations; iter++) {
    const buckets = Object.fromEntries(STICKER_COLORS.map((c) => [c, [] as RGB[]])) as Record<StickerColor, RGB[]>;
    for (const sample of samples) {
      buckets[nearestCentroid(sample, current)].push(sample);
    }
    const next = { ...current };
    for (const color of STICKER_COLORS) {
      if (buckets[color].length > 0) next[color] = meanRGB(buckets[color]);
    }
    current = next;
  }
  return current;
}

/** The minimum pairwise ΔE2000 across all six centroids (003-R8/@003-S9's separation check). */
export function centroidSeparation(palette: Palette): number {
  let min = Infinity;
  for (const a of STICKER_COLORS) {
    for (const b of STICKER_COLORS) {
      if (a >= b) continue;
      const d = deltaE2000(rgbToLab(palette[a]), rgbToLab(palette[b]));
      if (d < min) min = d;
    }
  }
  return min;
}

export const RECALIBRATE_MEAN_DELTA_E_THRESHOLD = 10;

/** Whether the average ΔE across a face's 9 readings is high enough to offer recalibration. */
export function shouldRecalibrate(stickers: readonly StickerReading[]): boolean {
  const mean = stickers.reduce((sum, s) => sum + s.deltaE, 0) / stickers.length;
  return mean > RECALIBRATE_MEAN_DELTA_E_THRESHOLD;
}

/**
 * A rough, cheap lighting signature (mean luminance bucketed to the nearest 10) used only to key
 * cached calibrations in storage — not a colour-accurate measurement, just enough to tell "same
 * room, same time of day" apart from "moved to a different light".
 */
export function computeLightingSignature(samples: readonly RGB[]): string {
  const meanLuma = samples.reduce((sum, s) => sum + (0.2126 * s.r + 0.7152 * s.g + 0.0722 * s.b), 0) / samples.length;
  return `luma${Math.round(meanLuma / 10) * 10}`;
}

const STORAGE_KEY_PREFIX = "cubesights:calibration:";

export function saveCalibration(palette: Palette, signature: string, storage: Pick<Storage, "setItem">): void {
  storage.setItem(STORAGE_KEY_PREFIX + signature, JSON.stringify(palette));
}

export function loadCalibration(signature: string, storage: Pick<Storage, "getItem">): Palette | null {
  const raw = storage.getItem(STORAGE_KEY_PREFIX + signature);
  if (raw === null) return null;
  return JSON.parse(raw) as Palette;
}
