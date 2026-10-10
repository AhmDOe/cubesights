import { describe, expect, it } from "vitest";
import { deltaE2000, rgbToLab, type RGB } from "./color";
import { sampleCell, sampleRegionMeanRGB, sampleRegionMedianRGB } from "./sampling";
import type { Rect } from "./geometry";

/** Builds a flat RGBA buffer of `width`x`height`, filled with `base`, with an optional patch. */
function buildBuffer(
  width: number,
  height: number,
  base: RGB,
  patch?: { region: Rect; color: RGB },
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const inPatch =
        patch && x >= patch.region.x && x < patch.region.x + patch.region.width && y >= patch.region.y && y < patch.region.y + patch.region.height;
      const c = inPatch ? patch.color : base;
      pixels[idx] = c.r;
      pixels[idx + 1] = c.g;
      pixels[idx + 2] = c.b;
      pixels[idx + 3] = 255;
    }
  }
  return pixels;
}

describe("sampleRegionMedianRGB", () => {
  it("returns the exact colour of a uniform region", () => {
    const width = 20;
    const pixels = buildBuffer(width, 20, { r: 200, g: 50, b: 30 });
    const rgb = sampleRegionMedianRGB(pixels, width, { x: 2, y: 2, width: 16, height: 16 });
    expect(rgb).toEqual({ r: 200, g: 50, b: 30 });
  });

  it("is robust to a specular highlight: the median barely moves while the mean shifts substantially more", () => {
    const width = 20;
    const region: Rect = { x: 0, y: 0, width: 20, height: 20 };
    const base: RGB = { r: 180, g: 20, b: 50 }; // a cube-red
    // A bright near-white specular highlight covering a corner patch (~9% of the region) — large
    // enough to visibly drag a mean, small enough that it can never be the per-channel median.
    const pixels = buildBuffer(width, 20, base, {
      region: { x: 0, y: 0, width: 6, height: 6 },
      color: { r: 255, g: 255, b: 255 },
    });

    const median = sampleRegionMedianRGB(pixels, width, region);
    const mean = sampleRegionMeanRGB(pixels, width, region);

    const baseLab = rgbToLab(base);
    const medianShift = deltaE2000(baseLab, rgbToLab(median));
    const meanShift = deltaE2000(baseLab, rgbToLab(mean));

    expect(medianShift).toBeLessThan(2);
    expect(meanShift).toBeGreaterThan(medianShift * 3);
  });
});

describe("sampleCell", () => {
  it("returns consistent rgb/lab/hsv for a known colour", () => {
    const width = 10;
    const pixels = buildBuffer(width, 10, { r: 0, g: 255, b: 0 });
    const sample = sampleCell(pixels, width, { x: 1, y: 1, width: 8, height: 8 });
    expect(sample.rgb).toEqual({ r: 0, g: 255, b: 0 });
    expect(sample.hsv.h).toBeCloseTo(120, 3);
    expect(sample.lab.a).toBeLessThan(0); // green is on the -a* axis
  });
});
