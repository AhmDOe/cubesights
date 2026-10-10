/**
 * Provenance script for src/cube/solve/bld/setup.ts's tables (004-R10/R11): brute-force searches
 * short D/F/R (or U/L/D/F/B-ish) setup sequences and verifies each candidate directly against a
 * real cube model, rather than transcribing a published table from memory. Run with `node
 * tests/fixtures/bld/derive-setup-tables.mjs`. Not part of the test suite -- setup.test.ts is the
 * actual, continuously-run authority that those tables are correct; this script is how they were
 * found, kept for provenance (matching ticket 001's derive-single-move-facelets.mjs precedent).
 *
 * Key finding this script led to: bare `M2` is not a clean single 2-swap -- it always also swaps
 * the UF/DB edge pair as an intrinsic side effect of turning the whole M-slice. See setup.ts's own
 * header comment and the ticket's Open questions for what this means for the M2 table's coverage.
 */
import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";

const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();

function apply(pattern, algStr) {
  if (algStr.trim() === "") return pattern;
  return pattern.applyAlg(Alg.fromString(algStr));
}

// Reuse the project's own geometric tables by re-deriving them inline (small, self-contained,
// avoids needing ts-node for a one-off derivation script).
const FACE_ORDER = ["U", "R", "F", "D", "L", "B"];
function idx(face, row, col) {
  return FACE_ORDER.indexOf(face) * 9 + row * 3 + col;
}
const CORNERS = [
  { id: "URF", faces: ["U", "R", "F"], indices: [idx("U", 2, 2), idx("R", 0, 0), idx("F", 0, 2)] },
  { id: "UBR", faces: ["U", "B", "R"], indices: [idx("U", 0, 2), idx("B", 0, 0), idx("R", 0, 2)] },
  { id: "ULB", faces: ["U", "L", "B"], indices: [idx("U", 0, 0), idx("L", 0, 0), idx("B", 0, 2)] },
  { id: "UFL", faces: ["U", "F", "L"], indices: [idx("U", 2, 0), idx("F", 0, 0), idx("L", 0, 2)] },
  { id: "DFR", faces: ["D", "F", "R"], indices: [idx("D", 0, 2), idx("F", 2, 2), idx("R", 2, 0)] },
  { id: "DLF", faces: ["D", "L", "F"], indices: [idx("D", 0, 0), idx("L", 2, 2), idx("F", 2, 0)] },
  { id: "DBL", faces: ["D", "B", "L"], indices: [idx("D", 2, 0), idx("B", 2, 2), idx("L", 2, 0)] },
  { id: "DRB", faces: ["D", "R", "B"], indices: [idx("D", 2, 2), idx("R", 2, 2), idx("B", 2, 0)] },
];
const EDGES = [
  { id: "UR", faces: ["U", "R"], indices: [idx("U", 1, 2), idx("R", 0, 1)] },
  { id: "UF", faces: ["U", "F"], indices: [idx("U", 2, 1), idx("F", 0, 1)] },
  { id: "UL", faces: ["U", "L"], indices: [idx("U", 1, 0), idx("L", 0, 1)] },
  { id: "UB", faces: ["U", "B"], indices: [idx("U", 0, 1), idx("B", 0, 1)] },
  { id: "DR", faces: ["D", "R"], indices: [idx("D", 1, 2), idx("R", 2, 1)] },
  { id: "DF", faces: ["D", "F"], indices: [idx("D", 0, 1), idx("F", 2, 1)] },
  { id: "DL", faces: ["D", "L"], indices: [idx("D", 1, 0), idx("L", 2, 1)] },
  { id: "DB", faces: ["D", "B"], indices: [idx("D", 2, 1), idx("B", 2, 1)] },
  { id: "FR", faces: ["F", "R"], indices: [idx("F", 1, 2), idx("R", 1, 0)] },
  { id: "FL", faces: ["F", "L"], indices: [idx("F", 1, 0), idx("L", 1, 2)] },
  { id: "BL", faces: ["B", "L"], indices: [idx("B", 1, 2), idx("L", 1, 0)] },
  { id: "BR", faces: ["B", "R"], indices: [idx("B", 1, 0), idx("R", 1, 2)] },
];

// facelet string from a kpuzzle pattern, in our own URFDLB order, via the same orientation-sign
// convention this project already uses (ours = (3 - kpuzzle's) % 3 for corners; edges 1:1).
const KP_CORNER_NAMES = ["URF", "UBR", "ULB", "UFL", "DFR", "DLF", "DBL", "DRB"];
const KP_EDGE_NAMES = ["UF", "UR", "UB", "UL", "DF", "DR", "DB", "DL", "FR", "FL", "BR", "BL"];

