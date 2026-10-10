import { Alg } from "cubing/alg";
import type { CubieId } from "./cubies";

/**
 * Setup-move tables (004-R10/T9.4). Every entry here was derived by brute-force search over short
 * D/F/R (or U/L/D/F/B-ish) move sequences, verifying each candidate directly against a real cube
 * model -- not transcribed from a published table -- and then re-verified independently by
 * setup.test.ts (004-R11). That test is the actual authority; this file is data.
 *
 * M2 finding (see ticket Open questions): bare `M2` is not a clean single 2-swap. Turning the
 * whole M-slice 180 degrees always ALSO swaps UF<->DB as an intrinsic side effect, confirmed
 * against the PRD's own worked example (`U R U' M2 U R' U'` for target FR) -- the UF<->DB swap
 * happens identically whether or not a setup is applied, as long as the setup doesn't touch
 * UF/DB. `M2_EDGE_TABLE.companion` records this so setup.test.ts can verify "exactly this swap
 * AND exactly the documented companion swap, nothing else" rather than a plain 2-swap. Targets UF
 * and DB themselves are each half of that companion pair, which entangles the search in a way a
 * plain 2-swap model doesn't resolve -- they are NOT in this table. See Open questions.
 */

export interface SetupEntry {
  readonly target: CubieId;
  readonly setup: string;
}

export interface CompanionSwap {
  readonly a: CubieId;
  readonly b: CubieId;
}

export interface SwapTable {
  readonly buffer: CubieId;
  readonly swapAlg: string;
  readonly entries: readonly SetupEntry[];
  readonly companion?: CompanionSwap;
}

export const OP_CORNER_BUFFER = "ULB" as CubieId;
export const OP_CORNER_SWAP_ALG = "R U' R' U' R U R' F' R U R' U' R' F R";

export const OP_CORNER_TABLE: SwapTable = {
  buffer: OP_CORNER_BUFFER,
  swapAlg: OP_CORNER_SWAP_ALG,
  entries: [
    { target: "URF" as CubieId, setup: "F" },
    { target: "UBR" as CubieId, setup: "R2" },
    { target: "UFL" as CubieId, setup: "F2" },
    { target: "DFR" as CubieId, setup: "" },
    { target: "DLF" as CubieId, setup: "D" },
    { target: "DBL" as CubieId, setup: "D2" },
    { target: "DRB" as CubieId, setup: "D'" },
  ],
};

export const OP_EDGE_BUFFER = "UR" as CubieId;
export const OP_EDGE_SWAP_ALG = "R U R' U' R' F R2 U' R' U' R U R' F'";

export const OP_EDGE_TABLE: SwapTable = {
  buffer: OP_EDGE_BUFFER,
  swapAlg: OP_EDGE_SWAP_ALG,
  entries: [
    { target: "UF" as CubieId, setup: "Lw D' L2" },
    { target: "UL" as CubieId, setup: "" },
    { target: "UB" as CubieId, setup: "Lw' D L2" },
    { target: "DR" as CubieId, setup: "D2 L2" },
    { target: "DF" as CubieId, setup: "D' L2" },
    { target: "DL" as CubieId, setup: "L2" },
    { target: "DB" as CubieId, setup: "D L2" },
    { target: "FR" as CubieId, setup: "Dw' L'" },
    { target: "FL" as CubieId, setup: "L'" },
    { target: "BL" as CubieId, setup: "L" },
    { target: "BR" as CubieId, setup: "Dw L" },
  ],
};

export const M2_EDGE_BUFFER = "DF" as CubieId;
export const M2_EDGE_SWAP_ALG = "M2";
export const M2_COMPANION_SWAP: CompanionSwap = { a: "UF" as CubieId, b: "DB" as CubieId };

export const M2_EDGE_TABLE: SwapTable = {
  buffer: M2_EDGE_BUFFER,
  swapAlg: M2_EDGE_SWAP_ALG,
  companion: M2_COMPANION_SWAP,
  entries: [
    { target: "UR" as CubieId, setup: "F U' F'" },
    { target: "UL" as CubieId, setup: "F U F'" },
    { target: "UB" as CubieId, setup: "" },
    { target: "DR" as CubieId, setup: "U R2 U'" },
    { target: "DL" as CubieId, setup: "U' L2 U" },
    { target: "FR" as CubieId, setup: "U R U'" },
    { target: "FL" as CubieId, setup: "U' L' U" },
    { target: "BL" as CubieId, setup: "U' L U" },
    { target: "BR" as CubieId, setup: "U R' U'" },
  ],
};

export function findSetupEntry(table: SwapTable, target: CubieId): SetupEntry | undefined {
  return table.entries.find((e) => e.target === target);
}

/** The full `setup + swapAlg + setup⁻¹` sequence for one target, ready to hand to parseAlg. */
export function buildSwapSequence(table: SwapTable, target: CubieId): string {
  const entry = findSetupEntry(table, target);
  if (!entry) throw new RangeError(`No setup entry for target ${target}`);
  if (entry.setup.trim() === "") return table.swapAlg;
  const inverted = Alg.fromString(entry.setup).invert().toString();
  return `${entry.setup} ${table.swapAlg} ${inverted}`;
}
