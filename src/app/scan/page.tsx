"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CorrectionNet } from "~/components/CorrectionNet";
import { ScanOverlay } from "~/components/ScanOverlay";
import type { ColorFacelets } from "~/cube/core/colors";
import { FACE_ORDER, type Face, type FaceletString } from "~/cube/core/facelets";
import { createCubeState, type CubeState } from "~/cube/core/cube-state";
import { assemble, lowConfidenceIndices as computeLowConfidenceIndices, type FaceReadings } from "~/cube/input/camera/assemble";
import { DEFAULT_PALETTE } from "~/cube/input/camera/calibrate";
import { classifyFrame, type FaceReading } from "~/cube/input/camera/classify";
import { computeROI } from "~/cube/input/camera/geometry";
import { checkIlluminationGates, normalizeIllumination } from "~/cube/input/camera/illumination";
import {
  committedColors,
  createStabilityState,
  pushFrame,
  type StabilityState,
} from "~/cube/input/camera/stability";

/**
 * /scan (003): the camera/worker/RAF loop here is the "thin shell" 003-R13 describes — every
 * colour decision happens in classifyFrame, which is exhaustively unit-tested on its own. This
 * page's own test coverage is deliberately scoped to what the ticket's own test plan calls for
 * (permission/hardware error paths, visibility-change teardown/restart): jsdom has no working 2D
 * canvas backend, so the live pixel loop below can only be exercised by a real browser — the
 * Playwright E2E spec covers that and needs a real camera or a generated Y4M fixture, neither of
 * which is available in this sandbox (see ticket Open questions).
 */

const CubeView = dynamic(() => import("~/components/CubeView").then((m) => m.CubeView), { ssr: false });

type ScanErrorKind = "permission-denied" | "no-camera" | "over-constrained" | "hardware-error" | "unsupported";

const ERROR_MESSAGES: Record<ScanErrorKind, string> = {
  "permission-denied": "Camera access was blocked. Re-enable it in your browser's site settings, then reload.",
  "no-camera": "No camera was found on this device.",
  "over-constrained": "This camera doesn't support the requested video settings.",
  "hardware-error": "The camera couldn't be started — it may be in use by another app.",
  unsupported: "Your browser doesn't support camera capture.",
};

const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
  audio: false,
};

function classifyGetUserMediaError(e: unknown): ScanErrorKind {
  if (e instanceof DOMException) {
    if (e.name === "NotAllowedError" || e.name === "SecurityError") return "permission-denied";
    if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") return "no-camera";
    if (e.name === "OverconstrainedError" || e.name === "ConstraintNotSatisfiedError") return "over-constrained";
  }
  return "hardware-error";
}

type Phase = "idle" | "requesting" | "scanning" | "correction" | "done" | "error";

