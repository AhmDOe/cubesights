// Provenance script for tests/fixtures/single-moves.ts (001-T5.3 / apply.test.ts).
//
// Derives the exact facelet-level effect of every one of the 18 basic single moves via pure 3D
// coordinate rotation, independent of cubing/kpuzzle or any other cube library -- this is the
// "hand-computed expected facelets" ground truth the ticket's TDD plan calls for. The rotation
// formulas (one per face, "clockwise viewed from outside that face") were each derived from the
// cube's coordinate geometry and independently cross-checked against physical move facts; run
// the sanity checks below (all should print true) if this script is ever modified.
//
// Regenerate single-moves.ts with:
//   node tests/fixtures/derive-single-move-facelets.mjs

const FACE_ORDER = ["U", "R", "F", "D", "L", "B"];
const SOLVED = FACE_ORDER.map((f) => f.repeat(9)).join("");

const NORMALS = {
  U: [0, 1, 0], D: [0, -1, 0],
  F: [0, 0, 1], B: [0, 0, -1],
  R: [1, 0, 0], L: [-1, 0, 0],
};

function posOf(face, row, col) {
  switch (face) {
    case "U": return [col - 1, 1, row - 1];
    case "D": return [col - 1, -1, 1 - row];
    case "F": return [col - 1, 1 - row, 1];
    case "B": return [1 - col, 1 - row, -1];
    case "R": return [1, 1 - row, 1 - col];
    case "L": return [-1, 1 - row, col - 1];
  }
}

// Inverse: given a face and a 3D position known to lie on that face, recover (row, col).
function rowColOf(face, [x, y, z]) {
  switch (face) {
    case "U": return [z + 1, x + 1];
    case "D": return [1 - z, x + 1];
    case "F": return [1 - y, x + 1];
    case "B": return [1 - y, 1 - x];
    case "R": return [1 - y, 1 - z];
    case "L": return [1 - y, z + 1];
  }
}

function normalToFace([nx, ny, nz]) {
  for (const face of FACE_ORDER) {
    const [fx, fy, fz] = NORMALS[face];
    if (fx === nx && fy === ny && fz === nz) return face;
  }
  throw new Error(`no face for normal ${[nx, ny, nz]}`);
}

const positions = [];
const normals = [];
for (let i = 0; i < 54; i++) {
  const face = FACE_ORDER[Math.floor(i / 9)];
  const row = Math.floor((i % 9) / 3);
  const col = i % 9 % 3;
  positions[i] = posOf(face, row, col);
  normals[i] = NORMALS[face];
}

function idx(face, row, col) {
  return FACE_ORDER.indexOf(face) * 9 + row * 3 + col;
}

const QUARTER_TURNS = {
  R: { axis: 0, value: 1, rotate: ([x, y, z]) => [x, z, -y] },
  L: { axis: 0, value: -1, rotate: ([x, y, z]) => [x, -z, y] },
  U: { axis: 1, value: 1, rotate: ([x, y, z]) => [-z, y, x] },
  D: { axis: 1, value: -1, rotate: ([x, y, z]) => [z, y, -x] },
  F: { axis: 2, value: 1, rotate: ([x, y, z]) => [y, -x, z] },
  B: { axis: 2, value: -1, rotate: ([x, y, z]) => [-y, x, z] },
};

function applyQuarterTurn(facelets, face) {
  const { axis, value, rotate } = QUARTER_TURNS[face];
  const next = facelets.split("");
  for (let i = 0; i < 54; i++) {
    if (positions[i][axis] !== value) continue;
    const newPos = rotate(positions[i]);
    const newNormal = rotate(normals[i]);
    const targetFace = normalToFace(newNormal);
    const [row, col] = rowColOf(targetFace, newPos);
    next[idx(targetFace, row, col)] = facelets[i];
  }
  return next.join("");
}

function applyMoveToken(facelets, token) {
  const face = token[0];
  const suffix = token.slice(1);
  if (suffix === "") return applyQuarterTurn(facelets, face);
  if (suffix === "2") return applyQuarterTurn(applyQuarterTurn(facelets, face), face);
  if (suffix === "'") {
    let r = facelets;
    for (let k = 0; k < 3; k++) r = applyQuarterTurn(r, face);
    return r;
  }
  throw new Error(`bad token ${token}`);
}

// Sanity checks.
for (const face of ["U", "D", "F", "B", "L", "R"]) {
  let r = SOLVED;
  for (let i = 0; i < 4; i++) r = applyQuarterTurn(r, face);
  console.log(`${face}^4 == SOLVED:`, r === SOLVED);
}
// R then R' should be identity.
console.log("R R' == SOLVED:", applyMoveToken(applyMoveToken(SOLVED, "R"), "R'") === SOLVED);
console.log("U U' == SOLVED:", applyMoveToken(applyMoveToken(SOLVED, "U"), "U'") === SOLVED);

const results = {};
for (const face of ["U", "D", "F", "B", "L", "R"]) {
  for (const suffix of ["", "2", "'"]) {
    const token = face + suffix;
    results[token] = applyMoveToken(SOLVED, token);
  }
}
console.log(JSON.stringify(results, null, 2));
