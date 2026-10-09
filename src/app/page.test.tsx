import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";
import { parseAlg } from "~/cube/core/notation";

vi.mock("~/components/CubeView", () => ({
  CubeView: () => <div data-testid="cube-view" />,
}));

vi.mock("~/cube/core/scramble", () => ({
  generateScramble: vi.fn(async () => parseAlg("R U R' U'")),
}));

describe("Home shell page", () => {
  it("@001-S2 shows 'No scramble yet' until the Scramble button is pressed, then shows the alg", async () => {
    const user = userEvent.setup();
    render(<Home />);
    expect(screen.getByTestId("alg-text")).toHaveTextContent("No scramble yet");

    await user.click(screen.getByRole("button", { name: "Scramble" }));
    await waitFor(() => expect(screen.getByTestId("alg-text")).toHaveTextContent("R U R' U'"));
  });

  it("@001-S9 prev/next clamp at the ends of the alg", async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.click(screen.getByRole("button", { name: "Scramble" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Next" })).toBeEnabled());

    const prev = screen.getByRole("button", { name: "Prev" });
    const next = screen.getByRole("button", { name: "Next" });

    expect(prev).toBeDisabled();
    await user.click(next);
    await user.click(next);
    await user.click(next);
    await user.click(next);
    await user.click(next); // one extra click past the end
    expect(next).toBeDisabled();

    for (let i = 0; i < 5; i++) await user.click(prev);
    expect(prev).toBeDisabled();
  });
});
