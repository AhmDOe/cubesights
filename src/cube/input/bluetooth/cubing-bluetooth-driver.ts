import { connectSmartPuzzle } from "cubing/bluetooth";
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
 * CubingBluetoothDriver (002-R3): secondary driver over cubing/bluetooth's connectSmartPuzzle(),
 * covering devices the primary driver doesn't (HEYKUBE, some older GiiKER/GAN revisions).
 *
 * Minimal local type for the subset of cubing/bluetooth's surface this file uses.
 */
interface VendorAlgLeaf {
  toString(): string;
}
interface VendorAlgLeafEvent {
  readonly latestAlgLeaf: VendorAlgLeaf;
  readonly timeStamp: number;
}
interface VendorOrientationEvent {
  readonly quaternion: Quaternion;
  readonly timeStamp: number;
}
interface VendorKPattern {
  toJSON(): unknown;
}
interface VendorBluetoothPuzzle {
  name(): string | undefined;
  disconnect(): void;
  getPattern(): Promise<VendorKPattern>;
  addAlgLeafListener(cb: (e: VendorAlgLeafEvent) => void): void;
  addOrientationListener(cb: (e: VendorOrientationEvent) => void): void;
}

export class CubingBluetoothDriver implements CubeDriver {
  readonly id = "cubing-bluetooth" as const;

  // Honest per 002-R3: cubing/bluetooth does not expose a move stream for MoYu devices. We
  // cannot detect that generically without per-device-class inspection (no hardware available to
  // verify in this session — see ticket 002 Open question R7); the capability therefore defaults
  // to true and must be revisited once a MoYu device can be tested against this driver.
  private _capabilities: DriverCapabilities = { facelets: true, moves: true, gyro: true, battery: false };
  private _deviceName = "";
  private puzzle: VendorBluetoothPuzzle | null = null;

  private readonly connectionListeners = new Set<(s: ConnectionState) => void>();
  private readonly moveListeners = new Set<(e: MoveEvent) => void>();
  private readonly orientationListeners = new Set<(q: Quaternion) => void>();

  get deviceName(): string {
    return this._deviceName;
  }
  get capabilities(): DriverCapabilities {
    return this._capabilities;
  }

  async requestDevice(): Promise<void> {
    // Static import at module scope — see the matching comment in
    // smartcube-web-bluetooth-driver.ts for why this must not be a dynamic import here.
    const puzzle = (await connectSmartPuzzle()) as unknown as VendorBluetoothPuzzle;
    this.puzzle = puzzle;
    this._deviceName = puzzle.name() ?? "Unknown cube";

    puzzle.addAlgLeafListener((e) => {
      const move = e.latestAlgLeaf.toString();
      if (!move) return;
      const moveEvent: MoveEvent = { move: move as Move, deviceTimestamp: e.timeStamp, receivedAt: Date.now() };
      for (const cb of this.moveListeners) cb(moveEvent);
    });
    puzzle.addOrientationListener((e) => {
      for (const cb of this.orientationListeners) cb(e.quaternion);
    });

    this.emitConnection("connected");
  }

  async readFacelets(): Promise<FaceletString> {
    if (!this._capabilities.facelets) throw new CapabilityError(this.id, "facelets");
    if (!this.puzzle) throw new Error("CubingBluetoothDriver: not connected");
    const { fromKPattern } = await import("~/cube/core/adapters/kpuzzle");
    const pattern = await this.puzzle.getPattern();
    return fromKPattern(pattern as never);
  }

  onMove(cb: (e: MoveEvent) => void): Unsubscribe {
    this.moveListeners.add(cb);
    return () => this.moveListeners.delete(cb);
  }
  onOrientation(cb: (q: Quaternion) => void): Unsubscribe {
    this.orientationListeners.add(cb);
    return () => this.orientationListeners.delete(cb);
  }
  onBattery(_cb: (pct: number) => void): Unsubscribe {
    // No generic battery API on the base BluetoothPuzzle class.
    return () => undefined;
  }
  onConnectionChange(cb: (s: ConnectionState) => void): Unsubscribe {
    this.connectionListeners.add(cb);
    return () => this.connectionListeners.delete(cb);
  }

  async disconnect(): Promise<void> {
    this.puzzle?.disconnect();
    this.puzzle = null;
  }

  private emitConnection(s: ConnectionState): void {
    for (const cb of this.connectionListeners) cb(s);
  }
}
