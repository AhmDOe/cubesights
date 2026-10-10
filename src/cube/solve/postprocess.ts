import { Move as CubingMove } from "cubing/alg";
import type { MoveCount } from "~/cube/model/solution";
import type { Move, MoveSequence } from "~/cube/core/notation";

/**
 * Move post-processing (004-R14): adjacent same-face cancellation/merging and per-metric move
 * counting. Rotation elimination and AUF insertion are deliberately NOT implemented here (see
 * ticket's Open question R9) -- both require a conjugation table that would need the same kind of
 * empirical derivation-against-kpuzzle the 001 CORNERS/EDGES tables got, and no planner this
 * ticket builds (KociembaPlanner) ever emits a rotation or needs an AUF, so there is nothing to
 * verify against yet.
 *
 * Cancellation is deliberately adjacent-only: "R R" -> "R2", "R R'" -> nothing. It does not reorder
 * moves to find cancellations across a commuting move on a different axis (e.g. "R L R'" is not
 * simplified) -- that is a correctness-sensitive optimisation this ticket doesn't need and hasn't
 * verified.
 */

const ROTATION_FAMILIES = new Set(["x", "y", "z"]);

interface ParsedMove {
  readonly family: string;
  readonly amount: number;
}

function parse(move: Move): ParsedMove {
  const m = CubingMove.fromString(move);
  return { family: m.family, amount: m.amount };
}

/** Normalises a net quarter-turn amount to one of {-1, 0, 1, 2} (mod-4 net effect; ±2 is the same
 * physical half-turn, always rendered as the positive "2" form). */
function normalizeAmount(amount: number): number {
  const mod4 = ((amount % 4) + 4) % 4; // 0, 1, 2, 3
  return mod4 === 3 ? -1 : mod4;
}

function toMove(family: string, amount: number): Move | null {
  if (amount === 0) return null;
  if (amount === 1) return family as Move;
  if (amount === -1) return `${family}'` as Move;
  // amount === 2 (or the normalized -2 case, which normalizeAmount never produces -- only 0/1/-1/2).
  return `${family}2` as Move;
}

/** Cancels/merges adjacent same-family moves: "R R" -> "R2", "R R'" -> nothing, "F2 F2" -> nothing. */
export function cancelMoves(moves: MoveSequence): MoveSequence {
  const stack: { family: string; amount: number }[] = [];
  for (const moveStr of moves) {
    const parsed = parse(moveStr);
    const top = stack[stack.length - 1];
    if (top?.family === parsed.family) {
      const merged = normalizeAmount(top.amount + parsed.amount);
      if (merged === 0) stack.pop();
      else top.amount = merged;
    } else {
      stack.push({ family: parsed.family, amount: normalizeAmount(parsed.amount) });
    }
  }
  return stack.map((e) => toMove(e.family, e.amount)).filter((m): m is Move => m !== null);
}

/**
 * Per-metric move counts. htm/qtm/stm exclude pure rotations (x/y/z); etm includes them -- that is
 * the one unambiguous, implementable distinction between these metrics for our move grammar (see
 * Open question R9 for the parts of HTM/STM/wide-move nuance this does NOT attempt to resolve).
 */
export function countMoves(moves: MoveSequence): MoveCount {
  let htm = 0;
  let qtm = 0;
  let stm = 0;
  let etm = 0;
  for (const moveStr of moves) {
    const parsed = parse(moveStr);
    etm += 1;
    if (!ROTATION_FAMILIES.has(parsed.family)) {
      htm += 1;
      stm += 1;
      qtm += Math.abs(parsed.amount);
    }
  }
  return { htm, qtm, stm, etm };
}
