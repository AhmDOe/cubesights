import { applyMoves } from "~/cube/core/apply";
import type { CubeState } from "~/cube/core/cube-state";
import { SOLVED_FACELETS } from "~/cube/core/facelets";
import { validateFacelets } from "~/cube/core/validate";
import { checkGoldenInvariant, type SolutionMove, type SolutionPlan, type SolutionStage } from "~/cube/model/solution";
import { SearchEngine } from "~/cube/solve/engines/search-engine";
import { countMoves } from "~/cube/solve/postprocess";
import { registerPlanner, type MethodPlanner, type PlanOptions } from "./registry";

/**
 * KociembaPlanner (004-R8): the POC's fully-implemented, working method. A single "solution"
 * stage with the engine's raw move list -- no method-specific structure, since min2phase-style
 * solving isn't staged the way a human method is.
 */

const engine = new SearchEngine();

export const kociembaPlanner: MethodPlanner = {
  id: "kociemba",
  label: "Kociemba (two-phase)",
  capabilities: { structured: false, memo: false },

  async plan(state: CubeState, opts: PlanOptions = {}): Promise<SolutionPlan> {
    // @004-S5: refused before any search begins.
    const validation = validateFacelets(state.facelets);
    if (!validation.ok) {
      throw new Error(`Cannot plan: invalid cube state (${validation.error.code}): ${validation.error.message}`);
    }

    const start = Date.now();
    const moves = await engine.solve(state.facelets, { signal: opts.signal, timeoutMs: opts.maxTimeMs });
    const computeMs = Date.now() - start;

    const result = await applyMoves(state, moves);

    const solutionMoves: SolutionMove[] = moves.map((move, index) => ({ move, index }));
    const stage: SolutionStage = {
      id: "solution",
      label: "Solution",
      moves: solutionMoves,
      stateBefore: state.facelets,
      stateAfter: result.facelets,
      ...(moves.length === 0 ? { notes: ["Already solved"] } : {}),
    };

    const plan: SolutionPlan = {
      method: "kociemba",
      input: state,
      stages: [stage],
      moveCount: countMoves(moves),
      generatedAt: Date.now(),
      engine: engine.id,
      computeMs,
      verified: false,
    };

    // 004-R12: no planner may return an unverified plan -- enforced here, not left to the caller.
    const verified = await checkGoldenInvariant(plan, SOLVED_FACELETS);
    if (!verified) {
      throw new Error("KociembaPlanner produced a plan that fails the golden invariant; refusing to return it.");
    }

    return { ...plan, verified: true };
  },
};

registerPlanner(kociembaPlanner);
