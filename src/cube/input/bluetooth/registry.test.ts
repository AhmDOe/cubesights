import { describe, expect, it, vi } from "vitest";
import { connectCube, CubeConnectionError, type DriverFactory } from "./registry";
import type { CubeDriver } from "./driver";

function fakeDriver(id: CubeDriver["id"], overrides: Partial<CubeDriver> = {}): CubeDriver {
  return {
    id,
    deviceName: `fake-${id}`,
    capabilities: { facelets: true, moves: true, gyro: false, battery: true },
    requestDevice: vi.fn(async () => undefined),
    readFacelets: vi.fn(),
    onMove: vi.fn(() => () => undefined),
    onOrientation: vi.fn(() => () => undefined),
    onBattery: vi.fn(() => () => undefined),
    onConnectionChange: vi.fn(() => () => undefined),
    disconnect: vi.fn(async () => undefined),
    ...overrides,
  };
}

function factoryFor(driver: CubeDriver, available = true): DriverFactory {
  return { id: driver.id, isAvailable: () => available, create: () => driver };
}

describe("connectCube", () => {
  it("@002-S10 throws UnsupportedBrowser when Web Bluetooth is absent", async () => {
    await expect(connectCube({ isBrowserSupported: () => false, factories: [] })).rejects.toMatchObject({
      kind: "UnsupportedBrowser",
    });
  });

  it("connects via the primary driver when it succeeds", async () => {
    const primary = fakeDriver("smartcube-web-bluetooth");
    const secondary = fakeDriver("cubing-bluetooth");
    const driver = await connectCube({
      isBrowserSupported: () => true,
      factories: [factoryFor(primary), factoryFor(secondary)],
    });
    expect(driver.id).toBe("smartcube-web-bluetooth");
    expect(secondary.requestDevice).not.toHaveBeenCalled();
  });

  it("falls back to the secondary driver when the primary fails (not a user dismissal)", async () => {
    const primary = fakeDriver("smartcube-web-bluetooth", {
      requestDevice: vi.fn(async () => {
        throw new Error("GATT operation failed");
      }),
    });
    const secondary = fakeDriver("cubing-bluetooth");
    const driver = await connectCube({
      isBrowserSupported: () => true,
      factories: [factoryFor(primary), factoryFor(secondary)],
    });
    expect(driver.id).toBe("cubing-bluetooth");
  });

  it("@002-S12 classifies a dismissed chooser as NoDeviceChosen without trying the fallback", async () => {
    const primary = fakeDriver("smartcube-web-bluetooth", {
      requestDevice: vi.fn(async () => {
        const err = new Error("User cancelled the requestDevice() chooser.");
        err.name = "NotFoundError";
        throw err;
      }),
    });
    const secondary = fakeDriver("cubing-bluetooth");
    await expect(
      connectCube({ isBrowserSupported: () => true, factories: [factoryFor(primary), factoryFor(secondary)] }),
    ).rejects.toMatchObject({ kind: "NoDeviceChosen" });
    expect(secondary.requestDevice).not.toHaveBeenCalled();
  });

  it("throws ConnectionFailed when every available driver fails", async () => {
    const primary = fakeDriver("smartcube-web-bluetooth", {
      requestDevice: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const secondary = fakeDriver("cubing-bluetooth", {
      requestDevice: vi.fn(async () => {
        throw new Error("boom2");
      }),
    });
    await expect(
      connectCube({ isBrowserSupported: () => true, factories: [factoryFor(primary), factoryFor(secondary)] }),
    ).rejects.toMatchObject({ kind: "ConnectionFailed" });
  });

  it("the preferred query-param override tries that driver first", async () => {
    const primary = fakeDriver("smartcube-web-bluetooth");
    const secondary = fakeDriver("cubing-bluetooth");
    const driver = await connectCube({
      isBrowserSupported: () => true,
      preferred: "cubing-bluetooth",
      factories: [factoryFor(primary), factoryFor(secondary)],
    });
    expect(driver.id).toBe("cubing-bluetooth");
    expect(primary.requestDevice).not.toHaveBeenCalled();
  });

  it("skips factories that report themselves unavailable", async () => {
    const primary = fakeDriver("smartcube-web-bluetooth");
    const secondary = fakeDriver("cubing-bluetooth");
    const driver = await connectCube({
      isBrowserSupported: () => true,
      factories: [factoryFor(primary, false), factoryFor(secondary, true)],
    });
    expect(driver.id).toBe("cubing-bluetooth");
  });

  it("CubeConnectionError carries the triggering cause", async () => {
    const cause = new Error("boom");
    const primary = fakeDriver("smartcube-web-bluetooth", {
      requestDevice: vi.fn(async () => {
        throw cause;
      }),
    });
    try {
      await connectCube({ isBrowserSupported: () => true, factories: [factoryFor(primary)] });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CubeConnectionError);
      expect((e as CubeConnectionError).cause).toBe(cause);
    }
  });
});
