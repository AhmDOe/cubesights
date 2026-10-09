"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { toKTransformation } from "~/cube/core/adapters/kpuzzle";
import type { CubeState } from "~/cube/core/cube-state";
import { formatAlg, type Move, type MoveSequence } from "~/cube/core/notation";

/**
 * <CubeView> — the only file allowed to import cubing/twisty (001-R9). It is a plain React
 * component (not itself a dynamic() boundary); callers must wrap it with
 * `next/dynamic(() => import("~/components/CubeView"), { ssr: false })` because cubing/twisty
 * registers a custom element and touches WebGL at import time. This file also guards directly
 * (no-op on the server) so a missing dynamic() wrapper fails safe rather than crashing SSR.
 */

export interface CubeViewHandle {
  play(): void;
  pause(): void;
  jumpTo(index: number): void;
}

export interface CubeViewProps {
  state?: CubeState;
  alg?: MoveSequence;
  moveIndex?: number;
  highlight?: readonly number[];
  stickering?: string;
  interactive?: boolean;
  onMove?: (move: Move) => void;
}

// Minimal surface of cubing/twisty's TwistyPlayer that this file actually uses, so the rest of
// the component can be typed without importing cubing/twisty's types at module scope.
interface TwistyPlayerLike extends HTMLElement {
  puzzle: string;
  alg: string;
  hintFacelets: string;
  experimentalModel: {
    setupTransformation: { set(v: unknown): void };
  };
  controller: {
    togglePlay(play?: boolean): void;
    jumpToStart(): void;
    jumpToEnd(): void;
  };
}

function CubeViewInner(props: CubeViewProps, ref: Ref<CubeViewHandle>) {
  const { state, alg, moveIndex, highlight, stickering, onMove } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TwistyPlayerLike | null>(null);
  const [playerReady, setPlayerReady] = useState(false);

  // Mount: create the real TwistyPlayer once, client-side only. `playerReady` flips once it
  // exists so the state-sync effect below (which depends on it) runs even though the player
  // itself is created asynchronously, after this effect has already committed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let disposed = false;

    void import("cubing/twisty").then(({ TwistyPlayer }) => {
      if (disposed || !containerRef.current) return;
      const player = new TwistyPlayer({ puzzle: "3x3x3" }) as unknown as TwistyPlayerLike;
      containerRef.current.appendChild(player);
      playerRef.current = player;

      if (onMove) {
        player.addEventListener("move", (e: Event) => {
          const detail = (e as CustomEvent<{ move?: { toString(): string } }>).detail;
          if (detail?.move) onMove(detail.move.toString() as Move);
        });
      }

      setPlayerReady(true);
    });

    return () => {
      disposed = true;
      const player = playerRef.current;
      if (player?.parentNode) player.parentNode.removeChild(player);
      playerRef.current = null;
      setPlayerReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- player is created once; props sync in the effects below.
  }, []);

  // Sync the displayed cube state + playable alg whenever they change (or once the player
  // becomes ready).
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !state) return;
    let cancelled = false;
    void toKTransformation(state.facelets).then((transformation) => {
      if (cancelled || !playerRef.current) return;
      playerRef.current.experimentalModel.setupTransformation.set(transformation);
      playerRef.current.alg = alg ? formatAlg(alg) : "";
    });
    return () => {
      cancelled = true;
    };
  }, [state, alg, playerReady]);

  useEffect(() => {
    const player = playerRef.current;
    if (player && stickering) {
      (player as unknown as { experimentalStickering: string }).experimentalStickering = stickering;
    }
  }, [stickering, playerReady]);

  useEffect(() => {
    const player = playerRef.current;
    if (player) player.hintFacelets = "floating";
  }, [playerReady]);

  // moveIndex is handled via the imperative handle's jumpTo, but also react to prop changes so
  // scrubbing via a parent-controlled index (not just imperative calls) stays in sync.
  const jumpTo = (index: number) => {
    const player = playerRef.current;
    if (!player || !state || !alg) return;
    const prefix = alg.slice(0, index);
    void import("~/cube/core/apply").then(async ({ applyMoves }) => {
      const target = await applyMoves(state, prefix);
      const transformation = await toKTransformation(target.facelets);
      playerRef.current?.experimentalModel.setupTransformation.set(transformation);
      if (playerRef.current) playerRef.current.alg = "";
    });
  };

  useEffect(() => {
    if (moveIndex !== undefined) jumpTo(moveIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveIndex]);

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.controller.togglePlay(true),
    pause: () => playerRef.current?.controller.togglePlay(false),
    jumpTo,
  }));

  // highlight: best-effort visual emphasis via a data attribute; full implementation (hint
  // facelet overlays keyed by index) lands with the solution UI in ticket 005.
  const highlightAttr = highlight && highlight.length > 0 ? highlight.join(",") : undefined;

  return (
    <div
      ref={containerRef}
      data-testid="cube-view"
      data-highlight={highlightAttr}
      className="aspect-square w-full"
    />
  );
}

export const CubeView = forwardRef(CubeViewInner);
CubeView.displayName = "CubeView";
