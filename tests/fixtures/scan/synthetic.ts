import { STICKER_COLORS, type StickerColor } from "~/cube/core/colors";
import { computeCells, computeROI } from "~/cube/input/camera/geometry";
import type { RGB } from "~/cube/input/camera/color";
import type { Palette } from "~/cube/input/camera/classify";
import { DEFAULT_PALETTE } from "~/cube/input/camera/calibrate";

/**
 * Synthetic frame generator (003-R15): renders a known 3x3 face with parameterised lighting,
 * standing in for the real 60-photo fixture corpus this ticket calls for — no camera or physical
 * cube was available in this session to produce real photographs (see ticket's Open question R3
 * and this ticket's Verification notes). Used for property-based testing of classifyFrame.
 */

/** The same standard-scheme palette production code bootstraps with (calibrate.ts's
 * DEFAULT_PALETTE), re-exported under this name so existing tests/fixtures referencing it don't
 * need to change — kept as one source of truth rather than two literals that could drift. */
export const STANDARD_PALETTE_RGB: Palette = DEFAULT_PALETTE;

/** A different manufacturer's pigment set (the kind sold as "Japanese scheme" cubes use a
 * noticeably different red/orange than the "standard" set above) — spatial layout conventions
 * don't matter here, only that the six colours themselves differ enough to exercise calibration
 * against a non-default prior. */
export const JAPANESE_PALETTE_RGB: Palette = {
  W: { r: 255, g: 255, b: 255 },
  Y: { r: 255, g: 225, b: 0 },
  R: { r: 200, g: 0, b: 0 },
  O: { r: 255, g: 100, b: 0 },
  G: { r: 0, g: 155, b: 72 },
  B: { r: 0, g: 70, b: 173 },
};

/** A pastel/stickerless-style variant: same six hues, much lower chroma/saturation — the hard
 * case for classification (see ticket Open question R5). */
export const PASTEL_PALETTE_RGB: Palette = {
  W: { r: 245, g: 245, b: 240 },
  Y: { r: 250, g: 230, b: 150 },
  R: { r: 220, g: 140, b: 140 },
  O: { r: 240, g: 180, b: 130 },
  G: { r: 150, g: 210, b: 170 },
  B: { r: 140, g: 170, b: 220 },
};

export interface LightingOptions {
  /** Multiplies all channels — simulates brighter/dimmer scenes. */
  readonly brightness?: number;
  /** Per-channel multiplier — simulates warm (more r, less b) or cool lighting. */
  readonly tint?: RGB;
  /** Uniform random noise added per-pixel per-channel, +/- this amount. */
  readonly noise?: number;
}

function applyLighting(color: RGB, opts: LightingOptions, rand: () => number): RGB {
  const brightness = opts.brightness ?? 1;
  const tint = opts.tint ?? { r: 1, g: 1, b: 1 };
  const noise = opts.noise ?? 0;
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const jitter = () => (noise > 0 ? (rand() * 2 - 1) * noise : 0);
  return {
    r: clamp(color.r * brightness * tint.r + jitter()),
    g: clamp(color.g * brightness * tint.g + jitter()),
    b: clamp(color.b * brightness * tint.b + jitter()),
  };
}

/** Simple deterministic PRNG (mulberry32) so synthetic frames are reproducible given a seed. */
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

export interface SyntheticFaceOptions extends LightingOptions {
  readonly width?: number;
  readonly height?: number;
  readonly background?: RGB;
  readonly seed?: number;
}

/**
 * Renders a full-size (default 1280x720) RGBA frame with the given 9 sticker colours (row-major)
 * placed within the standard ROI/cell geometry, under the given lighting.
 */
export function renderSyntheticFace(
  stickerColors: readonly StickerColor[],
  palette: Palette,
  options: SyntheticFaceOptions = {},
): Uint8ClampedArray {
  if (stickerColors.length !== 9) throw new Error("renderSyntheticFace needs exactly 9 sticker colours");

  const width = options.width ?? 1280;
  const height = options.height ?? 720;
  const background = options.background ?? { r: 40, g: 40, b: 40 };
  const rand = makeRng(options.seed ?? 1);

  const pixels = new Uint8ClampedArray(width * height * 4);
  const bg = applyLighting(background, options, rand);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = bg.r;
    pixels[i * 4 + 1] = bg.g;
    pixels[i * 4 + 2] = bg.b;
    pixels[i * 4 + 3] = 255;
  }

  const roi = computeROI(width, height);
  const cells = computeCells(roi);
  for (let i = 0; i < 9; i++) {
    const cell = cells[i]!;
    const color = applyLighting(palette[stickerColors[i]!], options, rand);
    const x0 = Math.round(cell.x);
    const y0 = Math.round(cell.y);
    const x1 = Math.round(cell.x + cell.width);
    const y1 = Math.round(cell.y + cell.height);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * width + x) * 4;
        pixels[idx] = color.r;
        pixels[idx + 1] = color.g;
        pixels[idx + 2] = color.b;
        pixels[idx + 3] = 255;
      }
    }
  }

  return pixels;
}

/** A standard-scheme solved face (all 9 stickers the same colour) — the simplest useful fixture. */
export function renderSolidFace(color: StickerColor, palette: Palette, options?: SyntheticFaceOptions): Uint8ClampedArray {
  return renderSyntheticFace(new Array(9).fill(color) as StickerColor[], palette, options);
}

export const ALL_STICKER_COLORS = STICKER_COLORS;
