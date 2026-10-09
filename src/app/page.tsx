"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { CubeViewHandle } from "~/components/CubeView";
import { applyMoves } from "~/cube/core/apply";
import { createCubeState, type CubeState } from "~/cube/core/cube-state";
import { SOLVED_FACELETS } from "~/cube/core/facelets";
import { formatAlg, type MoveSequence } from "~/cube/core/notation";
import { generateScramble } from "~/cube/core/scramble";

// cubing/twisty registers a custom element and touches WebGL at import time, so <CubeView> is
// loaded client-only (001-R9).
const CubeView = dynamic(() => import("~/components/CubeView").then((m) => m.CubeView), {
  ssr: false,
  loading: () => <div data-testid="cube-view-loading" className="aspect-square w-full animate-pulse rounded-lg bg-neutral-800" />,
});

export default function Home() {
  const [state, setState] = useState<CubeState>(() => createCubeState(SOLVED_FACELETS, "scramble"));
  const [alg, setAlg] = useState<MoveSequence>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cubeRef = useRef<CubeViewHandle>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleScramble() {
    try {
      const moves = await generateScramble();
      const solved = createCubeState(SOLVED_FACELETS, "scramble");
      const scrambled = await applyMoves(solved, moves, "scramble");
      if (!mountedRef.current) return;
      setState(scrambled);
      setAlg(moves);
      setMoveIndex(0);
      setError(null);
    } catch (cause) {
      if (!mountedRef.current) return;
      setError(cause instanceof Error ? cause.message : "Could not generate a scramble.");
    }
  }

  function next() {
    setMoveIndex((i) => Math.min(i + 1, alg.length));
  }

  function prev() {
    setMoveIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-neutral-950 px-4 py-8 text-white">
      <h1 className="text-2xl font-semibold">CubeSights</h1>

      <div className="w-full max-w-sm">
        <CubeView ref={cubeRef} state={state} alg={alg} moveIndex={moveIndex} />
      </div>

      <p className="min-h-6 max-w-sm text-center font-mono text-sm text-neutral-300" data-testid="alg-text">
        {alg.length > 0 ? formatAlg(alg) : "No scramble yet"}
      </p>

      {error && (
        <p role="alert" data-testid="scramble-error" className="max-w-sm text-center text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={prev}
          disabled={moveIndex === 0}
          className="rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={next}
          disabled={moveIndex >= alg.length}
          className="rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Next
        </button>
        <button
          type="button"
          onClick={handleScramble}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold"
        >
          Scramble
        </button>
      </div>
    </main>
  );
}
