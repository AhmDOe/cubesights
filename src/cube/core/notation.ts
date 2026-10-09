import { Alg, Move as CubingMove } from "cubing/alg";

/**
 * Move/MoveSequence over cubing/alg's Alg algebra (001-R5). cubing/alg is puzzle-agnostic and its
 * parser accepts groupings, commutators, wide turns, slices and rotations; we flatten all of that
 * into a plain ordered list of leaf moves via experimentalExpand, which is the one API surface
 * this file depends on (see Open questions R1 in the ticket re: its pre-1.0 stability).
 */

declare const moveBrand: unique symbol;
export type Move = string & { readonly [moveBrand]: true };
export type MoveSequence = readonly Move[];

// cubing/alg's IterationDirection enum isn't exported from the package's public surface at the
// time of writing; its documented value for "Forwards" is 1 (cubing/alg/iteration.d.ts).
const FORWARDS = 1;

export class NotationError extends Error {
  readonly code = "NOTATION_ERROR" as const;
  readonly token: string;

  constructor(token: string, message: string) {
    super(message);
    this.name = "NotationError";
    this.token = token;
  }
}

/** Finds the first whitespace-separated token that doesn't parse on its own, for diagnostics. */
function findOffendingToken(text: string): string | undefined {
  for (const token of text.split(/\s+/).filter(Boolean)) {
    try {
      CubingMove.fromString(token);
    } catch {
      return token;
    }
  }
  return undefined;
}

export function parseAlg(text: string): MoveSequence {
  let alg: Alg;
  try {
    alg = Alg.fromString(text);
  } catch {
    const token = findOffendingToken(text) ?? text;
    throw new NotationError(
      token,
      `Could not parse algorithm "${text}": invalid token "${token}"`,
    );
  }

  const moves: Move[] = [];
  for (const leaf of alg.experimentalExpand(FORWARDS)) {
    if (leaf instanceof CubingMove) {
      moves.push(leaf.toString() as Move);
    }
  }
  return moves;
}

export function formatAlg(moves: MoveSequence): string {
  return moves.join(" ");
}
