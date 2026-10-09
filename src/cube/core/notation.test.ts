import { describe, expect, it } from "vitest";
import { NotationError, formatAlg, parseAlg } from "./notation";

const ROUND_TRIP_ALGS = [
  "R",
  "R'",
  "R2",
  "U R F D L B",
  "Uw Rw' Fw2",
  "M E S",
  "x y z",
  "x2 y' z2",
  "R U2 Rw' M x2 (F' D)",
  "R U R' U' R U R' U'",
];

describe("parseAlg / formatAlg", () => {
  it.each(ROUND_TRIP_ALGS)("@001-S11 round-trips %s through parse -> format -> parse", (text) => {
    const moves = parseAlg(text);
    expect(moves.length).toBeGreaterThan(0);
    const formatted = formatAlg(moves);
    const reparsed = parseAlg(formatted);
    // The formatted text must parse to an Alg whose *expanded leaf moves* equal the original
    // (not necessarily a structurally "isIdentical" Alg — flattening a grouping like "(F' D)"
    // into "F' D" is a deliberate, documented change in structure, not in meaning).
    expect(reparsed).toEqual(moves);
  });

  it("flattens groupings into a flat leaf move list", () => {
    const moves = parseAlg("R U2 Rw' M x2 (F' D)");
    expect(moves).toEqual(["R", "U2", "Rw'", "M", "x2", "F'", "D"]);
  });

  it("@001-S11 rejects a malformed token and names it", () => {
    expect.assertions(2);
    try {
      parseAlg("R U 7 Q'");
    } catch (e) {
      expect(e).toBeInstanceOf(NotationError);
      expect((e as NotationError).token).toBe("7");
    }
  });

  it("formatAlg produces stable, canonical spacing with no redundant amount suffixes", () => {
    const moves = parseAlg("R  U2   D'");
    expect(formatAlg(moves)).toBe("R U2 D'");
  });
});
