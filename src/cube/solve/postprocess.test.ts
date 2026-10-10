import { describe, expect, it } from "vitest";
import { parseAlg } from "~/cube/core/notation";
import { cancelMoves, countMoves } from "./postprocess";

describe("cancelMoves (@004-S16)", () => {
  it("cancels the exact worked example to R2", () => {
    const result = cancelMoves(parseAlg("R R U U' F2 F2 B B'"));
    expect(result).toEqual(parseAlg("R2"));
  });

  it("merges two quarter turns of the same face into a half turn", () => {
    expect(cancelMoves(parseAlg("R R"))).toEqual(parseAlg("R2"));
  });

  it("cancels a move with its own inverse", () => {
    expect(cancelMoves(parseAlg("R R'"))).toEqual([]);
  });

  it("cancels two half turns of the same face", () => {
    expect(cancelMoves(parseAlg("F2 F2"))).toEqual([]);
  });

  it("merges a quarter turn and a half turn into the remaining quarter turn", () => {
    expect(cancelMoves(parseAlg("R R2"))).toEqual(parseAlg("R'"));
  });

  it("does not merge across a different face", () => {
    expect(cancelMoves(parseAlg("R U R'"))).toEqual(parseAlg("R U R'"));
  });

  it("is idempotent on an already-cancelled sequence", () => {
    const once = cancelMoves(parseAlg("R U2 F' L2 D"));
    expect(cancelMoves(once)).toEqual(once);
  });

  it("leaves an empty sequence empty", () => {
    expect(cancelMoves([])).toEqual([]);
  });
});

describe("countMoves (@004-S16)", () => {
  it("reports htm 1, qtm 2 for the cancelled worked example (R2)", () => {
    const moves = cancelMoves(parseAlg("R R U U' F2 F2 B B'"));
    const count = countMoves(moves);
    expect(count.htm).toBe(1);
    expect(count.qtm).toBe(2);
    expect(count.stm).toBe(1);
    expect(count.etm).toBe(1);
  });

  it("counts a sequence of quarter turns 1-for-1 in both htm and qtm", () => {
    const count = countMoves(parseAlg("R U F' L D2"));
    expect(count.htm).toBe(5);
    expect(count.qtm).toBe(6); // four quarter turns + one half turn (D2 = 2)
  });

  it("excludes rotations from htm/qtm/stm but includes them in etm", () => {
    const count = countMoves(parseAlg("x R y' U"));
    expect(count.htm).toBe(2);
    expect(count.qtm).toBe(2);
    expect(count.stm).toBe(2);
    expect(count.etm).toBe(4);
  });

  it("is zero across the board for an empty sequence", () => {
    expect(countMoves([])).toEqual({ htm: 0, qtm: 0, stm: 0, etm: 0 });
  });
});
