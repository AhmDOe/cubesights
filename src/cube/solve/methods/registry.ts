import type { CubeState } from "~/cube/core/cube-state";
import type { LetterSchemeId, MethodId, Sticker, SolutionPlan } from "~/cube/model/solution";

/**
 * MethodPlanner interface and registry (004-R7/R9): getPlanner() is the only way the app reaches
 * a planner, so routing/UI (ticket 005) can be built against the final shape of all seven methods
 * before six of them are actually implemented.
 */

export interface PlanOptions {
  readonly metric?: "htm" | "qtm" | "stm" | "etm";
  readonly oneHanded?: boolean;
  readonly maxTimeMs?: number;
  readonly signal?: AbortSignal;
  readonly scheme?: LetterSchemeId;
  readonly buffers?: { readonly corners?: Sticker; readonly edges?: Sticker };
  /** caseId -> a specific alg (as notation text) to prefer over this planner's own default. */
  readonly preferredAlgs?: Readonly<Record<string, string>>;
}

export interface MethodCapabilities {
  readonly structured: boolean;
  readonly memo: boolean;
}

export interface MethodPlanner {
  readonly id: MethodId;
  readonly label: string;
  readonly capabilities: MethodCapabilities;
  plan(state: CubeState, opts?: PlanOptions): Promise<SolutionPlan>;
}

export class NotImplementedError extends Error {
  readonly methodId: MethodId;
  readonly ticketNumber: number;

  constructor(methodId: MethodId, ticketNumber: number) {
    super(`Method "${methodId}" is not implemented yet (planned for ticket ${ticketNumber}).`);
    this.name = "NotImplementedError";
    this.methodId = methodId;
    this.ticketNumber = ticketNumber;
  }
}

const STUB_PLANNERS: ReadonlyArray<{
  readonly id: Exclude<MethodId, "kociemba">;
  readonly label: string;
  readonly ticketNumber: number;
  readonly capabilities: MethodCapabilities;
}> = [
  { id: "cfop", label: "CFOP", ticketNumber: 6, capabilities: { structured: true, memo: false } },
  { id: "roux", label: "Roux", ticketNumber: 7, capabilities: { structured: true, memo: false } },
  { id: "zz", label: "ZZ", ticketNumber: 8, capabilities: { structured: true, memo: false } },
  { id: "zb", label: "ZB", ticketNumber: 9, capabilities: { structured: true, memo: false } },
  { id: "oh", label: "One-Handed", ticketNumber: 10, capabilities: { structured: true, memo: false } },
  { id: "bld", label: "Blindfolded", ticketNumber: 11, capabilities: { structured: true, memo: true } },
];

function makeStubPlanner(
  id: MethodId,
  label: string,
  ticketNumber: number,
  capabilities: MethodCapabilities,
): MethodPlanner {
  return {
    id,
    label,
    capabilities,
    async plan() {
      throw new NotImplementedError(id, ticketNumber);
    },
  };
}

const registry = new Map<MethodId, MethodPlanner>();

export function registerPlanner(planner: MethodPlanner): void {
  registry.set(planner.id, planner);
}

export function getPlanner(id: MethodId): MethodPlanner {
  const planner = registry.get(id);
  if (!planner) throw new Error(`No planner registered for method "${id}"`);
  return planner;
}

export function listPlanners(): readonly MethodPlanner[] {
  return [...registry.values()];
}

for (const stub of STUB_PLANNERS) {
  registerPlanner(makeStubPlanner(stub.id, stub.label, stub.ticketNumber, stub.capabilities));
}
