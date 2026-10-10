import { describe, expect, it } from "vitest";
import { mapVendorFaceletsToCanonical, VendorFaceletMappingError } from "./facelet-mapping";
import { SOLVED_FACELETS } from "~/cube/core/facelets";

/**
 * Synthetic stand-ins for recorded vendor payloads — not captured from real hardware (none was
 * available in this session; see ticket 002 Open question R6). Each represents "what the vendor
 * library's toKociembaFacelets()/toFaceCube() is believed to emit for a solved cube", which is
 * trivially the solved string for every vendor regardless of internal ordering differences
 * (a solved cube reads the same in any face-based ordering). Real recorded samples — ideally
 * including a *scrambled* state per vendor, which would actually distinguish ordering bugs — are
 * a prerequisite for 002-T14's hardware sign-off.
 */
const RECORDED_SOLVED_SAMPLES: Record<string, string> = {
  "gan-gen3": SOLVED_FACELETS,
  qiyi: SOLVED_FACELETS,
  giiker: SOLVED_FACELETS,
  gocube: SOLVED_FACELETS,
  "moyu-mhc": SOLVED_FACELETS,
};

describe("mapVendorFaceletsToCanonical", () => {
  it.each(Object.entries(RECORDED_SOLVED_SAMPLES))("accepts the %s solved sample", (_vendor, raw) => {
    expect(mapVendorFaceletsToCanonical(raw)).toBe(SOLVED_FACELETS);
  });

  it("rejects the wrong length", () => {
    expect(() => mapVendorFaceletsToCanonical("UUU")).toThrow(VendorFaceletMappingError);
  });

  it("rejects characters outside U R F D L B (e.g. a raw colour string, not coerced)", () => {
    const colourString = "W".repeat(54);
    expect(() => mapVendorFaceletsToCanonical(colourString)).toThrow(VendorFaceletMappingError);
  });

  it("rejects a structurally invalid (but correctly-charactered) facelet string rather than coercing it", () => {
    // One flipped edge in place — same approach as validate.test.ts's ONE_FLIPPED_EDGE fixture.
    const chars = SOLVED_FACELETS.split("");
    [chars[7], chars[19]] = [chars[19]!, chars[7]!]; // UF edge's U/F stickers swapped
    const invalid = chars.join("");
    expect(() => mapVendorFaceletsToCanonical(invalid)).toThrow(VendorFaceletMappingError);
  });
});
