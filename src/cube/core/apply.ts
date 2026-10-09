import { fromKPattern, toKPattern } from "./adapters/kpuzzle";
import type { CubeState, CubeStateSource } from "./cube-state";
import { createCubeState } from "./cube-state";
import { formatAlg, type MoveSequence } from "./notation";

/**
 * applyMoves (001-R7): move application is never hand-rolled — every move goes through
 * cubing/kpuzzle's own engine via the adapters in ./adapters/kpuzzle.ts.
 */
export async function applyMoves(
  state: CubeState,
  moves: MoveSequence,
  source: CubeStateSource = state.source,
): Promise<CubeState> {
  if (moves.length === 0) return state;
  const pattern = await toKPattern(state.facelets);
  const next = pattern.applyAlg(formatAlg(moves));
  const facelets = await fromKPattern(next);
  return createCubeState(facelets, source);
}
