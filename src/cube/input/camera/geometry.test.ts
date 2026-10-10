import { describe, expect, it } from "vitest";
import { computeCells, computeROI, computeSampleRegion, rectContains, type Rect } from "./geometry";

describe("computeROI", () => {
  it.each([
    ["square", 1000, 1000],
    ["portrait", 720, 1280],
    ["landscape", 1280, 720],
  ])("is centred and occupies 70%% of the shorter dimension (%s)", (_label, w, h) => {
    const roi = computeROI(w, h);
    const shorter = Math.min(w, h);
    expect(roi.width).toBeCloseTo(shorter * 0.7, 5);
    expect(roi.height).toBeCloseTo(shorter * 0.7, 5);
    expect(roi.x).toBeCloseTo((w - roi.width) / 2, 5);
    expect(roi.y).toBeCloseTo((h - roi.height) / 2, 5);
    expect(rectContains({ x: 0, y: 0, width: w, height: h }, roi)).toBe(true);
  });
});

describe("computeCells", () => {
  it("produces 9 equal cells in row-major order that exactly tile the ROI", () => {
    const roi = computeROI(1280, 720);
    const cells = computeCells(roi);
    expect(cells).toHaveLength(9);
    for (const cell of cells) {
      expect(cell.width).toBeCloseTo(roi.width / 3, 5);
      expect(cell.height).toBeCloseTo(roi.height / 3, 5);
      expect(rectContains(roi, cell)).toBe(true);
    }
    // row-major: index 0 is top-left, index 2 is top-right, index 6 is bottom-left.
    expect(cells[0]!.x).toBeCloseTo(roi.x, 5);
    expect(cells[0]!.y).toBeCloseTo(roi.y, 5);
    expect(cells[2]!.x).toBeCloseTo(roi.x + (2 * roi.width) / 3, 5);
    expect(cells[6]!.y).toBeCloseTo(roi.y + (2 * roi.height) / 3, 5);
  });

  it("cells never overlap each other", () => {
    const cells = computeCells(computeROI(1280, 720));
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i]!;
        const b = cells[j]!;
        const overlapsX = a.x < b.x + b.width && b.x < a.x + a.width;
        const overlapsY = a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlapsX && overlapsY).toBe(false);
      }
    }
  });
});

describe("computeSampleRegion", () => {
  it("is the central 40% of the cell, strictly inside it with margin on every side", () => {
    const roi = computeROI(1280, 720);
    for (const cell of computeCells(roi)) {
      const sample = computeSampleRegion(cell);
      expect(sample.width).toBeCloseTo(cell.width * 0.4, 5);
      expect(sample.height).toBeCloseTo(cell.height * 0.4, 5);

      // Strictly inside with a margin (avoids sticker edges/bevels/gaps) — not just contained,
      // but with positive clearance from every edge of the cell.
      const marginX = sample.x - cell.x;
      const marginY = sample.y - cell.y;
      const marginRight = cell.x + cell.width - (sample.x + sample.width);
      const marginBottom = cell.y + cell.height - (sample.y + sample.height);
      expect(marginX).toBeGreaterThan(0);
      expect(marginY).toBeGreaterThan(0);
      expect(marginRight).toBeGreaterThan(0);
      expect(marginBottom).toBeGreaterThan(0);
      expect(rectContains(cell, sample)).toBe(true);
    }
  });

  it("is centred within the cell", () => {
    const cell: Rect = { x: 10, y: 20, width: 90, height: 60 };
    const sample = computeSampleRegion(cell);
    const cellCenterX = cell.x + cell.width / 2;
    const cellCenterY = cell.y + cell.height / 2;
    const sampleCenterX = sample.x + sample.width / 2;
    const sampleCenterY = sample.y + sample.height / 2;
    expect(sampleCenterX).toBeCloseTo(cellCenterX, 5);
    expect(sampleCenterY).toBeCloseTo(cellCenterY, 5);
  });
});
