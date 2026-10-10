import { describe, expect, it, vi } from "vitest";

let algLeafCb: ((e: unknown) => void) | undefined;
let orientationCb: ((e: unknown) => void) | undefined;

const fakePuzzle = {
  name: () => "HEYKUBE",
  disconnect: vi.fn(),
  getPattern: vi.fn(async () => ({ toJSON: () => ({ patternData: {} }) })),
  addAlgLeafListener: vi.fn((cb: (e: unknown) => void) => {
    algLeafCb = cb;
  }),
  addOrientationListener: vi.fn((cb: (e: unknown) => void) => {
    orientationCb = cb;
  }),
};

const connectSmartPuzzle = vi.fn(async () => fakePuzzle);

vi.mock("cubing/bluetooth", () => ({ connectSmartPuzzle }));

describe("CubingBluetoothDriver", () => {
  it("connects and reports the device name", async () => {
    const { CubingBluetoothDriver } = await import("./cubing-bluetooth-driver");
    const driver = new CubingBluetoothDriver();
    await driver.requestDevice();
    expect(driver.deviceName).toBe("HEYKUBE");
    expect(driver.capabilities.facelets).toBe(true);
  });

  it("maps an AlgLeafEvent onto onMove via the leaf's toString()", async () => {
    const { CubingBluetoothDriver } = await import("./cubing-bluetooth-driver");
    const driver = new CubingBluetoothDriver();
    const moves: string[] = [];
    driver.onMove((e) => moves.push(e.move));
    await driver.requestDevice();

    algLeafCb!({ latestAlgLeaf: { toString: () => "R'" }, timeStamp: 42 });

    expect(moves).toEqual(["R'"]);
  });

  it("maps an OrientationEvent onto onOrientation", async () => {
    const { CubingBluetoothDriver } = await import("./cubing-bluetooth-driver");
    const driver = new CubingBluetoothDriver();
    const quats: unknown[] = [];
    driver.onOrientation((q) => quats.push(q));
    await driver.requestDevice();

    orientationCb!({ quaternion: { x: 1, y: 0, z: 0, w: 0 }, timeStamp: 1 });

    expect(quats).toEqual([{ x: 1, y: 0, z: 0, w: 0 }]);
  });

  it("onBattery returns a no-op unsubscribe and never fires (no generic battery API)", async () => {
    const { CubingBluetoothDriver } = await import("./cubing-bluetooth-driver");
    const driver = new CubingBluetoothDriver();
    const cb = vi.fn();
    const unsubscribe = driver.onBattery(cb);
    await driver.requestDevice();
    expect(cb).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it("disconnect() calls the vendor puzzle's disconnect", async () => {
    const { CubingBluetoothDriver } = await import("./cubing-bluetooth-driver");
    const driver = new CubingBluetoothDriver();
    await driver.requestDevice();
    await driver.disconnect();
    expect(fakePuzzle.disconnect).toHaveBeenCalled();
  });
});
