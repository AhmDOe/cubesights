import { applyMoves } from "~/cube/core/apply";
import { createCubeState, type CubeState, type CubeStateSource } from "~/cube/core/cube-state";
import type { FaceletString } from "~/cube/core/facelets";
import type { Move } from "~/cube/core/notation";
import type { MoveEvent } from "./driver";

/**
 * CubeStateTracker (002-R5/R6/R7): holds the authoritative CubeState and reconstructs it from a
 * driver's move stream, with no knowledge of BLE. Deterministic given the same sequence of
 * inputs — the only non-determinism is the injected `requestFaceletRead` dependency, which exists
 * precisely because the device's own report is the ground truth whenever it disagrees with the
 * replayed move stream (002-R6: "device wins").
 *
 * Simplification over the PRD's literal "100 ms window" framing for duplicate/reorder handling
 * (002-R7): ordering here is purely serial-number-based, not wall-clock-based. A future serial is
 * buffered until either its predecessor arrives (reorder resolved) or the idle re-read (below)
 * resyncs from the device (gap resolved) — this is simpler and never drops a legitimately
 * out-of-order move just because it arrived a few ms outside an arbitrary window. The scenarios'
 * "100 ms" / "30 ms" figures describe the *test's* simulated spacing, not a tracker parameter.
 */

export interface DriftCorrectedEvent {
  readonly differingFaceletCount: number;
  readonly facelets: FaceletString;
}

export interface CubeStateTrackerDeps {
  /** Re-reads facelets from the device. Called on idle quiet, on reconnect, and on demand. */
  requestFaceletRead: () => Promise<FaceletString>;
  /** Milliseconds of move-stream quiet before a drift-correcting re-read fires. Default 400. */
  idleReReadMs?: number;
}

function countDiff(a: string, b: string): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

export class CubeStateTracker {
  private readonly requestFaceletRead: () => Promise<FaceletString>;
  private readonly idleReReadMs: number;

  private state: CubeState | null = null;
  private lastAppliedSerial: number | undefined;
  private readonly buffer = new Map<number, MoveEvent>();
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private stale = false;

  private readonly stateListeners = new Set<(s: CubeState) => void>();
  private readonly driftListeners = new Set<(e: DriftCorrectedEvent) => void>();

  constructor(deps: CubeStateTrackerDeps) {
    this.requestFaceletRead = deps.requestFaceletRead;
    this.idleReReadMs = deps.idleReReadMs ?? 400;
  }

  getState(): CubeState | null {
    return this.state;
  }

  isStale(): boolean {
    return this.stale;
  }

  onStateChange(cb: (s: CubeState) => void): () => void {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  onDrift(cb: (e: DriftCorrectedEvent) => void): () => void {
    this.driftListeners.add(cb);
    return () => this.driftListeners.delete(cb);
  }

  /** Seeds the tracked state directly (from readFacelets() or a "my cube is solved" action). */
  seed(facelets: FaceletString, source: CubeStateSource = "smart-cube"): void {
    this.state = createCubeState(facelets, source);
    this.lastAppliedSerial = undefined;
    this.buffer.clear();
    this.stale = false;
    this.emitState();
  }

  async handleMove(e: MoveEvent): Promise<void> {
    this.resetIdleTimer();

    if (e.serial === undefined) {
      await this.applyOne(e.move);
      return;
    }

    if (this.lastAppliedSerial === undefined) {
      // First serialed move seen: establish the baseline and apply it.
      await this.applyOne(e.move);
      this.lastAppliedSerial = e.serial;
      await this.drainBuffer();
      return;
    }

    if (e.serial <= this.lastAppliedSerial) {
      return; // duplicate or stale — already applied (@002-S5).
    }

    if (e.serial === this.lastAppliedSerial + 1) {
      await this.applyOne(e.move);
      this.lastAppliedSerial = e.serial;
      await this.drainBuffer();
      return;
    }

    // Future serial: buffer it rather than guess (@002-S6 reorder; @002-S4 gap).
    this.buffer.set(e.serial, e);
  }

  /** Call when the driver reports an unexpected disconnect. State is retained, marked stale. */
  handleDisconnected(): void {
    this.stale = true;
    this.clearIdleTimer();
  }

  /** Call once reconnected: re-reads and reconciles against the device. */
  async handleReconnected(): Promise<void> {
    await this.reReadAndReconcile();
    this.stale = false;
  }

  /** Forces an immediate re-read/reconcile ("on demand" per 002-R6c). */
  async requestReconcile(): Promise<void> {
    await this.reReadAndReconcile();
  }

  private async drainBuffer(): Promise<void> {
    while (this.lastAppliedSerial !== undefined && this.buffer.has(this.lastAppliedSerial + 1)) {
      const next = this.buffer.get(this.lastAppliedSerial + 1)!;
      this.buffer.delete(this.lastAppliedSerial + 1);
      await this.applyOne(next.move);
      this.lastAppliedSerial += 1;
    }
  }

  private async applyOne(move: Move): Promise<void> {
    if (!this.state) {
      throw new Error("CubeStateTracker: cannot apply a move before seed() is called");
    }
    this.state = await applyMoves(this.state, [move]);
    this.emitState();
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      void this.reReadAndReconcile();
    }, this.idleReReadMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
  }

  private async reReadAndReconcile(): Promise<void> {
    const deviceFacelets = await this.requestFaceletRead();
    if (!this.state) {
      this.seed(deviceFacelets);
      return;
    }
    if (deviceFacelets !== this.state.facelets) {
      const differingFaceletCount = countDiff(this.state.facelets, deviceFacelets);
      this.state = createCubeState(deviceFacelets, this.state.source);
      this.lastAppliedSerial = undefined;
      this.buffer.clear();
      this.emitState();
      for (const cb of this.driftListeners) cb({ differingFaceletCount, facelets: deviceFacelets });
    }
  }

  private emitState(): void {
    if (!this.state) return;
    for (const cb of this.stateListeners) cb(this.state);
  }
}
