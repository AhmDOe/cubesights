/**
 * ROI/grid geometry (003-R3): a fixed, centred square overlay occupying 70% of the shorter
 * viewport dimension, subdivided into a 3x3 grid, each cell sampled only in its central 40% —
 * which is what makes the fixed-frame approach viable without contour detection (see ticket's
 * Architecture notes): sampling only the cell centre avoids sticker edges, bevels and the black
 * plastic gaps entirely.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const ROI_FRACTION = 0.7;
export const SAMPLE_FRACTION = 0.4;

export function computeROI(viewportWidth: number, viewportHeight: number, fraction = ROI_FRACTION): Rect {
  const side = Math.min(viewportWidth, viewportHeight) * fraction;
  return {
    x: (viewportWidth - side) / 2,
    y: (viewportHeight - side) / 2,
    width: side,
    height: side,
  };
}

/** The 9 cells of the 3x3 grid within the ROI, in row-major order (index = row * 3 + col). */
export function computeCells(roi: Rect): readonly Rect[] {
  const cellWidth = roi.width / 3;
  const cellHeight = roi.height / 3;
  const cells: Rect[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      cells.push({
        x: roi.x + col * cellWidth,
        y: roi.y + row * cellHeight,
        width: cellWidth,
        height: cellHeight,
      });
    }
  }
  return cells;
}

/** The central `fraction` sub-region of a cell — the only part of the cell that gets sampled. */
export function computeSampleRegion(cell: Rect, fraction = SAMPLE_FRACTION): Rect {
  const width = cell.width * fraction;
  const height = cell.height * fraction;
  return {
    x: cell.x + (cell.width - width) / 2,
    y: cell.y + (cell.height - height) / 2,
    width,
    height,
  };
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}
