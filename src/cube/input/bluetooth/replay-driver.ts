import { applyMoves } from "~/cube/core/apply";
import { createCubeState } from "~/cube/core/cube-state";
import type { FaceletString } from "~/cube/core/facelets";
import type { Move } from "~/cube/core/notation";
import {
  CapabilityError,
  type ConnectionState,
  type CubeDriver,
  type DriverCapabilities,
  type MoveEvent,
  type Quaternion,
  type Unsubscribe,
} from "./driver";

/**
 * ReplayDriver (002-R11): plays a recorded JSON trace deterministically. The backbone of the test
 * suite and of local development without hardware — every automated test for this ticket drives
 * real driver/registry/tracker code through this, never a live BLE connection.
 */

export type BleTraceEventKind = "move" | "gyro" | "battery" | "disconnect" | "reconnect" | "facelets";

export interface BleTraceEvent {
  /** Milliseconds since trace start. */
  readonly t: number;
  readonly kind: BleTraceEventKind;
  readonly payload: unknown;
}

export interface BleTrace {
  readonly device: string;
  readonly capabilities: DriverCapabilities;
  readonly initialFacelets: FaceletString;
  readonly events: readonly BleTraceEvent[];
}

export interface ReplayDriverOptions {
  /** Playback speed multiplier; 1 = real recorded timing, Infinity = instant (default for tests). */
  readonly speed?: number;
}

export class ReplayDriver implements CubeDriver {
  readonly id = "replay" as const;
  readonly deviceName: string;
  readonly capabilities: DriverCapabilities;

  private readonly trace: BleTrace;
  private readonly speed: number;
  private trueFacelets: FaceletString;
  private connected = false;
  private timers: ReturnType<typeof setTimeout>[] = [];

  private readonly moveListeners = new Set<(e: MoveEvent) => void>();
  private readonly orientationListeners = new Set<(q: Quaternion) => void>();
  private readonly batteryListeners = new Set<(pct: number) => void>();
  private readonly connectionListeners = new Set<(s: ConnectionState) => void>();

  constructor(trace: BleTrace, options: ReplayDriverOptions = {}) {
    this.trace = trace;
    this.deviceName = trace.device;
    this.capabilities = trace.capabilities;
    this.trueFacelets = trace.initialFacelets;
    this.speed = options.speed ?? Number.POSITIVE_INFINITY;
  }

  async requestDevice(): Promise<void> {
    this.connected = true;
    this.emitConnection("connected");
    this.scheduleEvents();
  }

  async readFacelets(): Promise<FaceletString> {
    if (!this.capabilities.facelets) throw new CapabilityError(this.id, "facelets");
    return this.trueFacelets;
  }

  onMove(cb: (e: MoveEvent) => void): Unsubscribe {
    this.moveListeners.add(cb);
    return () => this.moveListeners.delete(cb);
  }

  onOrientation(cb: (q: Quaternion) => void): Unsubscribe {
    this.orientationListeners.add(cb);
    return () => this.orientationListeners.delete(cb);
  }

  onBattery(cb: (pct: number) => void): Unsubscribe {
    this.batteryListeners.add(cb);
    return () => this.batteryListeners.delete(cb);
  }

  onConnectionChange(cb: (s: ConnectionState) => void): Unsubscribe {
    this.connectionListeners.add(cb);
    return () => this.connectionListeners.delete(cb);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.clearTimers();
    this.emitConnection("disconnected");
  }

  private scheduleEvents(): void {
    const delayFor = (t: number) => (this.speed === Number.POSITIVE_INFINITY ? 0 : t / this.speed);
    for (const event of this.trace.events) {
      const timer = setTimeout(() => {
        void this.applyTraceEvent(event);
      }, delayFor(event.t));
      this.timers.push(timer);
    }
  }

  private async applyTraceEvent(event: BleTraceEvent): Promise<void> {
    // "reconnect" must run even while disconnected (that's the point of it); every other kind is
    // a data event that only makes sense while connected.
    if (!this.connected && event.kind !== "reconnect") return;
    switch (event.kind) {
      case "move": {
        const payload = event.payload as { move: string; serial?: number };
        await this.applyMoveToTrueState(payload.move as Move);
        const moveEvent: MoveEvent = {
          move: payload.move as Move,
          deviceTimestamp: event.t,
          receivedAt: event.t,
          serial: payload.serial,
        };
        for (const cb of this.moveListeners) cb(moveEvent);
        return;
      }
      case "gyro": {
        for (const cb of this.orientationListeners) cb(event.payload as Quaternion);
        return;
      }
      case "battery": {
        for (const cb of this.batteryListeners) cb(event.payload as number);
        return;
      }
      case "facelets": {
        // Explicit override — the mechanism fixture traces use to simulate drift (the device
        // reports a state that disagrees with what the replayed moves alone would produce).
        this.trueFacelets = event.payload as FaceletString;
        return;
      }
      case "disconnect": {
        this.connected = false;
        this.emitConnection("disconnected");
        return;
      }
      case "reconnect": {
        this.connected = true;
        this.emitConnection("connected");
        return;
      }
    }
  }

  private async applyMoveToTrueState(move: Move): Promise<void> {
    const state = createCubeState(this.trueFacelets, "smart-cube");
    const next = await applyMoves(state, [move]);
    this.trueFacelets = next.facelets;
  }

  private emitConnection(state: ConnectionState): void {
    for (const cb of this.connectionListeners) cb(state);
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
}
