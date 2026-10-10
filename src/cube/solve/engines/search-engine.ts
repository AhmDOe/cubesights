import { experimentalSolve3x3x3IgnoringCenters } from "cubing/search";
import { fromKPattern, toKPattern } from "~/cube/core/adapters/kpuzzle";
import { SOLVED_FACELETS, type FaceletString } from "~/cube/core/facelets";
import { parseAlg, type MoveSequence } from "~/cube/core/notation";
import { AbortedError, SolveTimeoutError, type SolveOptions, type SolverEngine } from "./engine";

/**
 * SearchEngine (004-R4): wraps cubing/search's experimentalSolve3x3x3IgnoringCenters -- NOT the
 * `min2phase` npm package named in the original plan, which was investigated and rejected (see
 * the ticket's Open questions): it's an unfilled template wrapper over deprecated dependencies
 * under a GPL-3.0-only license that conflicts with this project's. cubing/search needed zero new
 * installs, uses the exact KPattern our own adapter already produces, and is dual-licensed
 * MPL-2.0 OR GPL-3.0-or-later (we already depend on `cubing` project-wide).
 *
 * Centre orientation genuinely doesn't matter for solving a 3x3x3 (centres have no orientation
 * constraint in play), so "IgnoringCenters" costs nothing here.
 *
 * Cancellation caveat (004-R3 vs. reality): cubing/search's public API (checked both
 * experimentalSolve3x3x3IgnoringCenters and solveTwips) has no abort/cancellation primitive at
 * all. This class can only offer *consumer-side* cancellation -- if the signal fires first, the
 * promise this method returns rejects immediately and the caller moves on -- but the underlying
 * search keeps computing in the background until it naturally finishes. "The worker is idle
 * afterwards" (@004-S6) is therefore not literally true of the underlying computation, only of
 * what the caller is left waiting on. Flagged in the ticket's Open questions, not silently assumed.
 */
export class SearchEngine implements SolverEngine {
  readonly id = "cubing-search";
  private initialized = false;

  async init(): Promise<void> {
    // 004-R4's facelet-order assertion: a cheap round-trip of the solved state through our own
    // adapter is enough to catch a kpuzzle-version/adapter mismatch before it could silently
    // corrupt every plan this engine produces.
    const pattern = await toKPattern(SOLVED_FACELETS);
    const roundTripped = await fromKPattern(pattern);
    if (roundTripped !== SOLVED_FACELETS) {
      throw new Error(
        `SearchEngine facelet-order assertion failed: round-tripping the solved state through ` +
          `toKPattern/fromKPattern produced "${roundTripped}", not the solved facelets. The ` +
          `kpuzzle adapter and this engine disagree on facelet order -- refusing to solve.`,
      );
    }
    this.initialized = true;
  }

  async solve(facelets: FaceletString, opts: SolveOptions = {}): Promise<MoveSequence> {
    if (opts.signal?.aborted) throw new AbortedError();
    if (!this.initialized) await this.init();

    const pattern = await toKPattern(facelets);
    const searchPromise = experimentalSolve3x3x3IgnoringCenters(pattern);

    const racers: Promise<MoveSequence>[] = [searchPromise.then((alg) => parseAlg(alg.toString()))];
    if (opts.signal) racers.push(abortPromise(opts.signal));
    if (opts.timeoutMs !== undefined) racers.push(timeoutPromise(opts.timeoutMs));

    return Promise.race(racers);
  }
}

function abortPromise(signal: AbortSignal): Promise<never> {
  if (signal.aborted) return Promise.reject(new AbortedError());
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new AbortedError()), { once: true });
  });
}

function timeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new SolveTimeoutError()), timeoutMs);
  });
}
