import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FACE_ORDER, type Face } from "~/cube/core/facelets";
import type { StickerColor } from "~/cube/core/colors";
import { SOLVED } from "../../tests/fixtures/states";
import { CorrectionNet } from "./CorrectionNet";

const FACE_TO_COLOR: Record<Face, StickerColor> = { U: "W", R: "R", F: "G", D: "Y", L: "O", B: "B" };

function validColors(): StickerColor[] {
  const colors: StickerColor[] = [];
  for (const face of FACE_ORDER) for (let i = 0; i < 9; i++) colors.push(FACE_TO_COLOR[face]);
  return colors;
}

describe("CorrectionNet layout", () => {
  it("renders the six faces in the standard flat-net cross arrangement", () => {
    render(<CorrectionNet initialColors={validColors()} onSolve={vi.fn()} />);
    expect(screen.getByTestId("net-face-U").style.gridColumn).toBe("2");
    expect(screen.getByTestId("net-face-U").style.gridRow).toBe("1");
    expect(screen.getByTestId("net-face-L").style.gridColumn).toBe("1");
    expect(screen.getByTestId("net-face-F").style.gridColumn).toBe("2");
    expect(screen.getByTestId("net-face-R").style.gridColumn).toBe("3");
    expect(screen.getByTestId("net-face-B").style.gridColumn).toBe("4");
    expect(screen.getByTestId("net-face-D").style.gridRow).toBe("3");
  });

  it("renders all 54 stickers", () => {
    render(<CorrectionNet initialColors={validColors()} onSolve={vi.fn()} />);
    for (let i = 0; i < 54; i++) expect(screen.getByTestId(`net-sticker-${i}`)).toBeInTheDocument();
  });
});

describe("tap-to-cycle", () => {
  it("cycles a sticker's colour in STICKER_COLORS order on each tap", async () => {
    const user = userEvent.setup();
    render(<CorrectionNet initialColors={validColors()} onSolve={vi.fn()} />);
    const sticker = screen.getByTestId("net-sticker-0"); // starts "W"
    expect(sticker.getAttribute("aria-label")).toContain("white");
    await user.click(sticker);
    expect(sticker.getAttribute("aria-label")).toContain("yellow");
    await user.click(sticker);
    expect(sticker.getAttribute("aria-label")).toContain("red");
  });

  it("is keyboard operable: focus + Enter cycles the colour", async () => {
    const user = userEvent.setup();
    render(<CorrectionNet initialColors={validColors()} onSolve={vi.fn()} />);
    const sticker = screen.getByTestId("net-sticker-0");
    sticker.focus();
    expect(sticker).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(sticker.getAttribute("aria-label")).toContain("yellow");
  });
});

describe("validator re-runs per tap (@003-S5, @003-S6)", () => {
  it("disables Solve and highlights the exact offending indices for an invalid state, then enables Solve once fixed", async () => {
    const user = userEvent.setup();
    const corrupted = validColors();
    // Swap U-sticker-0 (W) and D-sticker-0 (index 27, Y): counts stay balanced at 9 each, but
    // the affected piece no longer exists — localizable, unlike a bare single-sticker edit.
    corrupted[0] = "Y";
    corrupted[27] = "W";

    const onSolve = vi.fn();
    render(<CorrectionNet initialColors={corrupted} onSolve={onSolve} />);

    expect(screen.getByTestId("solve-button")).toBeDisabled();
    // validateFacelets returns on the *first* error it finds (001-R6), so only the corner slot
    // it reaches first is highlighted — not necessarily both swapped stickers at once.
    expect(screen.getByTestId("net-sticker-0")).toHaveAttribute("data-error", "true");
    expect(screen.getByTestId("correction-error-message")).toBeInTheDocument();

    const stk0 = screen.getByTestId("net-sticker-0"); // Y -> R -> O -> G -> B -> W
    for (let i = 0; i < 5; i++) await user.click(stk0);
    const stk27 = screen.getByTestId("net-sticker-27"); // W -> Y
    await user.click(stk27);

    expect(screen.getByTestId("solve-button")).toBeEnabled();
    await user.click(screen.getByTestId("solve-button"));
    expect(onSolve).toHaveBeenCalledWith(SOLVED);
  });
});

describe("low-confidence marking (@003-S7)", () => {
  it("marks the stickers passed as lowConfidenceIndices, distinct from error highlighting", () => {
    render(<CorrectionNet initialColors={validColors()} lowConfidenceIndices={[5]} onSolve={vi.fn()} />);
    const sticker = screen.getByTestId("net-sticker-5");
    expect(sticker).toHaveAttribute("data-low-confidence", "true");
    expect(sticker).toHaveAttribute("data-error", "false");
    expect(sticker.getAttribute("aria-label")).toContain("low confidence");
  });
});
