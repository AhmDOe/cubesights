import type { CubeDriver, DriverId } from "./driver";

/**
 * Driver registry (002-R4): tries the primary driver, then the secondary, surfacing one typed
 * error union. `factories` is injectable so this is fully unit-testable without a real browser —
 * production code (the /connect page) calls connectCube() with no options and gets the real
 * smartcube-web-bluetooth / cubing-bluetooth factories registered in ./factories.ts.
 */

export type ConnectErrorKind =
  | "UnsupportedBrowser"
  | "PermissionDenied"
  | "NoDeviceChosen"
  | "ConnectionFailed"
  | "UnsupportedDevice";

export class CubeConnectionError extends Error {
  constructor(
    readonly kind: ConnectErrorKind,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CubeConnectionError";
  }
}

export interface DriverFactory {
  readonly id: DriverId;
  /** Cheap, synchronous capability check (e.g. `"bluetooth" in navigator`). */
  isAvailable(): boolean;
  /** Constructs a not-yet-connected driver instance. */
  create(): CubeDriver;
}

export interface ConnectCubeOptions {
  readonly preferred?: DriverId;
  readonly factories?: readonly DriverFactory[];
  readonly isBrowserSupported?: () => boolean;
}

function isUserDismissal(err: unknown): boolean {
  if (err instanceof CubeConnectionError) return err.kind === "NoDeviceChosen";
  if (err instanceof Error) {
    return (
      err.name === "NotFoundError" ||
      /no device(s)? (found|selected)|cancell?ed/i.test(err.message)
    );
  }
  return false;
}

export async function connectCube(options: ConnectCubeOptions = {}): Promise<CubeDriver> {
  const isBrowserSupported = options.isBrowserSupported ?? (() => typeof navigator !== "undefined" && "bluetooth" in navigator);

  if (!isBrowserSupported()) {
    throw new CubeConnectionError("UnsupportedBrowser", "This browser does not support Web Bluetooth.");
  }

  const factories = options.factories ?? [];
  const ordered = options.preferred
    ? [...factories.filter((f) => f.id === options.preferred), ...factories.filter((f) => f.id !== options.preferred)]
    : factories;

  const available = ordered.filter((f) => f.isAvailable());
  if (available.length === 0) {
    throw new CubeConnectionError("UnsupportedBrowser", "No smart-cube driver is available in this environment.");
  }

  let lastError: unknown;
  for (const factory of available) {
    const driver = factory.create();
    try {
      await driver.requestDevice();
      return driver;
    } catch (err) {
      if (isUserDismissal(err)) {
        throw new CubeConnectionError("NoDeviceChosen", "The device chooser was dismissed.", err);
      }
      lastError = err;
    }
  }

  throw new CubeConnectionError(
    "ConnectionFailed",
    "Could not connect to a smart cube with any available driver.",
    lastError,
  );
}
