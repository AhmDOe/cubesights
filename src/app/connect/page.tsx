"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "~/components/ConnectButton";
import { CubeStateTracker } from "~/cube/input/bluetooth/tracker";
import { connectCube, CubeConnectionError, type ConnectErrorKind } from "~/cube/input/bluetooth/registry";
import { DEFAULT_DRIVER_FACTORIES } from "~/cube/input/bluetooth/factories";
import type { CubeDriver } from "~/cube/input/bluetooth/driver";
import { createCubeState, type CubeState } from "~/cube/core/cube-state";
import { SOLVED_FACELETS } from "~/cube/core/facelets";

const CubeView = dynamic(() => import("~/components/CubeView").then((m) => m.CubeView), { ssr: false });

const ERROR_MESSAGES: Record<ConnectErrorKind, string> = {
  UnsupportedBrowser: "Your browser doesn't support Web Bluetooth. Safari and Firefox don't implement it.",
  PermissionDenied: "Bluetooth permission was denied.",
  NoDeviceChosen: "No device was chosen.",
  ConnectionFailed: "Could not connect to the cube. Check it's powered on and in range.",
  UnsupportedDevice: "This device isn't supported by either Bluetooth driver.",
};

const RECONNECT_BACKOFF_MS = [250, 1000, 3000];

export default function ConnectPage() {
  const [mounted, setMounted] = useState(false);
  const [webBluetoothSupported, setWebBluetoothSupported] = useState(false);
  const [phase, setPhase] = useState<"idle" | "connecting" | "connected" | "reconnecting" | "stale" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string>("");
  const [battery, setBattery] = useState<number | null>(null);
  const [needsCalibration, setNeedsCalibration] = useState(false);
  const [state, setState] = useState<CubeState | null>(null);
  const [lastMoveAt, setLastMoveAt] = useState<number | null>(null);

  const driverRef = useRef<CubeDriver | null>(null);
  const trackerRef = useRef<CubeStateTracker | null>(null);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    setWebBluetoothSupported(typeof navigator !== "undefined" && "bluetooth" in navigator);
  }, []);

  function attachDriver(driver: CubeDriver) {
    driverRef.current = driver;
    setDeviceName(driver.deviceName);

    const tracker = new CubeStateTracker({ requestFaceletRead: () => driver.readFacelets() });
    trackerRef.current = tracker;
    tracker.onStateChange((s) => setState(s));

    driver.onMove((e) => {
      setLastMoveAt(Date.now());
      void tracker.handleMove(e);
    });
    driver.onBattery((pct) => setBattery(pct));
    driver.onConnectionChange((s) => {
      if (s === "disconnected") {
        tracker.handleDisconnected();
        void attemptReconnect(driver);
      } else if (s === "connected" && phase !== "connecting") {
        void tracker.handleReconnected().then(() => setPhase("connected"));
      }
    });

    if (driver.capabilities.facelets) {
      void driver.readFacelets().then((f) => tracker.seed(f, "smart-cube"));
      setNeedsCalibration(false);
    } else {
      setNeedsCalibration(true);
    }

    setPhase("connected");
    reconnectAttemptRef.current = 0;
  }

  async function attemptReconnect(driver: CubeDriver) {
    setPhase("reconnecting");
    for (const delay of RECONNECT_BACKOFF_MS) {
      reconnectAttemptRef.current += 1;
      await new Promise((r) => setTimeout(r, delay));
      try {
        await driver.requestDevice();
        return; // onConnectionChange("connected") handler finishes the reconciliation.
      } catch {
        // try the next backoff step.
      }
    }
    setPhase("stale");
  }

  function handleConnect() {
    // Synchronous up to here — connectCube's own requestDevice() call is the first await inside it.
    setPhase("connecting");
    setErrorMessage(null);
    connectCube({ factories: DEFAULT_DRIVER_FACTORIES })
      .then(attachDriver)
      .catch((err: unknown) => {
        const kind = err instanceof CubeConnectionError ? err.kind : "ConnectionFailed";
        setErrorMessage(ERROR_MESSAGES[kind]);
        setPhase("idle");
      });
  }

  function handleManualReconnect() {
    const driver = driverRef.current;
    if (driver) void attemptReconnect(driver);
  }

  function handleMarkSolved() {
    trackerRef.current?.seed(SOLVED_FACELETS, "smart-cube");
    setNeedsCalibration(false);
  }

  if (!mounted) return null;

  if (!webBluetoothSupported) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-center text-white">
        <p data-testid="no-bluetooth-message" className="max-w-sm text-sm text-neutral-300">
          {ERROR_MESSAGES.UnsupportedBrowser}
        </p>
        <Link href="/scan" className="font-semibold text-indigo-400 underline">
          Use the camera scanner instead
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-neutral-950 px-4 py-8 text-white">
      <h1 className="text-2xl font-semibold">Connect a smart cube</h1>

      {phase === "idle" || phase === "connecting" ? (
        <ConnectButton onConnect={handleConnect} disabled={phase === "connecting"} />
      ) : null}

      {errorMessage && (
        <p role="alert" data-testid="connect-error" className="text-sm text-red-400">
          {errorMessage}
        </p>
      )}

      {phase === "connected" || phase === "reconnecting" || phase === "stale" ? (
        <div className="flex w-full max-w-sm flex-col items-center gap-3">
          <p data-testid="device-name" className="font-medium">
            {deviceName}
          </p>
          {battery !== null && <p data-testid="battery-level">{battery}% battery</p>}
          {lastMoveAt !== null && <p data-testid="live-move-indicator">●</p>}
          {phase === "reconnecting" && <p data-testid="reconnecting-indicator">Reconnecting…</p>}
          {phase === "stale" && (
            <>
              <p data-testid="stale-indicator">Connection lost — state may be out of date.</p>
              <ConnectButton onConnect={handleManualReconnect} label="Reconnect" />
            </>
          )}

          {needsCalibration && (
            <div className="flex flex-col items-center gap-2 rounded-md bg-neutral-900 p-4">
              <p className="text-sm text-neutral-300">
                This device can&apos;t report its state directly. Solve the cube, then confirm:
              </p>
              <ConnectButton onConnect={handleMarkSolved} label="My cube is solved" />
            </div>
          )}

          <div className="w-full">
            <CubeView state={state ?? createCubeState(SOLVED_FACELETS, "manual")} />
          </div>
        </div>
      ) : null}

      <Link href="/scan" className="text-sm text-neutral-400 underline">
        Use camera instead
      </Link>
    </main>
  );
}
