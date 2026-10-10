import { describe, expect, it } from "vitest";
import { STICKER_COLORS, type StickerColor } from "~/cube/core/colors";
import { JAPANESE_PALETTE_RGB, PASTEL_PALETTE_RGB, STANDARD_PALETTE_RGB } from "../../../../tests/fixtures/scan/synthetic";
import { deltaE2000, rgbToLab, type RGB } from "./color";
import {
  centroidSeparation,
  computeLightingSignature,
  deriveInitialCentroids,
  loadCalibration,
  RECALIBRATE_MEAN_DELTA_E_THRESHOLD,
  refineCentroids,
  saveCalibration,
  shouldRecalibrate,
} from "./calibrate";

function makeRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jitter(rgb: RGB, amount: number, rand: () => number): RGB {
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const j = () => (rand() * 2 - 1) * amount;
  return { r: clamp(rgb.r + j()), g: clamp(rgb.g + j()), b: clamp(rgb.b + j()) };
}

describe("deriveInitialCentroids", () => {
  it("returns the six observed centre samples directly, unmodified", () => {
    const centres = STANDARD_PALETTE_RGB;
    expect(deriveInitialCentroids(centres)).toEqual(centres);
  });
});

describe("refineCentroids", () => {
  it("two k-means iterations pull noisy-centre-derived centroids closer to the true palette", () => {
    const rand = makeRng(42);
    // Simulate a noisy single centre-sticker reading per colour (the naive 003-R8 starting point)...
    const noisyCentres = Object.fromEntries(
      STICKER_COLORS.map((c) => [c, jitter(STANDARD_PALETTE_RGB[c], 15, rand)]),
    ) as Record<StickerColor, RGB>;
    const initial = deriveInitialCentroids(noisyCentres);

    // ...and a larger pool of noisy edge/corner samples drawn from the true palette.
    const samples: RGB[] = [];
    for (const color of STICKER_COLORS) {
      for (let i = 0; i < 20; i++) samples.push(jitter(STANDARD_PALETTE_RGB[color], 15, rand));
    }

    const refined = refineCentroids(initial, samples, 2);

    const meanErrorOf = (palette: Record<StickerColor, RGB>) =>
      STICKER_COLORS.reduce((sum, c) => sum + deltaE2000(rgbToLab(palette[c]), rgbToLab(STANDARD_PALETTE_RGB[c])), 0) /
      STICKER_COLORS.length;

    expect(meanErrorOf(refined)).toBeLessThan(meanErrorOf(initial));
  });

  it("leaves a centroid untouched if no sample is assigned to it", () => {
    const initial = deriveInitialCentroids(STANDARD_PALETTE_RGB);
    const samples = [STANDARD_PALETTE_RGB.W, STANDARD_PALETTE_RGB.W];
    const refined = refineCentroids(initial, samples, 1);
    expect(refined.G).toEqual(STANDARD_PALETTE_RGB.G);
  });
});

describe("centroidSeparation (@003-S9)", () => {
  it.each([
    ["standard", STANDARD_PALETTE_RGB],
    ["Japanese", JAPANESE_PALETTE_RGB],
    ["pastel", PASTEL_PALETTE_RGB],
  ] as const)("%s scheme's six centroids are mutually separated by >= 15 ΔE", (_name, palette) => {
    expect(centroidSeparation(palette)).toBeGreaterThanOrEqual(15);
  });
});

describe("shouldRecalibrate", () => {
  it("is false when average deltaE is well under the threshold", () => {
    const stickers = new Array(9).fill({ color: "W", deltaE: 2, margin: 20, uncertain: false });
    expect(shouldRecalibrate(stickers)).toBe(false);
  });

  it("is true when average deltaE exceeds the threshold", () => {
    const stickers = new Array(9).fill({
      color: "W",
      deltaE: RECALIBRATE_MEAN_DELTA_E_THRESHOLD + 5,
      margin: 20,
      uncertain: false,
    });
    expect(shouldRecalibrate(stickers)).toBe(true);
  });
});

describe("computeLightingSignature", () => {
  it("groups similar-luminance sample sets into the same signature", () => {
    const bright = new Array(5).fill({ r: 200, g: 200, b: 200 }) as RGB[];
    const alsoBright = new Array(5).fill({ r: 205, g: 202, b: 198 }) as RGB[];
    expect(computeLightingSignature(bright)).toBe(computeLightingSignature(alsoBright));
  });

  it("gives different signatures to clearly different luminance levels", () => {
    const bright = new Array(5).fill({ r: 220, g: 220, b: 220 }) as RGB[];
    const dim = new Array(5).fill({ r: 40, g: 40, b: 40 }) as RGB[];
    expect(computeLightingSignature(bright)).not.toBe(computeLightingSignature(dim));
  });
});

class FakeStorage implements Pick<Storage, "getItem" | "setItem"> {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("saveCalibration / loadCalibration", () => {
  it("round-trips a palette through storage", () => {
    const storage = new FakeStorage();
    saveCalibration(STANDARD_PALETTE_RGB, "luma150", storage);
    expect(loadCalibration("luma150", storage)).toEqual(STANDARD_PALETTE_RGB);
  });

  it("returns null for a signature that was never saved", () => {
    const storage = new FakeStorage();
    expect(loadCalibration("never-saved", storage)).toBeNull();
  });
});
