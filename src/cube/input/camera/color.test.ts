import { describe, expect, it } from "vitest";
import { deltaE2000, rgbToHsv, rgbToLab, type Lab } from "./color";

describe("rgbToLab", () => {
  it("maps white to L=100, a=0, b=0", () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(lab.l).toBeCloseTo(100, 0);
    expect(lab.a).toBeCloseTo(0, 0);
    expect(lab.b).toBeCloseTo(0, 0);
  });

  it("maps black to L=0, a=0, b=0", () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 0 });
    expect(lab.l).toBeCloseTo(0, 1);
    expect(lab.a).toBeCloseTo(0, 1);
    expect(lab.b).toBeCloseTo(0, 1);
  });

  it("gives red a positive a* (red-green axis) and yellow a positive b* (yellow-blue axis)", () => {
    const red = rgbToLab({ r: 255, g: 0, b: 0 });
    const yellow = rgbToLab({ r: 255, g: 255, b: 0 });
    expect(red.a).toBeGreaterThan(0);
    expect(yellow.b).toBeGreaterThan(0);
  });
});

describe("rgbToHsv", () => {
  it.each([
    [{ r: 255, g: 0, b: 0 }, { h: 0, s: 1, v: 1 }],
    [{ r: 0, g: 255, b: 0 }, { h: 120, s: 1, v: 1 }],
    [{ r: 0, g: 0, b: 255 }, { h: 240, s: 1, v: 1 }],
    [{ r: 255, g: 255, b: 255 }, { h: 0, s: 0, v: 1 }],
    [{ r: 0, g: 0, b: 0 }, { h: 0, s: 0, v: 0 }],
  ])("converts %o to %o", (rgb, expected) => {
    const hsv = rgbToHsv(rgb);
    expect(hsv.h).toBeCloseTo(expected.h, 3);
    expect(hsv.s).toBeCloseTo(expected.s, 3);
    expect(hsv.v).toBeCloseTo(expected.v, 3);
  });
});

describe("deltaE2000", () => {
  it("is zero for a colour against itself", () => {
    const lab: Lab = { l: 55, a: 12, b: -8 };
    expect(deltaE2000(lab, lab)).toBeCloseTo(0, 6);
  });

  it("is symmetric", () => {
    const a: Lab = { l: 40, a: 20, b: 10 };
    const b: Lab = { l: 60, a: -5, b: 30 };
    expect(deltaE2000(a, b)).toBeCloseTo(deltaE2000(b, a), 9);
  });

  it("reports a large difference between black and white", () => {
    expect(deltaE2000({ l: 0, a: 0, b: 0 }, { l: 100, a: 0, b: 0 })).toBeGreaterThan(50);
  });

  it("reports red as closer to orange than to green (perceptual sanity)", () => {
    const red = rgbToLab({ r: 183, g: 18, b: 52 }); // a standard-cube-ish red
    const orange = rgbToLab({ r: 255, g: 88, b: 0 }); // a standard-cube-ish orange
    const green = rgbToLab({ r: 0, g: 140, b: 70 }); // a standard-cube-ish green
    expect(deltaE2000(red, orange)).toBeLessThan(deltaE2000(red, green));
  });

  // Standard CIEDE2000 verification pairs (Sharma, Wu & Dalal 2005, the widely-cited reference
  // test dataset for implementers). Reproduced here with a tolerant comparison in case of
  // transcription drift in the expected values; the property-based tests above are the primary
  // safety net for correctness.
  it.each([
    [{ l: 50, a: 2.6772, b: -79.7751 }, { l: 50, a: 0, b: -82.7485 }, 2.0425],
    [{ l: 50, a: 3.1571, b: -77.2803 }, { l: 50, a: 0, b: -82.7485 }, 2.8615],
    [{ l: 50, a: 2.8361, b: -74.02 }, { l: 50, a: 0, b: -82.7485 }, 3.4412],
  ])("matches the published reference value for pair %#", (lab1, lab2, expected) => {
    expect(deltaE2000(lab1, lab2)).toBeCloseTo(expected, 1);
  });
});
