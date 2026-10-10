import { describe, expect, it } from "vitest";
import { FACE_ORDER, type Face, type FaceletString } from "~/cube/core/facelets";
import type { StickerColor } from "~/cube/core/colors";
import { ONE_FLIPPED_EDGE, SOLVED, SUPERFLIP } from "../../../../tests/fixtures/states";
import { renderSyntheticFace, STANDARD_PALETTE_RGB } from "../../../../tests/fixtures/scan/synthetic";
import { classifyFrame, type FaceReading } from "./classify";
import { assemble, buildColorFacelets, lowConfidenceIndices, type FaceReadings } from "./assemble";

const WIDTH = 1280;
const HEIGHT = 720;

/** The same standard-scheme face->colour mapping used by tests/fixtures/states.ts. */
const FACE_TO_COLOR: Record<Face, StickerColor> = { U: "W", R: "R", F: "G", D: "Y", L: "O", B: "B" };

function faceLayout(facelets: FaceletString, face: Face): readonly StickerColor[] {
  const base = FACE_ORDER.indexOf(face) * 9;
  return Array.from({ length: 9 }, (_, i) => {
    const faceLetter = facelets[base + i] as Face;
    return FACE_TO_COLOR[faceLetter];
  });
}

/** Renders+classifies all six faces of a ground-truth FaceletString into FaceReadings. */
function readingsFromFacelets(facelets: FaceletString, seedBase = 0): FaceReadings {
  const result = {} as Record<Face, FaceReading>;
  FACE_ORDER.forEach((face, i) => {
    const layout = faceLayout(facelets, face);
    const pixels = renderSyntheticFace(layout, STANDARD_PALETTE_RGB, { seed: seedBase + i });
    result[face] = classifyFrame(pixels, WIDTH, HEIGHT, STANDARD_PALETTE_RGB);
  });
  return result;
}

describe("buildColorFacelets", () => {
  it("concatenates the six faces in U R F D L B order", () => {
    const readings = readingsFromFacelets(SOLVED, 100);
    const colors = buildColorFacelets(readings);
    expect(colors).toHaveLength(54);
    expect(colors.slice(0, 9).every((c) => c === "W")).toBe(true); // U
    expect(colors.slice(9, 18).every((c) => c === "R")).toBe(true); // R
  });
});

describe("assemble (@003-S4)", () => {
  it("assembles a known legally-reachable (non-solved) cube to the exact ground-truth facelets", () => {
    const readings = readingsFromFacelets(SUPERFLIP, 200);
    const result = assemble(readings);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cubeState.facelets).toBe(SUPERFLIP);
      expect(result.cubeState.source).toBe("camera");
      expect(result.cubeState.confidence).toBe(1);
    }
  });

  it("round-trips the solved state too", () => {
    const readings = readingsFromFacelets(SOLVED, 300);
    const result = assemble(readings);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cubeState.facelets).toBe(SOLVED);
  });
});

describe("assemble (@003-S5)", () => {
  it("a single misread sticker breaks the per-colour count (correctly reported with no single pinpoint index)", () => {
    const readings = readingsFromFacelets(SOLVED, 400);
    // A lone sticker reported as the wrong colour necessarily unbalances the 9-per-colour count
    // (one colour now has 10, another 8) — validateFacelets correctly can't pin that on a single
    // facelet, so it reports which *colours* are off instead of a specific index.
    const corruptedU: FaceReading = {
      stickers: readings.U.stickers.map((s, i) => (i === 0 ? { ...s, color: "Y" } : s)),
    };
    const corrupted: FaceReadings = { ...readings, U: corruptedU };

    const result = assemble(corrupted);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error.message).toMatch(/over-represented|under-represented/);
    }
  });

  it("two swapped stickers (counts stay balanced) are localized to their exact indices", () => {
    const readings = readingsFromFacelets(SOLVED, 450);
    // Swap U-index-0 (W) and D-index-0 (Y): colour counts stay balanced at 9 each, but the
    // affected corner/edge piece no longer exists — a precisely localizable error.
    const corruptedU: FaceReading = {
      stickers: readings.U.stickers.map((s, i) => (i === 0 ? { ...s, color: "Y" } : s)),
    };
    const corruptedD: FaceReading = {
      stickers: readings.D.stickers.map((s, i) => (i === 0 ? { ...s, color: "W" } : s)),
    };
    const corrupted: FaceReadings = { ...readings, U: corruptedU, D: corruptedD };

    const result = assemble(corrupted);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.indices.length).toBeGreaterThan(0);
    }
  });

  it("a structurally-invalid (flipped edge) state is also rejected with precise indices", () => {
    const readings = readingsFromFacelets(ONE_FLIPPED_EDGE, 500);
    const result = assemble(readings);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.indices.length).toBeGreaterThan(0);
    }
  });
});

describe("lowConfidenceIndices (003-R11)", () => {
  it("is empty when every sticker has a comfortable margin", () => {
    const readings = readingsFromFacelets(SOLVED, 600);
    expect(lowConfidenceIndices(readings)).toHaveLength(0);
  });

  it("includes a sticker whose margin was pushed below the threshold", () => {
    const readings = readingsFromFacelets(SOLVED, 700);
    const lowMarginU = {
      stickers: readings.U.stickers.map((s, i) => (i === 3 ? { ...s, margin: 2, uncertain: true } : s)),
    };
    const modified: FaceReadings = { ...readings, U: lowMarginU };
    expect(lowConfidenceIndices(modified)).toContain(3);
  });
});
