import type { FaceletString } from "~/cube/core/facelets";
import type { MoveSequence } from "~/cube/core/notation";

/**
 * SolverEngine (004-R3): "give me moves that reach this sub-goal" -- an engine, as distinct from a
 * MethodPlanner, which expresses a result the way a human practising a method thinks about it.
 */

export interface SolveOptions {
  /** Not supported by every engine -- see each implementation's own docs for whether it's honoured. */
  readonly maxDepth?: number;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export interface SolverEngine {
  readonly id: string;
  init(): Promise<void>;
  solve(facelets: FaceletString, opts?: SolveOptions): Promise<MoveSequence>;
}

export class AbortedError extends Error {
  constructor(message = "Solve was aborted") {
    super(message);
    this.name = "AbortedError";
  }
}

export class SolveTimeoutError extends Error {
  constructor(message = "Solve timed out") {
    super(message);
    this.name = "SolveTimeoutError";
  }
}
