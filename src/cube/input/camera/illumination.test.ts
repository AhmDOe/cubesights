import { describe, expect, it } from "vitest";
import type { StickerColor } from "~/cube/core/colors";
import { renderSolidFace, renderSyntheticFace, STANDARD_PALETTE_RGB } from "../../../../tests/fixtures/scan/synthetic";
import { classifyFrame } from "./classify";
import { computeROI } from "./geometry";
import {
  checkIlluminationGates,
  DARKNESS_MEAN_LUMINANCE_FLOOR,
  normalizeIllumination,
} from "./illumination";

const WIDTH = 1280;
const HEIGHT = 720;
const ROI = computeROI(WIDTH, HEIGHT);
const MIXED_LAYOUT = ["W", "Y", "R", "O", "G", "B", "R", "O", "W"] as const satisfies readonly StickerColor[];

describe("checkIlluminationGates (@003-S10)", () => {
  it("passes a normally-lit mixed face", () => {
    const pixels = renderSyntheticFace(MIXED_LAYOUT, STANDARD_PALETTE_RGB, { seed: 1 });
    expect(checkIlluminationGates(pixels, WIDTH, ROI)).toEqual({ ok: true });
  });

  it("does not false-positive on a genuine solved white face", () => {
    const pixels = renderSolidFace("W", STANDARD_PALETTE_RGB, { seed: 1 });
    expect(checkIlluminationGates(pixels, WIDTH, ROI)).toEqual({ ok: true });
  });

  it("rejects a too-dark frame with a 'more light' hint", () => {
    const pixels = renderSyntheticFace(MIXED_LAYOUT, STANDARD_PALETTE_RGB, { brightness: 0.1, seed: 2 });
    const result = checkIlluminationGates(pixels, WIDTH, ROI);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_dark");
      expect(result.hint).toMatch(/light/i);
    }
  });

  it("rejects a frame with a hard directional glare hotspot, with a 'reduce glare' hint", () => {
    const pixels = renderSyntheticFace(MIXED_LAYOUT, STANDARD_PALETTE_RGB, { seed: 3 });
    // Simulate a specular hotspot: blow out the top third of the ROI to fully-clipped white.
    const x0 = Math.round(ROI.x);
    const x1 = Math.round(ROI.x + ROI.width);
    const y0 = Math.round(ROI.y);
    const y1 = Math.round(ROI.y + ROI.height / 3);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * WIDTH + x) * 4;
        pixels[idx] = 255;
        pixels[idx + 1] = 255;
        pixels[idx + 2] = 255;
      }
    }
    const result = checkIlluminationGates(pixels, WIDTH, ROI);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_much_glare");
      expect(result.hint).toMatch(/glare/i);
    }
  });

  it("sanity: the darkness floor constant is positive and well below full brightness", () => {
    expect(DARKNESS_MEAN_LUMINANCE_FLOOR).toBeGreaterThan(0);
    expect(DARKNESS_MEAN_LUMINANCE_FLOOR).toBeLessThan(255);
  });
});

describe("normalizeIllumination (@003-S10)", () => {
  it("makes the same face classify identically across neutral/warm/cool/low-light variants", () => {
    const variants = {
      neutral: { seed: 10 },
      warm: { tint: { r: 1.15, g: 1.0, b: 0.8 }, seed: 11 },
      cool: { tint: { r: 0.85, g: 1.0, b: 1.2 }, seed: 12 },
      lowLight: { brightness: 0.5, seed: 13 },
    };

    for (const options of Object.values(variants)) {
      const pixels = renderSyntheticFace(MIXED_LAYOUT, STANDARD_PALETTE_RGB, options);
      const normalized = normalizeIllumination(pixels, WIDTH, ROI);
      const reading = classifyFrame(normalized, WIDTH, HEIGHT, STANDARD_PALETTE_RGB);
      expect(reading.stickers.map((s) => s.color)).toEqual(MIXED_LAYOUT);
    }
  });

  it("without normalisation, the warm variant is measurably further (in deltaE) from truth than after normalisation", () => {
    const pixels = renderSyntheticFace(MIXED_LAYOUT, STANDARD_PALETTE_RGB, {
      tint: { r: 1.15, g: 1.0, b: 0.8 },
      seed: 14,
    });
    const rawReading = classifyFrame(pixels, WIDTH, HEIGHT, STANDARD_PALETTE_RGB);
    const normalized = normalizeIllumination(pixels, WIDTH, ROI);
    const normReading = classifyFrame(normalized, WIDTH, HEIGHT, STANDARD_PALETTE_RGB);

    const meanDeltaE = (stickers: typeof rawReading.stickers) =>
      stickers.reduce((sum, s) => sum + s.deltaE, 0) / stickers.length;

    expect(meanDeltaE(normReading.stickers)).toBeLessThan(meanDeltaE(rawReading.stickers));
  });
});
