/**
 * Color science for the camera scanner (003-R4/R5): sRGB -> CIELAB and sRGB -> HSV conversion,
 * and the CIEDE2000 perceptual colour-difference formula (Sharma, Wu & Dalal 2005), the same
 * standard metric used by professional colour-matching tools. CIELAB is used for classification
 * (003-R5); HSV is kept alongside because it's the cheaper signal for the glare/luminance gates
 * (003-R9).
 */

export interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}
export interface Lab {
  readonly l: number;
  readonly a: number;
  readonly b: number;
}
export interface HSV {
  readonly h: number;
  readonly s: number;
  readonly v: number;
}

function srgbChannelToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

// sRGB (D65) -> XYZ, using the standard sRGB primaries matrix, scaled to [0,100].
function rgbToXyz({ r, g, b }: RGB): { x: number; y: number; z: number } {
  const rl = srgbChannelToLinear(r);
  const gl = srgbChannelToLinear(g);
  const bl = srgbChannelToLinear(b);
  return {
    x: (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) * 100,
    y: (rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175) * 100,
    z: (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) * 100,
  };
}

const D65 = { x: 95.047, y: 100.0, z: 108.883 };
const LAB_DELTA = 6 / 29;

function labF(t: number): number {
  return t > LAB_DELTA ** 3 ? Math.cbrt(t) : t / (3 * LAB_DELTA * LAB_DELTA) + 4 / 29;
}

export function rgbToLab(rgb: RGB): Lab {
  const { x, y, z } = rgbToXyz(rgb);
  const fx = labF(x / D65.x);
  const fy = labF(y / D65.y);
  const fz = labF(z / D65.z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, v };
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** CIEDE2000 (kL = kC = kH = 1), the standard perceptual colour difference metric. */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const { l: L1, a: a1, b: b1 } = lab1;
  const { l: L2, a: a2, b: b2 } = lab2;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;

  const Cbar7 = Cbar ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const h1p = a1p === 0 && b1 === 0 ? 0 : (radToDeg(Math.atan2(b1, a1p)) + 360) % 360;
  const h2p = a2p === 0 && b2 === 0 ? 0 : (radToDeg(Math.atan2(b2, a2p)) + 360) % 360;

  const deltaLp = L2 - L1;
  const deltaCp = C2p - C1p;

  let deltahp: number;
  if (C1p * C2p === 0) {
    deltahp = 0;
  } else {
    let dh = h2p - h1p;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
    deltahp = dh;
  }
  const deltaHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(degToRad(deltahp) / 2);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp: number;
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hbarp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hbarp = (h1p + h2p + 360) / 2;
  } else {
    hbarp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(degToRad(hbarp - 30)) +
    0.24 * Math.cos(degToRad(2 * hbarp)) +
    0.32 * Math.cos(degToRad(3 * hbarp + 6)) -
    0.2 * Math.cos(degToRad(4 * hbarp - 63));

  const SL = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;

  const Cbarp7 = Cbarp ** 7;
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 25 ** 7));
  const deltaTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const RT = -Math.sin(degToRad(2 * deltaTheta)) * RC;

  const termL = deltaLp / SL;
  const termC = deltaCp / SC;
  const termH = deltaHp / SH;

  return Math.sqrt(termL * termL + termC * termC + termH * termH + RT * termC * termH);
}
