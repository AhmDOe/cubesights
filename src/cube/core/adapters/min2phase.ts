import { SOLVED_FACELETS, assertFaceletString, type FaceletString } from "../facelets";

/**
 * min2phase (and virtually every Kociemba two-phase implementation) consumes/produces a 54-char
 * URFDLB facelet string identical to our own canonical form (001-R2), so these are identity
 * conversions in practice. The guard below is what ticket 004's Min2PhaseEngine runs at init —
 * see Open question R2: if a chosen min2phase build ever used a different facelet order, this
 * throws immediately instead of letting every solve silently be wrong.
 */

export function toMin2PhaseFacelets(facelets: FaceletString): string {
  return facelets;
}

export function fromMin2PhaseFacelets(facelets: string): FaceletString {
  return assertFaceletString(facelets);
}

const EXPECTED_MIN2PHASE_SOLVED = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

export class Min2PhaseFaceletOrderMismatchError extends Error {
  constructor() {
    super(
      `min2phase facelet-order assumption violated: expected solved state ` +
        `"${EXPECTED_MIN2PHASE_SOLVED}" to round-trip identically through toMin2PhaseFacelets.`,
    );
    this.name = "Min2PhaseFaceletOrderMismatchError";
  }
}

/** Throws if our canonical facelet order ever diverges from min2phase's expected order. */
export function assertMin2PhaseFaceletOrderAssumption(): void {
  if (toMin2PhaseFacelets(SOLVED_FACELETS) !== EXPECTED_MIN2PHASE_SOLVED) {
    throw new Min2PhaseFaceletOrderMismatchError();
  }
}
