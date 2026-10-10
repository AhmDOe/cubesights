import { rgbToHsv, rgbToLab, type HSV, type Lab, type RGB } from "./color";
import type { Rect } from "./geometry";

/**
 * Per-cell colour sampling (003-R4): median (not mean) RGB over the sample region, converted to
 * both CIELAB and HSV. Median is the one choice that removes most of the glare failure mode — a
 * single specular highlight on a glossy sticker drags a mean several ΔE units, but the median of
 * a 40%-area sample region ignores it outright.
 */

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Reads RGBA pixels (as from ImageData.data) within `region` and returns the per-channel median. */
export function sampleRegionMedianRGB(pixels: Uint8ClampedArray, imageWidth: number, region: Rect): RGB {
  const x0 = Math.round(region.x);
  const y0 = Math.round(region.y);
  const x1 = Math.round(region.x + region.width);
  const y1 = Math.round(region.y + region.height);

  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * imageWidth + x) * 4;
      reds.push(pixels[idx]!);
      greens.push(pixels[idx + 1]!);
      blues.push(pixels[idx + 2]!);
    }
  }

  return { r: median(reds), g: median(greens), b: median(blues) };
}

/** Same as sampleRegionMedianRGB but computes the mean instead — used only to demonstrate/test
 * median's robustness against specular highlights; never used in the real classification path. */
export function sampleRegionMeanRGB(pixels: Uint8ClampedArray, imageWidth: number, region: Rect): RGB {
  const x0 = Math.round(region.x);
  const y0 = Math.round(region.y);
  const x1 = Math.round(region.x + region.width);
  const y1 = Math.round(region.y + region.height);

  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * imageWidth + x) * 4;
      r += pixels[idx]!;
      g += pixels[idx + 1]!;
      b += pixels[idx + 2]!;
      n++;
    }
  }
  return { r: r / n, g: g / n, b: b / n };
}

export interface CellSample {
  readonly rgb: RGB;
  readonly lab: Lab;
  readonly hsv: HSV;
}

export function sampleCell(pixels: Uint8ClampedArray, imageWidth: number, region: Rect): CellSample {
  const rgb = sampleRegionMedianRGB(pixels, imageWidth, region);
  return { rgb, lab: rgbToLab(rgb), hsv: rgbToHsv(rgb) };
}
