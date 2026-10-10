import type { DriverFactory } from "./registry";
import { SmartCubeWebBluetoothDriver } from "./smartcube-web-bluetooth-driver";
import { CubingBluetoothDriver } from "./cubing-bluetooth-driver";

/** The real primary -> secondary factory list connectCube() uses in production (002-R4). */
export const DEFAULT_DRIVER_FACTORIES: readonly DriverFactory[] = [
  {
    id: "smartcube-web-bluetooth",
    isAvailable: () => typeof navigator !== "undefined" && "bluetooth" in navigator,
    create: () => new SmartCubeWebBluetoothDriver(),
  },
  {
    id: "cubing-bluetooth",
    isAvailable: () => typeof navigator !== "undefined" && "bluetooth" in navigator,
    create: () => new CubingBluetoothDriver(),
  },
];
