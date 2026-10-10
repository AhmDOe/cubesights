import { describe, expect, it } from "vitest";
import { STICKER_COLORS } from "~/cube/core/colors";
import { renderSolidFace, renderSyntheticFace, STANDARD_PALETTE_RGB } from "../../../../tests/fixtures/scan/synthetic";
import { rgbToHsv, rgbToLab } from "./color";
import { classifyFrame, classifySticker, UNCERTAIN_MARGIN_THRESHOLD } from "./classify";

describe("classifySticker", () => {
  it.each(STICKER_COLORS)("identifies its own palette centroid as %s with zero ΔE", (color) => {
    const rgb = STANDARD_PALETTE_RGB[color];
    const reading = classifySticker(rgbToLab(rgb), rgbToHsv(rgb), STANDARD_PALETTE_RGB);
    expect(reading.color).toBe(color);
    expect(reading.deltaE).toBeCloseTo(0, 3);
    expect(reading.uncertain).toBe(false);
  });

  it("@003-S7 flags a sticker as uncertain when its margin to the runner-up is below the threshold", () => {
    // A colour exactly halfway (in RGB, a reasonable proxy) between red and orange has a tiny
    // margin between its two nearest centroids.
    const red = STANDARD_PALETTE_RGB.R;
    const orange = STANDARD_PALETTE_RGB.O;
    const midpoint = { r: (red.r + orange.r) / 2, g: (red.g + orange.g) / 2, b: (red.b + orange.b) / 2 };
    const reading = classifySticker(rgbToLab(midpoint), rgbToHsv(midpoint), STANDARD_PALETTE_RGB);
    expect(reading.margin).toBeLessThan(UNCERTAIN_MARGIN_THRESHOLD);
    expect(reading.uncertain).toBe(true);
  });

  it("a clearly-green sample is not flagged uncertain", () => {
    const green = STANDARD_PALETTE_RGB.G;
    const reading = classifySticker(rgbToLab(green), rgbToHsv(green), STANDARD_PALETTE_RGB);
    expect(reading.uncertain).toBe(false);
  });
});

describe("classifyFrame", () => {
  it("classifies a uniform synthetic face as all 9 stickers the same colour", () => {
    for (const color of STICKER_COLORS) {
      const pixels = renderSolidFace(color, STANDARD_PALETTE_RGB, { seed: 7 });
      const reading = classifyFrame(pixels, 1280, 720, STANDARD_PALETTE_RGB);
      expect(reading.stickers).toHaveLength(9);
      for (const sticker of reading.stickers) expect(sticker.color).toBe(color);
    }
  });

  it("classifies a mixed face (one of each colour, repeated) correctly", () => {
    const layout = ["W", "Y", "R", "O", "G", "B", "W", "Y", "R"] as const;
    const pixels = renderSyntheticFace(layout, STANDARD_PALETTE_RGB, { seed: 3 });
    const reading = classifyFrame(pixels, 1280, 720, STANDARD_PALETTE_RGB);
    expect(reading.stickers.map((s) => s.color)).toEqual(layout);
  });

  it("@003-S8 distinguishes red and orange under simulated warm lighting", () => {
    const layout = ["R", "O", "R", "O", "R", "O", "R", "O", "R"] as const;
    // Warm lighting: boosted red channel, slightly reduced blue — the classic failure mode for
    // naive HSV-threshold approaches.
    const pixels = renderSyntheticFace(layout, STANDARD_PALETTE_RGB, {
      tint: { r: 1.12, g: 1.0, b: 0.85 },
      seed: 11,
    });
    const reading = classifyFrame(pixels, 1280, 720, STANDARD_PALETTE_RGB);
    expect(reading.stickers.map((s) => s.color)).toEqual(layout);
    for (const sticker of reading.stickers) expect(sticker.uncertain).toBe(false);
  });
});
