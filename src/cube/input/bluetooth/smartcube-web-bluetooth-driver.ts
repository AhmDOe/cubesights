import { connectSmartCube } from "smartcube-web-bluetooth";
import type { Observable, Subscription } from "rxjs";
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
import { mapVendorFaceletsToCanonical } from "./facelet-mapping";

/**
 * SmartCubeWebBluetoothDriver (002-R2): wraps smartcube-web-bluetooth's generic auto-detecting
 * API (GAN Gen1-4, Giiker/Mi, GoCube, MoYu, QiYi). RxJS is confined to this file — the CubeDriver
 * interface is callback-based so it never leaks into the rest of the app.
 *
 * Minimal local type for the subset of the vendor library's surface this file actually uses, so
 * the rest of the codebase never needs to import it (nothing outside this directory may).
 */
interface VendorSmartCubeEvent {
  readonly type: "MOVE" | "FACELETS" | "GYRO" | "BATTERY" | "HARDWARE" | "DISCONNECT";
  readonly move?: string;
  readonly cubeTimestamp?: number | null;
  readonly localTimestamp?: number | null;
  readonly facelets?: string;
  readonly quaternion?: Quaternion;
  readonly batteryLevel?: number;
}
interface VendorSmartCubeConnection {
  readonly deviceName: string;
  readonly capabilities: { gyroscope: boolean; battery: boolean; facelets: boolean };
  readonly events$: Observable<VendorSmartCubeEvent>;
  sendCommand(command: { type: "REQUEST_FACELETS" }): Promise<void>;
  disconnect(): Promise<void>;
}
const FACELET_READ_TIMEOUT_MS = 3000;

export class SmartCubeWebBluetoothDriver implements CubeDriver {
  readonly id = "smartcube-web-bluetooth" as const;

  private connection: VendorSmartCubeConnection | null = null;
  private eventSubscription: Subscription | null = null;
  private _deviceName = "";
  private _capabilities: DriverCapabilities = { facelets: false, moves: true, gyro: false, battery: false };

  private readonly moveListeners = new Set<(e: MoveEvent) => void>();
  private readonly orientationListeners = new Set<(q: Quaternion) => void>();
  private readonly batteryListeners = new Set<(pct: number) => void>();
  private readonly connectionListeners = new Set<(s: ConnectionState) => void>();

  get deviceName(): string {
    return this._deviceName;
  }
  get capabilities(): DriverCapabilities {
    return this._capabilities;
  }

  async requestDevice(): Promise<void> {
    // Must be reachable from a user gesture with no awaited call before it (@002-S11).
    // connectSmartCube is a *static* top-level import specifically so there is no dynamic
    // import() microtask between the click and the call that actually triggers
    // navigator.bluetooth.requestDevice() inside it — an earlier version of this file imported
    // it dynamically here, which would have inserted exactly such a gap. Code-splitting this
    // vendor library out of the main bundle is instead achieved at the route level: nothing
    // outside /connect's module graph imports this file (enforced by the eslint import-boundary
    // rule), so Next's per-route chunking keeps it out of the initial bundle without needing a
    // manual dynamic import here.
    const connection = await connectSmartCube();
    this.connection = connection;
    this._deviceName = connection.deviceName;
    this._capabilities = {
      facelets: connection.capabilities.facelets,
      moves: true,
      gyro: connection.capabilities.gyroscope,
      battery: connection.capabilities.battery,
    };
    this.eventSubscription = connection.events$.subscribe((e) => this.handleVendorEvent(e));
    this.emitConnection("connected");
  }

  private handleVendorEvent(e: VendorSmartCubeEvent): void {
    switch (e.type) {
      case "MOVE": {
        if (!e.move) return;
        const moveEvent: MoveEvent = {
          move: e.move as Move,
          deviceTimestamp: e.cubeTimestamp ?? e.localTimestamp ?? Date.now(),
          receivedAt: Date.now(),
        };
        for (const cb of this.moveListeners) cb(moveEvent);
        return;
      }
      case "GYRO": {
        if (!e.quaternion) return;
        for (const cb of this.orientationListeners) cb(e.quaternion);
        return;
      }
      case "BATTERY": {
        if (e.batteryLevel === undefined) return;
        for (const cb of this.batteryListeners) cb(e.batteryLevel);
        return;
      }
      case "DISCONNECT": {
        this.emitConnection("disconnected");
        return;
      }
      case "FACELETS":
      case "HARDWARE":
        return; // FACELETS is consumed by readFacelets()'s own one-shot subscription below.
    }
  }

  async readFacelets(): Promise<FaceletString> {
    if (!this._capabilities.facelets) throw new CapabilityError(this.id, "facelets");
    const connection = this.connection;
    if (!connection) throw new Error("SmartCubeWebBluetoothDriver: not connected");

    const nextFacelets = new Promise<FaceletString>((resolve, reject) => {
      const timeout = setTimeout(() => {
        sub.unsubscribe();
        reject(new Error("readFacelets timed out waiting for a FACELETS event"));
      }, FACELET_READ_TIMEOUT_MS);
      const sub = connection.events$.subscribe((e) => {
        if (e.type === "FACELETS" && e.facelets) {
          clearTimeout(timeout);
          sub.unsubscribe();
          resolve(mapVendorFaceletsToCanonical(e.facelets));
        }
      });
    });

    await connection.sendCommand({ type: "REQUEST_FACELETS" });
    return nextFacelets;
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
    this.eventSubscription?.unsubscribe();
    this.eventSubscription = null;
    await this.connection?.disconnect();
    this.connection = null;
  }

  private emitConnection(s: ConnectionState): void {
    for (const cb of this.connectionListeners) cb(s);
  }
}
