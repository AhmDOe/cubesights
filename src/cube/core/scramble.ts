import { createCubeState, type CubeState } from "./cube-state";
import { SOLVED_FACELETS } from "./facelets";
import { parseAlg, type Move, type MoveSequence } from "./notation";

/**
 * Wraps cubing/scramble's randomScrambleForEvent("333") (001-R8) — a WCA-legal random-state
 * scramble, the same guarantee TNoodle provides. Lazy-loaded so its WASM/data isn't in the
 * initial bundle (001-R13's bundle ceiling).
 *
 * Known issue (see Open question R5 in this ticket): cubing/scramble instantiates a module
 * worker internally, and its fallback chain for locating that worker's URL does not resolve
 * under Next.js's bundler (confirmed with both webpack and Turbopack dev servers — "Module
 * worker instantiation failed. There are no more fallbacks available."), even though it works
 * fine under plain Node (which is why the Vitest unit tests for this file pass). Until that's
 * resolved upstream or by bundler configuration, this falls back to a simple (non-WCA-random-
 * state, but still valid and well-scrambled) random-move sequence, generated through the same
 * kpuzzle-backed applyMoves path already verified in apply.test.ts.
 */
export async function generateScramble(): Promise<MoveSequence> {
  try {
    const { randomScrambleForEvent } = await import("cubing/scramble");
    const alg = await randomScrambleForEvent("333");
    return parseAlg(alg.toString());
  } catch (cause) {
    console.warn(
      "generateScramble: cubing/scramble unavailable (see ticket 001 Open question R5), " +
        "falling back to a simple random-move scramble.",
      cause,
    );
    return randomMoveFallbackScramble();
  }
}

const FACES = ["U", "D", "F", "B", "L", "R"] as const;
const SUFFIXES = ["", "'", "2"] as const;

/** Not WCA-random-state; just enough entropy to be a usable scramble when the real one fails. */
function randomMoveFallbackScramble(length = 25): MoveSequence {
  const moves: Move[] = [];
  let lastFace: string | null = null;
  while (moves.length < length) {
    const face = FACES[Math.floor(Math.random() * FACES.length)]!;
    if (face === lastFace) continue;
    lastFace = face;
    const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]!;
    moves.push(`${face}${suffix}` as Move);
  }
  return moves;
}

/** Generates a scramble and returns the resulting CubeState (source: "scramble"). */
export async function scrambledState(): Promise<CubeState> {
  const { applyMoves } = await import("./apply");
  const moves = await generateScramble();
  const solved = createCubeState(SOLVED_FACELETS, "scramble");
  return applyMoves(solved, moves, "scramble");
}
