"use client";

import { FACE_ORDER, type Face } from "~/cube/core/facelets";
import type { StickerColor } from "~/cube/core/colors";
import type { FaceReading } from "~/cube/input/camera/classify";
import { computeCells, computeROI } from "~/cube/input/camera/geometry";

/**
 * ScanOverlay (003-R3/R7): a purely presentational grid overlay — the prompt text is computed
 * by the caller (derived from the centre colours already seen, 003-R7) rather than hardcoded
 * here, since a non-standard colour scheme means "white centre" isn't always true.
 */

const SWATCH_HEX: Record<StickerColor, string> = {
  W: "#f5f5f5",
  Y: "#ffd500",
  R: "#b71234",
  O: "#ff5800",
  G: "#008c46",
  B: "#004197",
};

export interface ScanOverlayProps {
  readonly currentFace: Face;
  readonly promptText: string;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly latestReading: FaceReading | null;
  readonly committedFaces: Partial<Record<Face, readonly StickerColor[]>>;
  readonly onRecapture: (face: Face) => void;
}

export function ScanOverlay({
  currentFace,
  promptText,
  viewportWidth,
  viewportHeight,
  latestReading,
  committedFaces,
  onRecapture,
}: ScanOverlayProps) {
  const roi = computeROI(viewportWidth, viewportHeight);
  const cells = computeCells(roi);

  return (
    <div className="relative" style={{ width: viewportWidth, height: viewportHeight }} data-testid="scan-overlay">
      <p data-testid="face-label" className="sr-only">
        {currentFace}
      </p>
      <p data-testid="scan-prompt" className="absolute left-0 top-0 w-full p-2 text-center text-sm text-white">
        {promptText}
      </p>

      <div
        data-testid="scan-grid"
        className="absolute border-2 border-white/70"
        style={{ left: roi.x, top: roi.y, width: roi.width, height: roi.height }}
      >
        {cells.map((cell, i) => {
          const sticker = latestReading?.stickers[i];
          const background = sticker ? SWATCH_HEX[sticker.color] : "transparent";
          return (
            <div
              key={i}
              data-testid={`sticker-chip-${i}`}
              data-uncertain={sticker?.uncertain ?? false}
              className="absolute border border-white/40"
              style={{
                left: cell.x - roi.x,
                top: cell.y - roi.y,
                width: cell.width,
                height: cell.height,
                backgroundColor: background,
                opacity: sticker ? (sticker.uncertain ? 0.5 : 0.85) : 0,
              }}
            />
          );
        })}
      </div>

      <div data-testid="face-thumbnails" className="absolute bottom-0 left-0 flex w-full justify-center gap-2 p-2">
        {FACE_ORDER.filter((face) => committedFaces[face] !== undefined).map((face) => (
          <button
            key={face}
            type="button"
            data-testid={`thumbnail-${face}`}
            onClick={() => onRecapture(face)}
            className="grid h-8 w-8 grid-cols-3 grid-rows-3 overflow-hidden rounded border border-white/60"
            aria-label={`Re-capture ${face} face`}
          >
            {committedFaces[face]!.map((color, i) => (
              <span key={i} style={{ backgroundColor: SWATCH_HEX[color] }} />
            ))}
          </button>
        ))}
      </div>
    </div>
  );
}
