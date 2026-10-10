import { applyMoves } from "~/cube/core/apply";
import { createCubeState, type CubeState, type CubeStateSource } from "~/cube/core/cube-state";
import { assertFaceletString, isFaceletString, type FaceletString } from "~/cube/core/facelets";
import type { Move, MoveSequence } from "~/cube/core/notation";

/**
 * The app's single solution result type (004-R1/R2): rich enough to express every method's own
 * notion of structure (CFOP's cross -> F2L x4 -> OLL -> PLL, Roux's FB -> SB -> CMLL -> LSE, BLD's
 * per-target groups with memo) without a different type per method. `stages` is recursive via
 * `substeps` for exactly this reason.
 *
 * Convention (this ticket's own clarification, since the PRD's type sketch leaves it implicit):
 * a stage's own `moves` is the complete, authoritative move list for that stage. If it has
 * `substeps`, those re-express the *same* moves broken into finer-grained stages for display/memo
 * purposes — concatenating every substep's `moves` in order must equal the parent's own `moves`,
 * and the first substep's `stateBefore`/last substep's `stateAfter` must equal the parent's own.
 */

export type MethodId = "kociemba" | "cfop" | "roux" | "zz" | "zb" | "oh" | "bld";

export interface SolutionMove {
  readonly move: Move;
  readonly index: number; // index within the whole plan (allMoves() order)
  readonly annotation?: "setup" | "swap" | "undo" | "parity" | "cancellation" | "AUF";
}

declare const stickerBrand: unique symbol;
/** One of the 24 corner or 24 edge stickers (BLD, 004-R2) -- distinct from a facelet index: a
 * sticker names a physical sticker by its piece+position (e.g. "UBL" as a corner sticker), not a
 * slot in the 54-facelet string. */
export type Sticker = string & { readonly [stickerBrand]: true };

declare const cubieBrand: unique symbol;
/** One of the 8 corner or 12 edge cubies, named by its solved position (e.g. "URF", "UF"). */
export type CubieId = string & { readonly [cubieBrand]: true };

/** Open-ended: "speffz" is the built-in default, but user-defined schemes are just as valid. */
export type LetterSchemeId = string;

export interface Target {
  readonly sticker: Sticker;
  readonly letter: string;
  readonly cubie: CubieId;
}

export interface MemoBlock {
  readonly scheme: LetterSchemeId;
  readonly cornerTargets: readonly Target[];
  readonly edgeTargets: readonly Target[];
  readonly cornerPairs: readonly string[];
  readonly edgePairs: readonly string[];
  readonly parity: boolean;
  readonly flippedEdges?: readonly Target[];
  readonly twistedCorners?: readonly Target[];
  readonly buffer: { readonly corners: Sticker; readonly edges: Sticker };
}

export interface SolutionStage {
  readonly id: string;
  readonly label: string;
  readonly moves: readonly SolutionMove[];
  readonly algName?: string;
  readonly caseId?: string;
  readonly substeps?: readonly SolutionStage[];
  readonly memo?: MemoBlock;
  readonly stateBefore: FaceletString;
  readonly stateAfter: FaceletString;
  readonly notes?: readonly string[];
}

export interface MoveCount {
  readonly htm: number;
  readonly qtm: number;
  readonly stm: number;
  readonly etm: number;
}

export interface SolutionPlan {
  readonly method: MethodId;
  readonly input: CubeState;
  readonly stages: readonly SolutionStage[];
  readonly moveCount: MoveCount;
  readonly generatedAt: number;
  readonly engine: string;
  readonly computeMs: number;
  readonly verified: boolean;
  readonly warnings?: readonly string[];
}

/** Flattens a plan's stages (recursing into substeps, which re-express rather than add to their
 * parent's own moves) into one ordered move list. For a stage with substeps, only the substeps'
 * moves are collected -- not the parent's own `moves` again -- to avoid double-counting. */
