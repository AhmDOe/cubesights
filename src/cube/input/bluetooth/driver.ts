import type { FaceletString } from "~/cube/core/facelets";
import type { Move } from "~/cube/core/notation";

/**
 * CubeDriver (002-R1): the one interface every smart-cube input path implements. Nothing outside
 * src/cube/input/bluetooth/ may import a vendor library — callers only ever see this shape,
 * whether the concrete driver is a real BLE connection or a deterministic ReplayDriver.
 */

export interface DriverCapabilities {
  readonly facelets: boolean;
  readonly moves: boolean;
  readonly gyro: boolean;
  readonly battery: boolean;
}

export interface MoveEvent {
  readonly move: Move;
  readonly deviceTimestamp: number;
  readonly receivedAt: number;
  readonly serial?: number;
}

export interface Quaternion {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";

export type Unsubscribe = () => void;

export type DriverId = "smartcube-web-bluetooth" | "cubing-bluetooth" | "replay";

export class CapabilityError extends Error {
  constructor(
    readonly driverId: string,
    readonly capability: keyof DriverCapabilities,
  ) {
    super(`Driver "${driverId}" does not support capability "${capability}"`);
    this.name = "CapabilityError";
  }
}

export interface CubeDriver {
  readonly id: DriverId;
  readonly deviceName: string;
  readonly capabilities: DriverCapabilities;

  /**
   * Must be invoked synchronously within a user-gesture handler (002-R9, @002-S11). Declared as
   * a property-typed function (not TS method shorthand) throughout this interface deliberately:
   * method shorthand has no implicit `this: void`, which makes every bare reference to it (e.g.
   * `expect(driver.requestDevice).toHaveBeenCalled()` in tests) trip
   * @typescript-eslint/unbound-method. None of these ever use `this`, so there is no real risk —
   * the property-function form just says so in a way the linter can see.
   */
  readonly requestDevice: () => Promise<void>;

  /** Throws CapabilityError if capabilities.facelets is false. */
  readonly readFacelets: () => Promise<FaceletString>;

  readonly onMove: (cb: (e: MoveEvent) => void) => Unsubscribe;
  readonly onOrientation: (cb: (q: Quaternion) => void) => Unsubscribe;
  readonly onBattery: (cb: (pct: number) => void) => Unsubscribe;
  readonly onConnectionChange: (cb: (s: ConnectionState) => void) => Unsubscribe;

  readonly disconnect: () => Promise<void>;
}
