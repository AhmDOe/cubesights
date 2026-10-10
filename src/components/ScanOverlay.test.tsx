import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FaceReading } from "~/cube/input/camera/classify";
import { computeCells, computeROI } from "~/cube/input/camera/geometry";
import { ScanOverlay } from "./ScanOverlay";

const WIDTH = 1280;
const HEIGHT = 720;

function makeReading(colors: readonly string[]): FaceReading {
  return {
    stickers: colors.map((color) => ({
      color: color as FaceReading["stickers"][number]["color"],
      deltaE: 1,
      margin: 20,
      uncertain: false,
    })),
  };
}

describe("ScanOverlay (@003-S13)", () => {
  it("renders the grid at the computed ROI/cell geometry", () => {
    render(
      <ScanOverlay
        currentFace="U"
        promptText="Show the U face"
        viewportWidth={WIDTH}
        viewportHeight={HEIGHT}
        latestReading={null}
        committedFaces={{}}
        onRecapture={vi.fn()}
      />,
    );
    const roi = computeROI(WIDTH, HEIGHT);
    const grid = screen.getByTestId("scan-grid");
    expect(grid.style.left).toBe(`${roi.x}px`);
    expect(grid.style.width).toBe(`${roi.width}px`);

    const cells = computeCells(roi);
    const firstChip = screen.getByTestId("sticker-chip-0");
    expect(firstChip.style.left).toBe(`${cells[0]!.x - roi.x}px`);
  });

  it("shows prompt text matching the current face prop", () => {
    render(
      <ScanOverlay
        currentFace="R"
        promptText="Show the R face now"
        viewportWidth={WIDTH}
        viewportHeight={HEIGHT}
        latestReading={null}
        committedFaces={{}}
        onRecapture={vi.fn()}
      />,
    );
    expect(screen.getByTestId("scan-prompt")).toHaveTextContent("Show the R face now");
    expect(screen.getByTestId("face-label")).toHaveTextContent("R");
  });

  it("reflects the latest reading's colours in the sticker chips", () => {
    const reading = makeReading(["W", "Y", "R", "O", "G", "B", "W", "Y", "R"]);
    render(
      <ScanOverlay
        currentFace="U"
        promptText="Show U"
        viewportWidth={WIDTH}
        viewportHeight={HEIGHT}
        latestReading={reading}
        committedFaces={{}}
        onRecapture={vi.fn()}
      />,
    );
    expect(screen.getByTestId("sticker-chip-0").style.backgroundColor).not.toBe("transparent");
    expect(screen.getByTestId("sticker-chip-0").style.opacity).toBe("0.85");
  });

  it("dims an uncertain sticker's chip", () => {
    const reading = makeReading(new Array(9).fill("W"));
    const dimmedReading: FaceReading = {
      stickers: reading.stickers.map((s, i) => (i === 2 ? { ...s, uncertain: true } : s)),
    };
    render(
      <ScanOverlay
        currentFace="U"
        promptText="Show U"
        viewportWidth={WIDTH}
        viewportHeight={HEIGHT}
        latestReading={dimmedReading}
        committedFaces={{}}
        onRecapture={vi.fn()}
      />,
    );
    expect(screen.getByTestId("sticker-chip-2").style.opacity).toBe("0.5");
  });

  it("renders a thumbnail per committed face and calls onRecapture when tapped", async () => {
    const onRecapture = vi.fn();
    const user = userEvent.setup();
    render(
      <ScanOverlay
        currentFace="F"
        promptText="Show F"
        viewportWidth={WIDTH}
        viewportHeight={HEIGHT}
        latestReading={null}
        committedFaces={{ U: new Array(9).fill("W") as FaceReading["stickers"][number]["color"][] }}
        onRecapture={onRecapture}
      />,
    );
    const thumbnail = screen.getByTestId("thumbnail-U");
    expect(thumbnail).toBeInTheDocument();
    await user.click(thumbnail);
    expect(onRecapture).toHaveBeenCalledWith("U");
  });

  it("renders no thumbnails when no face has been committed yet", () => {
    render(
      <ScanOverlay
        currentFace="U"
        promptText="Show U"
        viewportWidth={WIDTH}
        viewportHeight={HEIGHT}
        latestReading={null}
        committedFaces={{}}
        onRecapture={vi.fn()}
      />,
    );
    expect(screen.getByTestId("face-thumbnails").children).toHaveLength(0);
  });
});