function patternToFacelets(pattern) {
  const data = pattern.patternData;
  const chars = new Array(54).fill("?");
  for (let kpSlot = 0; kpSlot < 8; kpSlot++) {
    const piece = data.CORNERS.pieces[kpSlot];
    const kpOri = data.CORNERS.orientation[kpSlot];
    const ourOri = (3 - kpOri) % 3;
    const pieceId = KP_CORNER_NAMES[piece];
    const pieceDef = CORNERS.find((c) => c.id === pieceId);
    const slotDef = CORNERS.find((c) => c.id === KP_CORNER_NAMES[kpSlot]); // kpuzzle's own slot order.
    for (let i = 0; i < 3; i++) {
      chars[slotDef.indices[i]] = pieceDef.faces[(i + ourOri) % 3];
    }
  }
  for (let kpSlot = 0; kpSlot < 12; kpSlot++) {
    const piece = data.EDGES.pieces[kpSlot];
    const ori = data.EDGES.orientation[kpSlot];
    const pieceId = KP_EDGE_NAMES[piece];
    const pieceDef = EDGES.find((e) => e.id === pieceId);
    const slotDef = EDGES.find((e) => e.id === KP_EDGE_NAMES[kpSlot]);
    for (let i = 0; i < 2; i++) {
      chars[slotDef.indices[i]] = pieceDef.faces[(i + ori) % 2];
    }
  }
  for (const face of FACE_ORDER) chars[idx(face, 1, 1)] = face;
  return chars.join("");
}

function cornerAt(facelets, slotDef) {
  const read = slotDef.indices.map((i) => facelets[i]);
  const readSet = new Set(read);
  const piece = CORNERS.find((p) => {
    const s = new Set(p.faces);
    return s.size === readSet.size && [...s].every((f) => readSet.has(f));
  });
  let orientation = 0;
  for (let o = 0; o < 3; o++) {
    if (piece.faces.every((f, i) => f === read[(i + o) % 3])) {
      orientation = o;
      break;
    }
  }
  return { piece: piece.id, orientation };
}
function edgeAt(facelets, slotDef) {
  const read = slotDef.indices.map((i) => facelets[i]);
  const readSet = new Set(read);
  const piece = EDGES.find((p) => {
    const s = new Set(p.faces);
    return s.size === readSet.size && [...s].every((f) => readSet.has(f));
  });
  let orientation = 0;
  for (let o = 0; o < 2; o++) {
    if (piece.faces.every((f, i) => f === read[(i + o) % 2])) {
      orientation = o;
      break;
    }
  }
  return { piece: piece.id, orientation };
}

/** Checks that setup+swapAlg+invert(setup) performs EXACTLY swap(bufferId,targetId), nothing else
 * disturbed (position or orientation), for the given piece-type defs. */
function verifyTwoSwap(defs, analyzer, setupAlgStr, swapAlgStr, bufferId, targetId) {
  const setupAlg = setupAlgStr.trim() === "" ? null : Alg.fromString(setupAlgStr);
  let p = solved;
  if (setupAlg) p = p.applyAlg(setupAlg);
  p = p.applyAlg(Alg.fromString(swapAlgStr));
  if (setupAlg) p = p.applyAlg(setupAlg.invert());
  const facelets = patternToFacelets(p);

  for (const def of defs) {
    const { piece, orientation } = analyzer(facelets, def);
    const expectedPiece = def.id === bufferId ? targetId : def.id === targetId ? bufferId : def.id;
    if (piece !== expectedPiece) return { ok: false, reason: `slot ${def.id} has ${piece}, expected ${expectedPiece}` };
    if (expectedPiece === def.id && orientation !== 0) return { ok: false, reason: `slot ${def.id} (unaffected) has orientation ${orientation}` };
  }
  return { ok: true };
}

function* candidateAlgs(moveLetters, maxLen) {
  const mods = ["", "'", "2"];
  const atoms = moveLetters.flatMap((l) => mods.map((m) => l + m));
  function* rec(depth, prefix) {
    if (depth === 0) {
      yield prefix.join(" ");
      return;
    }
    for (const a of atoms) {
      // Avoid immediately repeating the same face (wasteful, and our move grammar only needs one
      // move per face in a short setup anyway).
      if (prefix.length > 0 && prefix[prefix.length - 1][0] === a[0]) continue;
      yield* rec(depth - 1, [...prefix, a]);
    }
  }
  for (let len = 0; len <= maxLen; len++) yield* rec(len, []);
}

function findSetup(defs, analyzer, moveLetters, maxLen, swapAlgStr, bufferId, targetId) {
  for (const candidate of candidateAlgs(moveLetters, maxLen)) {
    const result = verifyTwoSwap(defs, analyzer, candidate, swapAlgStr, bufferId, targetId);
    if (result.ok) return candidate;
  }
  return null;
}

