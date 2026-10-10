import { describe, expect, it } from "vitest";
import { CORNER_STICKERS, EDGE_STICKERS } from "./cubies";
import { createCustomScheme, SPEFFZ_SCHEME, validateScheme } from "./scheme";

describe("SPEFFZ_SCHEME (@004-S14)", () => {
  it("is a valid bijection", () => {
    expect(validateScheme(SPEFFZ_SCHEME)).toEqual({ ok: true, errors: [] });
  });

  it("assigns a letter to every corner and every edge sticker, with no letter reused within a piece type", () => {
    const cornerLetters = new Set(CORNER_STICKERS.map((s) => SPEFFZ_SCHEME.cornerStickerToLetter.get(s.sticker)));
    const edgeLetters = new Set(EDGE_STICKERS.map((s) => SPEFFZ_SCHEME.edgeStickerToLetter.get(s.sticker)));
    expect(cornerLetters.size).toBe(24);
    expect(edgeLetters.size).toBe(24);
  });

  it("sticker-to-letter and letter-to-sticker are exact inverses over all 24 corner stickers", () => {
    for (const { sticker } of CORNER_STICKERS) {
      const letter = SPEFFZ_SCHEME.cornerStickerToLetter.get(sticker)!;
      expect(SPEFFZ_SCHEME.cornerLetterToSticker.get(letter)).toBe(sticker);
    }
  });

  it("sticker-to-letter and letter-to-sticker are exact inverses over all 24 edge stickers", () => {
    for (const { sticker } of EDGE_STICKERS) {
      const letter = SPEFFZ_SCHEME.edgeStickerToLetter.get(sticker)!;
      expect(SPEFFZ_SCHEME.edgeLetterToSticker.get(letter)).toBe(sticker);
    }
  });
});

describe("createCustomScheme (@004-S14)", () => {
  it("builds a valid, independent bijection from a reversed ordering", () => {
    const cornerOrder = CORNER_STICKERS.map((s) => s.sticker).slice().reverse();
    const edgeOrder = EDGE_STICKERS.map((s) => s.sticker).slice().reverse();
    const custom = createCustomScheme("reversed", cornerOrder, edgeOrder);
    expect(validateScheme(custom)).toEqual({ ok: true, errors: [] });
  });

  it("yields different letters than Speffz for the same sticker", () => {
    const cornerOrder = CORNER_STICKERS.map((s) => s.sticker).slice().reverse();
    const edgeOrder = EDGE_STICKERS.map((s) => s.sticker).slice().reverse();
    const custom = createCustomScheme("reversed", cornerOrder, edgeOrder);
    const sticker = CORNER_STICKERS[0]!.sticker;
    expect(custom.cornerStickerToLetter.get(sticker)).not.toBe(SPEFFZ_SCHEME.cornerStickerToLetter.get(sticker));
  });

  it("rejects an order that isn't exactly 24 stickers", () => {
    expect(() => createCustomScheme("bad", CORNER_STICKERS.slice(0, 23).map((s) => s.sticker), EDGE_STICKERS.map((s) => s.sticker))).toThrow();
  });
});
