import { assertFaceletString, isFaceletString, type FaceletString } from "~/cube/core/facelets";
import { validateFacelets } from "~/cube/core/validate";

/**
 * Converts a vendor-reported facelet string to our canonical URFDLB FaceletString (002-R2),
 * validating structurally before accepting rather than coercing.
 *
 * smartcube-web-bluetooth's GAN-family protocols build their FACELETS payload via its own
 * `toKociembaFacelets()` helper, whose name and 54-char URFDLB-ordered output format matches our
 * canonical convention (001-R2) directly — confirmed by reading the library's source. Its
 * Giiker-family protocols build facelets via a different internal `CubieCube.toFaceCube()` path
 * using Giiker-specific ordering constants, whose exact character order relative to ours has NOT
 * been independently verified against real hardware (no physical Giiker/QiYi/MoYu device was
 * available in this session — see ticket 002 Open question R6). For both families this function
 * applies the same safety net: the result must satisfy validateFacelets before being accepted,
 * so a wrong permutation is rejected as structurally invalid rather than silently trusted.
 */
export class VendorFaceletMappingError extends Error {
  constructor(
    readonly raw: string,
    message: string,
  ) {
    super(message);
    this.name = "VendorFaceletMappingError";
  }
}

export function mapVendorFaceletsToCanonical(raw: string): FaceletString {
  if (raw.length !== 54) {
    throw new VendorFaceletMappingError(raw, `Expected a 54-character facelet string, got length ${raw.length}`);
  }
  if (!isFaceletString(raw)) {
    throw new VendorFaceletMappingError(raw, "Facelet string contains characters outside U R F D L B");
  }
  const result = validateFacelets(raw);
  if (!result.ok) {
    throw new VendorFaceletMappingError(raw, `Facelets failed validation: ${result.error.code} — ${result.error.message}`);
  }
  return assertFaceletString(raw);
}