/** Like verifyTwoSwap, but also permits one additional, named "companion" transposition --
 * M2 alone always swaps UF<->DB as an intrinsic side effect of swinging the whole M-slice, not
 * something any choice of setup can avoid (confirmed empirically: it's identical whether or not
 * a setup is applied, as long as the setup doesn't itself touch UF/DB). */
function verifyTwoSwapWithCompanion(defs, analyzer, setupAlgStr, swapAlgStr, bufferId, targetId, companionA, companionB) {
  const setupAlg = setupAlgStr.trim() === "" ? null : Alg.fromString(setupAlgStr);
  let p = solved;
  if (setupAlg) p = p.applyAlg(setupAlg);
  p = p.applyAlg(Alg.fromString(swapAlgStr));
  if (setupAlg) p = p.applyAlg(setupAlg.invert());
  const facelets = patternToFacelets(p);

  for (const def of defs) {
    const { piece, orientation } = analyzer(facelets, def);
    let expectedPiece = def.id;
    if (def.id === bufferId) expectedPiece = targetId;
    else if (def.id === targetId) expectedPiece = bufferId;
    else if (def.id === companionA) expectedPiece = companionB;
    else if (def.id === companionB) expectedPiece = companionA;
    if (piece !== expectedPiece) return { ok: false, reason: `slot ${def.id} has ${piece}, expected ${expectedPiece}` };
    if (expectedPiece === def.id && orientation !== 0) return { ok: false, reason: `slot ${def.id} (unaffected) has orientation ${orientation}` };
  }
  return { ok: true };
}

function findSetupWithCompanion(defs, analyzer, moveLetters, maxLen, swapAlgStr, bufferId, targetId, companionA, companionB) {
  for (const candidate of candidateAlgs(moveLetters, maxLen)) {
    const result = verifyTwoSwapWithCompanion(defs, analyzer, candidate, swapAlgStr, bufferId, targetId, companionA, companionB);
    if (result.ok) return candidate;
  }
  return null;
}

const Y_PERM = "R U' R' U' R U R' F' R U R' U' R' F R";
const T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'";
const M2 = "M2";

console.log("=== OP corners (buffer ULB, swap=Y-perm, setup moves D/F/R) ===");
for (const target of CORNERS.map((c) => c.id)) {
  if (target === "ULB") continue;
  if (target === "DFR") {
    console.log(`DFR: "" (already the swap slot)`);
    continue;
  }
  const setup = findSetup(CORNERS, cornerAt, ["D", "F", "R"], 2, Y_PERM, "ULB", target);
  console.log(`${target}: ${setup === null ? "NOT FOUND up to length 2" : JSON.stringify(setup)}`);
}

console.log("\n=== OP edges (buffer UR, swap=T-perm, setup moves U/L/D/Lw/Dw, len<=3) ===");
for (const target of EDGES.map((e) => e.id)) {
  if (target === "UR") continue;
  if (target === "UL") {
    console.log(`UL: "" (already the swap slot)`);
    continue;
  }
  const setup = findSetup(EDGES, edgeAt, ["U", "L", "D", "Lw", "Dw"], 3, T_PERM, "UR", target);
  console.log(`${target}: ${setup === null ? "NOT FOUND up to length 3" : JSON.stringify(setup)}`);
}

console.log(
  "\n=== M2 edges (buffer DF, swap=M2, setup U/R/L/D/F/B len<=3; UF<->DB companion-swap allowed) ===",
);
for (const target of EDGES.map((e) => e.id)) {
  if (target === "DF" || target === "UF" || target === "DB") continue; // special cases, handled separately.
  const setup = findSetupWithCompanion(EDGES, edgeAt, ["U", "R", "L", "D", "F", "B"], 3, M2, "DF", target, "UF", "DB");
  console.log(`${target}: ${setup === null ? "NOT FOUND up to length 3" : JSON.stringify(setup)}`);
}

console.log("\n=== M2 edges: the 3 special cases named in the PRD (FU=UF, BU=UB, BD=DB) ===");
console.log("UB (not entangled with the UF/DB companion pair):");
{
  const setup = findSetupWithCompanion(EDGES, edgeAt, ["U", "R", "L", "D", "F", "B"], 3, M2, "DF", "UB", "UF", "DB");
  console.log(` ${setup === null ? "NOT FOUND up to length 3" : JSON.stringify(setup)}`);
}
console.log("UF and DB are themselves the companion pair -- bringing one of them to UB while");
console.log("tracking what happens to the OTHER needs a 3-piece (not 2-swap) analysis; not");
console.log("attempted by this brute-force 2-swap search.");
