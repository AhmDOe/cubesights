import { describe, expect, it } from "vitest";
import { createCubeState } from "~/cube/core/cube-state";
import { SOLVED_FACELETS, type FaceletString } from "~/cube/core/facelets";
import { CORNERS, EDGES } from "~/cube/core/validate";
import { decompose } from "./cycles";
import { SPEFFZ_SCHEME } from "./scheme";

const BUFFER = { corners: "URF:U" as never, edges: "UF:U" as never };

function placeAt(chars: string[], slotIndices: readonly number[], pieceFaces: readonly string[], o: number): void {
  const n = pieceFaces.length;
  slotIndices.forEach((idx, i) => {
    chars[idx] = pieceFaces[(o + i) % n]!;
  });
}

function corner(id: string) {
  return CORNERS.find((c) => c.id === id)!;
}
function edge(id: string) {
  return EDGES.find((e) => e.id === id)!;
}

function buildFacelets(mutations: (chars: string[]) => void): FaceletString {
  const chars = SOLVED_FACELETS.split("");
  mutations(chars);
  return chars.join("") as FaceletString;
}

function state(facelets: FaceletString) {
  return createCubeState(facelets, "manual");
}

describe("decompose: corners (@004-S11)", () => {
  it("a single 3-cycle through the buffer yields exactly 2 targets, in visitation order", () => {
    // URF slot <- ULB's piece, UBR slot <- URF's piece, ULB slot <- UBR's piece (a legal 3-cycle).
    const facelets = buildFacelets((chars) => {
      placeAt(chars, corner("URF").indices, corner("ULB").faces, 0);
      placeAt(chars, corner("UBR").indices, corner("URF").faces, 0);
      placeAt(chars, corner("ULB").indices, corner("UBR").faces, 0);
    });
    const result = decompose(state(facelets), BUFFER, SPEFFZ_SCHEME);
    expect(result.cornerTargets.map((t) => t.cubie)).toEqual(["ULB", "UBR"]);
  });

  it("a second disjoint 3-cycle not touching the buffer is picked up via a cycle break", () => {
    const facelets = buildFacelets((chars) => {
      placeAt(chars, corner("URF").indices, corner("ULB").faces, 0);
      placeAt(chars, corner("UBR").indices, corner("URF").faces, 0);
      placeAt(chars, corner("ULB").indices, corner("UBR").faces, 0);
      // A second, disjoint 3-cycle: DFR <- DBL <- DLF <- DFR.
      placeAt(chars, corner("DFR").indices, corner("DBL").faces, 0);
      placeAt(chars, corner("DBL").indices, corner("DLF").faces, 0);
      placeAt(chars, corner("DLF").indices, corner("DFR").faces, 0);
    });
    const result = decompose(state(facelets), BUFFER, SPEFFZ_SCHEME);
    expect(result.cornerTargets).toHaveLength(4);
    // The buffer's own cycle resolves first, then the break picks up the next cycle in array order.
    expect(result.cornerTargets.slice(0, 2).map((t) => t.cubie)).toEqual(["ULB", "UBR"]);
    expect(new Set(result.cornerTargets.slice(2).map((t) => t.cubie))).toEqual(new Set(["DBL", "DLF"]));
  });

  it("the buffer already home, with a disjoint cycle elsewhere, is fully covered via cycle break alone", () => {
    const facelets = buildFacelets((chars) => {
      placeAt(chars, corner("DFR").indices, corner("DBL").faces, 0);
      placeAt(chars, corner("DBL").indices, corner("DLF").faces, 0);
      placeAt(chars, corner("DLF").indices, corner("DFR").faces, 0);
    });
    const result = decompose(state(facelets), BUFFER, SPEFFZ_SCHEME);
    expect(result.cornerTargets).toHaveLength(2);
    expect(result.solvedCorners).toContain("URF");
  });

  it("an all-solved cube yields zero targets and all 8 corners solved in place", () => {
    const result = decompose(state(SOLVED_FACELETS), BUFFER, SPEFFZ_SCHEME);
    expect(result.cornerTargets).toHaveLength(0);
    expect(result.solvedCorners).toHaveLength(8);
  });
});

describe("decompose: parity (@004-S12)", () => {
  it("is true for an odd number of edge targets (a single 2-cycle through the buffer)", () => {
    // A lone edge transposition is an odd permutation, so pair it with a lone corner transposition
    // (also odd) to keep the overall state legal.
    const facelets = buildFacelets((chars) => {
      placeAt(chars, edge("UF").indices, edge("UR").faces, 0);
      placeAt(chars, edge("UR").indices, edge("UF").faces, 0);
      placeAt(chars, corner("URF").indices, corner("UBR").faces, 0);
      placeAt(chars, corner("UBR").indices, corner("URF").faces, 0);
    });
    const result = decompose(state(facelets), BUFFER, SPEFFZ_SCHEME);
    expect(result.edgeTargets).toHaveLength(1);
    expect(result.parity).toBe(true);
  });

  it("is false for an even number of edge targets (a 3-cycle through the buffer)", () => {
    const facelets = buildFacelets((chars) => {
      placeAt(chars, edge("UF").indices, edge("UL").faces, 0);
      placeAt(chars, edge("UL").indices, edge("UR").faces, 0);
      placeAt(chars, edge("UR").indices, edge("UF").faces, 0);
    });
    const result = decompose(state(facelets), BUFFER, SPEFFZ_SCHEME);
    expect(result.edgeTargets).toHaveLength(2);
    expect(result.parity).toBe(false);
  });

  it("is false for zero edge targets (solved)", () => {
    const result = decompose(state(SOLVED_FACELETS), BUFFER, SPEFFZ_SCHEME);
    expect(result.parity).toBe(false);
  });
});

describe("decompose: solved/flipped/twisted detection (@004-S13)", () => {
  it("reports flipped edges and a twisted corner, excluded from ordinary targets", () => {
    const facelets = buildFacelets((chars) => {
      // Two edges flipped in place (legal: even count).
      placeAt(chars, edge("UF").indices, edge("UF").faces, 1);
      placeAt(chars, edge("UR").indices, edge("UR").faces, 1);
      // Two corners twisted in place, net 0 mod 3 (legal).
      placeAt(chars, corner("URF").indices, corner("URF").faces, 1);
      placeAt(chars, corner("UBR").indices, corner("UBR").faces, 2);
    });
    const result = decompose(state(facelets), BUFFER, SPEFFZ_SCHEME);

    expect(result.flippedEdges.map((t) => t.cubie).sort()).toEqual(["UF", "UR"]);
    expect(result.twistedCorners.map((t) => t.cubie).sort()).toEqual(["UBR", "URF"]);
    expect(result.cornerTargets).toHaveLength(0);
    expect(result.edgeTargets).toHaveLength(0);
    expect(result.solvedCorners).not.toContain("URF");
    expect(result.solvedCorners).not.toContain("UBR");
  });
});

describe("decompose: input validation", () => {
  it("throws on an invalid cube state rather than silently decomposing nonsense", () => {
    const invalid = buildFacelets((chars) => {
      placeAt(chars, corner("URF").indices, corner("URF").faces, 1); // lone twist: illegal alone
    });
    expect(() => decompose(state(invalid), BUFFER, SPEFFZ_SCHEME)).toThrow();
  });

  it("throws if the buffer face isn't the reference (first) face of its home slot", () => {
    const badBuffer = { corners: "URF:R" as never, edges: "UF:U" as never };
    expect(() => decompose(state(SOLVED_FACELETS), badBuffer, SPEFFZ_SCHEME)).toThrow();
  });
});
