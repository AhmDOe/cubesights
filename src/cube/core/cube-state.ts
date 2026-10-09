import type { FaceletString } from "./facelets";

export type CubeStateSource = "smart-cube" | "camera" | "manual" | "scramble";

export interface CubeState {
  readonly facelets: FaceletString;
  readonly source: CubeStateSource;
  readonly capturedAt: number;
  readonly confidence?: number;
}

export interface CreateCubeStateOptions {
  readonly capturedAt?: number;
  readonly confidence?: number;
}

/** Builds an immutable CubeState. This is the only value every subsystem produces or consumes. */
export function createCubeState(
  facelets: FaceletString,
  source: CubeStateSource,
  options: CreateCubeStateOptions = {},
): CubeState {
  const state: CubeState = {
    facelets,
    source,
    capturedAt: options.capturedAt ?? Date.now(),
    ...(options.confidence !== undefined ? { confidence: options.confidence } : {}),
  };
  return Object.freeze(state);
}
