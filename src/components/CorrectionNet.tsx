"use client";

import { useMemo, useState } from "react";
import { FACE_ORDER, type Face, type FaceletString } from "~/cube/core/facelets";
import {
  ColorResolutionError,
  resolveColorFaceletsToFacelets,
  STICKER_COLORS,
  type ColorFacelets,
  type ObservedColor,
  type StickerColor,
} from "~/cube/core/colors";
import { validateFacelets } from "~/cube/core/validate";

/**
 * CorrectionNet (003-R10/R11): a self-contained flat 2D net. Tapping a sticker cycles its colour
 * and the validator re-runs immediately, so Solve enables the instant the state becomes legal —
 * no separate "revalidate" step. Every sticker is a native <button>, which gets keyboard
 * operability (Enter/Space activate it, Tab moves focus) for free rather than needing bespoke
 * key handling.
 */

const SWATCH_HEX: Record<StickerColor, string> = {
  W: "#f5f5f5",
  Y: "#ffd500",
  R: "#b71234",
  O: "#ff5800",
  G: "#008c46",
  B: "#004197",
};

const COLOR_NAME: Record<StickerColor, string> = {
  W: "white",
  Y: "yellow",
  R: "red",
  O: "orange",
  G: "green",
  B: "blue",
};

function cycleColor(current: ObservedColor): StickerColor {
  if (current === "unknown") return STICKER_COLORS[0];
  const i = STICKER_COLORS.indexOf(current);
  return STICKER_COLORS[(i + 1) % STICKER_COLORS.length]!;
}

interface ColorValidation {
  readonly ok: boolean;
  readonly facelets: FaceletString | null;
  readonly message: string | null;
  readonly indices: readonly number[];
}

function validateColors(colors: ColorFacelets): ColorValidation {
  try {
    const facelets = resolveColorFaceletsToFacelets(colors);
    const result = validateFacelets(facelets);
    if (result.ok) return { ok: true, facelets: result.facelets, message: null, indices: [] };
    return { ok: false, facelets: null, message: result.error.message, indices: result.error.indices };
  } catch (e) {
    if (e instanceof ColorResolutionError) {
      return { ok: false, facelets: null, message: e.message, indices: e.indices };
    }
    throw e;
  }
}

// Flat net layout: U sits above the F/R/B/L band, D sits below it — a 4-column x 3-row
// arrangement of 3x3 faces, matching the standard cube net diagram.
const NET_POSITIONS: Record<Face, { readonly col: number; readonly row: number }> = {
  U: { col: 2, row: 1 },
  L: { col: 1, row: 2 },
  F: { col: 2, row: 2 },
  R: { col: 3, row: 2 },
  B: { col: 4, row: 2 },
  D: { col: 2, row: 3 },
};

export interface CorrectionNetProps {
  readonly initialColors: ColorFacelets;
  readonly lowConfidenceIndices?: readonly number[];
  readonly onSolve: (facelets: FaceletString) => void;
}

export function CorrectionNet({ initialColors, lowConfidenceIndices = [], onSolve }: CorrectionNetProps) {
  const [colors, setColors] = useState<ColorFacelets>(initialColors);
  const validation = useMemo(() => validateColors(colors), [colors]);

  function handleTap(index: number) {
    setColors((prev) => prev.map((c, i) => (i === index ? cycleColor(c) : c)));
  }

  return (
    <div data-testid="correction-net">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: "repeat(4, auto)", gridTemplateRows: "repeat(3, auto)" }}
      >
        {FACE_ORDER.map((face) => {
          const base = FACE_ORDER.indexOf(face) * 9;
          const pos = NET_POSITIONS[face];
          return (
            <div
              key={face}
              data-testid={`net-face-${face}`}
              className="grid grid-cols-3 grid-rows-3 gap-px"
              style={{ gridColumn: pos.col, gridRow: pos.row }}
            >
              {Array.from({ length: 9 }, (_, i) => {
                const index = base + i;
                const color = colors[index]!;
                const isError = validation.indices.includes(index);
                const isLowConfidence = lowConfidenceIndices.includes(index);
                const label =
                  color === "unknown"
                    ? `${face} sticker ${i + 1}, unset, tap to set a colour`
                    : `${face} sticker ${i + 1}, ${COLOR_NAME[color]}${isLowConfidence ? ", low confidence" : ""}${isError ? ", flagged as an error" : ""}, tap to change`;
                return (
                  <button
                    key={index}
                    type="button"
                    data-testid={`net-sticker-${index}`}
                    data-error={isError}
                    data-low-confidence={isLowConfidence}
                    aria-label={label}
                    onClick={() => handleTap(index)}
                    className="h-6 w-6 border"
                    style={{
                      backgroundColor: color === "unknown" ? "#888" : SWATCH_HEX[color],
                      borderColor: isError ? "#ff0000" : isLowConfidence ? "#ffaa00" : "#333",
                      borderWidth: isError ? 3 : isLowConfidence ? 2 : 1,
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {validation.message && (
        <p role="alert" data-testid="correction-error-message" className="mt-2 text-sm text-red-400">
          {validation.message}
        </p>
      )}

      <button
        type="button"
        data-testid="solve-button"
        disabled={!validation.ok}
        onClick={() => {
          if (validation.ok && validation.facelets) onSolve(validation.facelets);
        }}
        className="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold disabled:opacity-40"
      >
        Solve
      </button>
    </div>
  );
}
