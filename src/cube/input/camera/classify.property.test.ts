import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { STICKER_COLORS, type StickerColor } from "~/cube/core/colors";
import { PASTEL_PALETTE_RGB, renderSyntheticFace, STANDARD_PALETTE_RGB } from "../../../../tests/fixtures/scan/synthetic";
import { classifyFrame } from "./classify";

/**
 * Property-based test (003-R13's TDD plan): across random palettes x random illuminants x random
 * faces, classifyFrame should recover each sticker's true colour with >=99% per-sticker accuracy,
 * and never silently produce a *different but still-valid-looking* colour for every sticker on a
 * face (the "wrong but plausible" failure mode that a naive per-sticker accuracy number could
 * hide if errors were correlated across a whole face).
 *
 * Illuminant range here is deliberately "good lighting" (003-R12): classify.ts's own job is
 * nearest-centroid + hue tiebreak on pixels that have *already* been through 003-R6's grey-world
 * normalisation, so it only needs to tolerate the residual jitter normalisation doesn't fully
 * remove, not raw uncorrected warm/cool drift. The much harder 95%-under-"difficult"-light target
 * applies to the full pipeline (classify + illumination.ts) against the real fixture corpus, via
 * tests/integration/scan-corpus.test.ts — not to this module in isolation (see Open question R5
 * in the PRD re: pastel/stickerless chroma separation).
 */

const palette = fc.constantFrom(STANDARD_PALETTE_RGB, PASTEL_PALETTE_RGB);
const stickerColor = fc.constantFrom(...STICKER_COLORS);
const layout = fc.array<StickerColor>(stickerColor, { minLength: 9, maxLength: 9 });
const illuminant = fc.record({
  brightness: fc.double({ min: 0.92, max: 1.08, noNaN: true }),
  tint: fc.record({
    r: fc.double({ min: 0.96, max: 1.05, noNaN: true }),
    g: fc.double({ min: 0.97, max: 1.03, noNaN: true }),
    b: fc.double({ min: 0.95, max: 1.04, noNaN: true }),
  }),
  noise: fc.double({ min: 0, max: 4, noNaN: true }),
});

describe("classifyFrame (property-based, @003-S8)", () => {
  it("recovers >=99% of stickers correctly across random palettes/illuminants/faces", () => {
    let correct = 0;
    let total = 0;
    let wholeFaceWrong = 0;
    let faces = 0;

    fc.assert(
      fc.property(palette, layout, illuminant, fc.integer({ min: 0, max: 2 ** 31 - 1 }), (pal, faceLayout, light, seed) => {
        const pixels = renderSyntheticFace(faceLayout, pal, { ...light, seed });
        const reading = classifyFrame(pixels, 1280, 720, pal);

        faces++;
        let faceWrong = 0;
        reading.stickers.forEach((sticker, i) => {
          total++;
          if (sticker.color === faceLayout[i]) correct++;
          else faceWrong++;
        });
        if (faceWrong === 9) wholeFaceWrong++;
      }),
      { numRuns: 300 },
    );

    expect(correct / total).toBeGreaterThanOrEqual(0.99);
    // A face where every single sticker is wrong (and self-consistently so) would indicate a
    // systematic failure mode (e.g. a swapped palette) rather than independent per-sticker noise.
    expect(wholeFaceWrong).toBe(0);
    expect(faces).toBe(300);
  });
});