export default function ScanPage() {
  const [mounted, setMounted] = useState(false);
  const [supported, setSupported] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorKind, setErrorKind] = useState<ScanErrorKind | null>(null);
  const [currentFaceIndex, setCurrentFaceIndex] = useState(0);
  const [latestReading, setLatestReading] = useState<FaceReading | null>(null);
  const [cubeState, setCubeState] = useState<CubeState | null>(null);
  const [correctionColors, setCorrectionColors] = useState<ColorFacelets | null>(null);
  const [correctionLowConfidence, setCorrectionLowConfidence] = useState<readonly number[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceReadingsRef = useRef<FaceReadings>({} as FaceReadings);
  const stabilityRef = useRef<StabilityState>(createStabilityState());
  const paletteRef = useRef(DEFAULT_PALETTE);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
    setSupported(typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function");
  }, []);

  const stopStream = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const palette = paletteRef.current;
    if (!video || video.videoWidth === 0) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    ctx.drawImage(video, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const roi = computeROI(canvas.width, canvas.height);
    const gate = checkIlluminationGates(data, canvas.width, roi);
    if (gate.ok) {
      const normalized = normalizeIllumination(data, canvas.width, roi);
      const reading = classifyFrame(normalized, canvas.width, canvas.height, palette);
      setLatestReading(reading);
      stabilityRef.current = pushFrame(stabilityRef.current, reading);
      const colors = committedColors(stabilityRef.current);
      if (colors) commitCurrentFace(reading);
    }

    rafRef.current = requestAnimationFrame(processFrame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commitCurrentFace is stable via its own ref-based closure below.
  }, []);

  function commitCurrentFace(reading: FaceReading) {
    const face = FACE_ORDER[currentFaceIndex];
    if (!face) return;
    faceReadingsRef.current = { ...faceReadingsRef.current, [face]: reading };
    stabilityRef.current = createStabilityState();

    if (currentFaceIndex < FACE_ORDER.length - 1) {
      setCurrentFaceIndex((i) => i + 1);
    } else {
      finishScan(faceReadingsRef.current);
    }
  }

  function finishScan(readings: FaceReadings) {
    stopStream();
    const result = assemble(readings);
    if (result.ok) {
      setCubeState(result.cubeState);
      setPhase("done");
    } else {
      setCorrectionColors(result.colorFacelets);
      setCorrectionLowConfidence(computeLowConfidenceIndices(readings));
      setPhase("correction");
    }
  }

  const startStream = useCallback(async () => {
    setPhase("requesting");
    setErrorKind(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPhase("scanning");
      rafRef.current = requestAnimationFrame(processFrame);
    } catch (e) {
      setErrorKind(classifyGetUserMediaError(e));
      setPhase("error");
    }
  }, [processFrame]);

  useEffect(() => {
    if (!mounted || !supported) return;
    void startStream();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once camera support is known; startStream/stopStream are stable.
  }, [mounted, supported]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        stopStream();
      } else if (document.visibilityState === "visible" && (phase === "scanning" || phase === "requesting")) {
        void startStream();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase, startStream, stopStream]);

  function handleRecapture(face: Face) {
    const index = FACE_ORDER.indexOf(face);
    setCurrentFaceIndex(index);
    stabilityRef.current = createStabilityState();
    const next = { ...faceReadingsRef.current };
    delete next[face];
    faceReadingsRef.current = next;
  }

  function handleManualEntry() {
    stopStream();
    setCorrectionColors(new Array(54).fill("unknown"));
    setCorrectionLowConfidence([]);
    setPhase("correction");
  }

  function handleSolve(facelets: FaceletString) {
    setCubeState(createCubeState(facelets, "manual"));
    setPhase("done");
  }

  if (!mounted) return null;

  if (!supported) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-center text-white">
        <p data-testid="unsupported-message" className="max-w-sm text-sm text-neutral-300">
          {ERROR_MESSAGES.unsupported}
        </p>
        <Link href="/connect" className="font-semibold text-indigo-400 underline">
          Connect a smart cube instead
        </Link>
      </main>
    );
  }

  if (phase === "error" && errorKind) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-center text-white">
        <p role="alert" data-testid="scan-error-message" className="max-w-sm text-sm text-red-400">
          {ERROR_MESSAGES[errorKind]}
        </p>
        <div data-testid="scan-error-alternatives" className="flex flex-col gap-2">
          <Link href="/connect" className="font-semibold text-indigo-400 underline">
            Connect a smart cube instead
          </Link>
          <button type="button" onClick={handleManualEntry} className="font-semibold text-indigo-400 underline">
            Enter colours manually
          </button>
          <button
            type="button"
            data-testid="scan-retry-button"
            onClick={() => void startStream()}
            className="mt-2 rounded-md bg-neutral-800 px-4 py-2 text-sm"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (phase === "correction" && correctionColors) {
    return (
      <main className="flex min-h-screen flex-col items-center gap-4 bg-neutral-950 px-4 py-8 text-white">
        <h1 className="text-xl font-semibold">Fix the scan</h1>
        <CorrectionNet
          initialColors={correctionColors}
          lowConfidenceIndices={correctionLowConfidence}
          onSolve={handleSolve}
        />
      </main>
    );
  }

  if (phase === "done" && cubeState) {
    return (
      <main className="flex min-h-screen flex-col items-center gap-4 bg-neutral-950 px-4 py-8 text-white">
        <h1 className="text-xl font-semibold">Scan complete</h1>
        <div data-testid="scan-result" className="w-full max-w-sm">
          <CubeView state={cubeState} />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 bg-neutral-950 px-4 py-8 text-white">
      <h1 className="text-xl font-semibold">Scan your cube</h1>
      <video ref={videoRef} autoPlay muted playsInline data-testid="scan-video" className="w-full max-w-md" />
      <ScanOverlay
        currentFace={FACE_ORDER[currentFaceIndex]!}
        promptText={`Show the ${FACE_ORDER[currentFaceIndex]} face`}
        viewportWidth={videoRef.current?.videoWidth ?? 1280}
        viewportHeight={videoRef.current?.videoHeight ?? 720}
        latestReading={latestReading}
        committedFaces={{}}
        onRecapture={handleRecapture}
      />
    </main>
  );
}
