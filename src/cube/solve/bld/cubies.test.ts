import { describe, expect, it } from "vitest";
import { CORNERS, EDGES } from "~/cube/core/validate";
import {
  ALL_STICKERS,
  CORNER_STICKERS,
  cubieStickers,
  EDGE_STICKERS,
  faceletToSticker,
  stickerInfo,
  stickerToFacelet,
  type CubieId,
} from "./cubies";

describe("cubies", () => {
  it("enumerates exactly 24 corner stickers and 24 edge stickers", () => {
    expect(CORNER_STICKERS).toHaveLength(24);
    expect(EDGE_STICKERS).toHaveLength(24);
    expect(ALL_STICKERS).toHaveLength(48);
  });

  it("has no duplicate sticker names", () => {
    const names = new Set(ALL_STICKERS.map((s) => s.sticker));
    expect(names.size).toBe(48);
  });

  it("has no duplicate facelet indices (every sticker is a distinct physical position)", () => {
    const facelets = new Set(ALL_STICKERS.map((s) => s.facelet));
    expect(facelets.size).toBe(48);
  });

  it("stickerToFacelet / faceletToSticker are exact inverses over all 48 stickers", () => {
    for (const { sticker, facelet } of ALL_STICKERS) {
      expect(stickerToFacelet(sticker)).toBe(facelet);
      expect(faceletToSticker(facelet)).toBe(sticker);
    }
  });

  it("throws for an unknown sticker or a centre facelet", () => {
    expect(() => stickerInfo("NOPE:U" as never)).toThrow();
    expect(() => faceletToSticker(4)).toThrow(); // U centre
  });

  it("derives corner stickers directly from validate.ts's CORNERS table (no hardcoded duplication)", () => {
    for (const corner of CORNERS) {
      const stickers = cubieStickers(corner.id as CubieId, "corner");
      expect(stickers).toHaveLength(3);
      corner.faces.forEach((face, i) => {
        const match = stickers.find((s) => s.face === face);
        expect(match?.facelet).toBe(corner.indices[i]);
      });
    }
  });

  it("derives edge stickers directly from validate.ts's EDGES table (no hardcoded duplication)", () => {
    for (const edge of EDGES) {
      const stickers = cubieStickers(edge.id as CubieId, "edge");
      expect(stickers).toHaveLength(2);
      edge.faces.forEach((face, i) => {
        const match = stickers.find((s) => s.face === face);
        expect(match?.facelet).toBe(edge.indices[i]);
      });
    }
  });
});
