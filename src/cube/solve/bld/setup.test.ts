import { describe, expect, it } from "vitest";
import { applyMoves } from "~/cube/core/apply";
import { createCubeState, type CubeState } from "~/cube/core/cube-state";
import { SOLVED_FACELETS } from "~/cube/core/facelets";
import { parseAlg } from "~/cube/core/notation";
import { CORNERS, EDGES } from "~/cube/core/validate";
import type { CubieId } from "./cubies";
import {
  buildSwapSequence,
  findSetupEntry,
  M2_EDGE_BUFFER,
  M2_EDGE_TABLE,
  OP_CORNER_BUFFER,
  OP_CORNER_TABLE,
  OP_EDGE_BUFFER,
  OP_EDGE_TABLE,
  type SwapTable,
} from "./setup";

/**
 * 004-R11: the mechanism that makes hand-derived BLD tables trustworthy. For every target in
 * every table, `setup + swapAlg + setup⁻¹` applied to a solved cube must perform exactly the
 * intended 2-swap (plus the M2 table's one documented companion swap, see setup.ts) and disturb
 * nothing else -- position or orientation. No entry is exempted.
 */

interface PieceDef {
  readonly id: string;
  readonly faces: readonly string[];
  readonly indices: readonly number[];
}

function orientationOf(pieceFaces: readonly string[], read: readonly string[]): number {
  const n = pieceFaces.length;
  for (let o = 0; o < n; o++) {
    if ([...pieceFaces].every((_, i) => pieceFaces[(o + i) % n] === read[i])) return o;
  }
  throw new RangeError(`No orientation of [${pieceFaces.join(",")}] reproduces [${read.join(",")}]`);
}

function pieceAt(facelets: string, def: PieceDef): { piece: string; orientation: number } {
  const read = def.indices.map((i) => facelets[i]!);
  const readSet = new Set(read);
  const defs = def.faces.length === 3 ? CORNERS : EDGES;
  const piece = defs.find((p) => {
    const s = new Set(p.faces);
    return s.size === readSet.size && [...s].every((f) => readSet.has(f));
  })!;
  return { piece: piece.id, orientation: orientationOf(piece.faces, read) };
}

async function applySequence(sequence: string): Promise<CubeState> {
  return applyMoves(createCubeState(SOLVED_FACELETS, "manual"), parseAlg(sequence));
}

async function verifyCleanSwap(defs: readonly PieceDef[], table: SwapTable, bufferId: CubieId, target: CubieId): Promise<void> {
  const sequence = buildSwapSequence(table, target);
  const result = await applySequence(sequence);

  for (const def of defs) {
    const { piece, orientation } = pieceAt(result.facelets, def);
    let expected: string = def.id;
    if (def.id === bufferId) expected = target;
    else if (def.id === target) expected = bufferId;
    else if (table.companion) {
      if (def.id === table.companion.a) expected = table.companion.b;
      else if (def.id === table.companion.b) expected = table.companion.a;
    }
    expect(piece).toBe(expected);
    if (expected === def.id) expect(orientation).toBe(0);
  }
}

describe("OP corner table (@004-S9)", () => {
  it.each(OP_CORNER_TABLE.entries)("target $target: setup+Y-perm+undo performs exactly buffer<->target", async ({ target }) => {
    await verifyCleanSwap(CORNERS, OP_CORNER_TABLE, OP_CORNER_BUFFER, target);
  });

  it("covers every non-buffer corner", () => {
    const targets = new Set(OP_CORNER_TABLE.entries.map((e) => e.target));
    const expected = CORNERS.map((c) => c.id).filter((id) => id !== OP_CORNER_BUFFER);
    expect([...targets].sort()).toEqual([...expected].sort());
  });
});

describe("OP edge table", () => {
  it.each(OP_EDGE_TABLE.entries)("target $target: setup+T-perm+undo performs exactly buffer<->target", async ({ target }) => {
    await verifyCleanSwap(EDGES, OP_EDGE_TABLE, OP_EDGE_BUFFER, target);
  });

  it("covers every non-buffer edge", () => {
    const targets = new Set(OP_EDGE_TABLE.entries.map((e) => e.target));
    const expected = EDGES.map((e) => e.id).filter((id) => id !== OP_EDGE_BUFFER);
    expect([...targets].sort()).toEqual([...expected].sort());
  });
});

describe("M2 edge table (@004-S10)", () => {
  it.each(M2_EDGE_TABLE.entries)(
    "target $target: setup+M2+undo performs exactly buffer<->target plus the documented UF<->DB companion swap",
    async ({ target }) => {
      await verifyCleanSwap(EDGES, M2_EDGE_TABLE, M2_EDGE_BUFFER, target);
    },
  );

  it("bare M2 (no setup) performs exactly buffer<->UB plus the UF<->DB companion swap", async () => {
    await verifyCleanSwap(EDGES, M2_EDGE_TABLE, M2_EDGE_BUFFER, "UB" as CubieId);
  });

  it("covers every non-buffer, non-companion-pair edge; UF and DB are explicitly absent (see setup.ts)", () => {
    const targets = new Set(M2_EDGE_TABLE.entries.map((e) => e.target));
    const expected = EDGES.map((e) => e.id).filter((id) => id !== M2_EDGE_BUFFER && id !== "UF" && id !== "DB");
    expect([...targets].sort()).toEqual([...expected].sort());
    expect(targets.has("UF" as CubieId)).toBe(false);
    expect(targets.has("DB" as CubieId)).toBe(false);
  });
});

describe("findSetupEntry / buildSwapSequence", () => {
  it("returns undefined for an unknown target", () => {
    expect(findSetupEntry(OP_CORNER_TABLE, "NOPE" as CubieId)).toBeUndefined();
  });

  it("throws when building a sequence for an unknown target", () => {
    expect(() => buildSwapSequence(OP_CORNER_TABLE, "NOPE" as CubieId)).toThrow();
  });

  it("omits the setup entirely when none is needed", () => {
    expect(buildSwapSequence(OP_CORNER_TABLE, "DFR" as CubieId)).toBe(OP_CORNER_TABLE.swapAlg);
  });
});
