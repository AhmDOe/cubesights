import { render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { CubeView, type CubeViewHandle } from "./CubeView";
import { createCubeState } from "~/cube/core/cube-state";
import { SOLVED_FACELETS } from "~/cube/core/facelets";
import { parseAlg } from "~/cube/core/notation";

const setupTransformationSet = vi.fn();
const togglePlay = vi.fn();

// TwistyPlayer is a real custom element (extends HTMLElement) in production, so <CubeView>
// appendChild()s it as a DOM node. The fake must therefore *be* a real DOM node too.
class FakeTwistyPlayer {
  constructor() {
    const el = document.createElement("div") as unknown as FakeTwistyPlayerElement;
    el.puzzle = "";
    el.alg = "";
    el.hintFacelets = "";
    el.experimentalStickering = "";
    el.experimentalModel = { setupTransformation: { set: setupTransformationSet } };
    el.controller = { togglePlay, jumpToStart: vi.fn(), jumpToEnd: vi.fn() };
    return el;
  }
}

interface FakeTwistyPlayerElement extends HTMLDivElement {
  puzzle: string;
  alg: string;
  hintFacelets: string;
  experimentalStickering: string;
  experimentalModel: { setupTransformation: { set: typeof setupTransformationSet } };
  controller: { togglePlay: typeof togglePlay; jumpToStart: () => void; jumpToEnd: () => void };
}

vi.mock("cubing/twisty", () => ({
  TwistyPlayer: FakeTwistyPlayer,
}));

vi.mock("~/cube/core/adapters/kpuzzle", () => ({
  toKTransformation: vi.fn(async (facelets: string) => ({ __facelets: facelets })),
}));

vi.mock("~/cube/core/apply", () => ({
  applyMoves: vi.fn(async (state: { facelets: string }) => state),
}));

describe("<CubeView>", () => {
  it("renders a placeholder container immediately (before the dynamic chunk resolves)", () => {
    render(<CubeView />);
    expect(screen.getByTestId("cube-view")).toBeInTheDocument();
  });

  it("forwards state to the mocked TwistyPlayer via setupTransformation", async () => {
    const state = createCubeState(SOLVED_FACELETS, "scramble");
    render(<CubeView state={state} />);
    await waitFor(() => expect(setupTransformationSet).toHaveBeenCalled());
  });

  it("forwards alg as a formatted string onto the player", async () => {
    const state = createCubeState(SOLVED_FACELETS, "scramble");
    const alg = parseAlg("R U R' U'");
    const { container } = render(<CubeView state={state} alg={alg} />);
    await waitFor(() => expect(setupTransformationSet).toHaveBeenCalled());
    const player = container.querySelector('[data-testid="cube-view"]')
      ?.firstChild as unknown as FakeTwistyPlayerElement | null;
    expect(player?.alg).toBe("R U R' U'");
  });

  it("exposes play/pause/jumpTo via the imperative handle", async () => {
    const state = createCubeState(SOLVED_FACELETS, "scramble");
    const alg = parseAlg("R U R' U'");
    const ref = createRef<CubeViewHandle>();
    render(<CubeView ref={ref} state={state} alg={alg} />);
    await waitFor(() => expect(ref.current).not.toBeNull());

    ref.current!.play();
    expect(togglePlay).toHaveBeenCalledWith(true);

    ref.current!.pause();
    expect(togglePlay).toHaveBeenCalledWith(false);

    ref.current!.jumpTo(2);
    await waitFor(() => expect(setupTransformationSet).toHaveBeenCalledTimes(2)); // initial sync + jumpTo
  });

  it("renders the highlight prop as a data attribute", () => {
    render(<CubeView highlight={[3, 7, 40]} />);
    expect(screen.getByTestId("cube-view")).toHaveAttribute("data-highlight", "3,7,40");
  });
});