export function allMoves(plan: SolutionPlan): readonly SolutionMove[] {
  const result: SolutionMove[] = [];
  function visit(stage: SolutionStage) {
    if (stage.substeps && stage.substeps.length > 0) {
      for (const substep of stage.substeps) visit(substep);
    } else {
      result.push(...stage.moves);
    }
  }
  for (const stage of plan.stages) visit(stage);
  return result;
}

export interface ConsistencyError {
  readonly stageId: string;
  readonly reason: string;
}

export type ConsistencyResult = { readonly ok: true } | { readonly ok: false; readonly error: ConsistencyError };

/**
 * 004-R12's per-stage half: applying a stage's own moves to its stateBefore must yield its
 * stateAfter, and each top-level stage's stateBefore must equal the previous stage's stateAfter
 * (or the plan's input, for the first stage). Recurses into substeps with the same two checks.
 */
export async function checkStageConsistency(plan: SolutionPlan): Promise<ConsistencyResult> {
  async function checkChain(
    stages: readonly SolutionStage[],
    expectedFirstStateBefore: FaceletString,
  ): Promise<ConsistencyResult> {
    let previousStateAfter = expectedFirstStateBefore;
    for (const stage of stages) {
      if (stage.stateBefore !== previousStateAfter) {
        return {
          ok: false,
          error: {
            stageId: stage.id,
            reason: `stateBefore (${stage.stateBefore}) does not match the previous stage's stateAfter (${previousStateAfter})`,
          },
        };
      }

      if (stage.substeps && stage.substeps.length > 0) {
        const substepResult = await checkChain(stage.substeps, stage.stateBefore);
        if (!substepResult.ok) return substepResult;
        const lastSubstep = stage.substeps[stage.substeps.length - 1]!;
        if (lastSubstep.stateAfter !== stage.stateAfter) {
          return {
            ok: false,
            error: {
              stageId: stage.id,
              reason: `last substep's stateAfter (${lastSubstep.stateAfter}) does not match this stage's own stateAfter (${stage.stateAfter})`,
            },
          };
        }
      } else {
        const moves: MoveSequence = stage.moves.map((m) => m.move);
        const result = await applyMoves(createCubeState(stage.stateBefore, plan.input.source), moves);
        if (result.facelets !== stage.stateAfter) {
          return {
            ok: false,
            error: {
              stageId: stage.id,
              reason: `applying this stage's moves to stateBefore yields ${result.facelets}, not the declared stateAfter ${stage.stateAfter}`,
            },
          };
        }
      }

      previousStateAfter = stage.stateAfter;
    }
    return { ok: true };
  }

  return checkChain(plan.stages, plan.input.facelets);
}

/** 004-R12's whole-plan half: applying every move in the plan to its input must solve the cube. */
export async function checkGoldenInvariant(plan: SolutionPlan, solvedFacelets: FaceletString): Promise<boolean> {
  const moves: MoveSequence = allMoves(plan).map((m) => m.move);
  const result = await applyMoves(plan.input, moves);
  return result.facelets === solvedFacelets;
}

export function serializePlan(plan: SolutionPlan): string {
  return JSON.stringify(plan);
}

export function deserializePlan(json: string): SolutionPlan {
  return JSON.parse(json) as SolutionPlan;
}

/**
 * CubeState URL-safe encoding (004-R16): a compact `?s=<base64url facelets>` deep link. Uses the
 * global btoa/atob (available in both the browser and Node, and our FaceletString is pure ASCII
 * so there's no encoding edge case to worry about) rather than Buffer, which isn't available in
 * every runtime this code might execute in.
 */
function toBase64Url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

export function encodeCubeStateForURL(state: CubeState): string {
  return toBase64Url(state.facelets);
}

export function decodeCubeStateFromURL(encoded: string, source: CubeStateSource = "manual"): CubeState {
  const decoded = fromBase64Url(encoded);
  if (!isFaceletString(decoded)) {
    throw new Error(`Invalid encoded cube state: decoded value "${decoded}" is not a valid facelet string`);
  }
  return createCubeState(assertFaceletString(decoded), source);
}
