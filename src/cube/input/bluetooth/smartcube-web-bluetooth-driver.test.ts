import { Subject } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { SOLVED_FACELETS } from "~/cube/core/facelets";
import { CapabilityError } from "./driver";

const events$ = new Subject<Record<string, unknown>>();
const sendCommand = vi.fn(async () => undefined);
const disconnect = vi.fn(async () => undefined);

const fakeConnection = {
  deviceName: "GAN12 ui FreePlay",
  capabilities: { gyroscope: true, battery: true, facelets: true },
  events$,
  sendCommand,
  disconnect,
};

const connectSmartCube = vi.fn(async () => fakeConnection);

vi.mock("smartcube-web-bluetooth", () => ({ connectSmartCube }));

describe("SmartCubeWebBluetoothDriver", () => {
  it("connects and reports device name and mapped capabilities", async () => {
    const { SmartCubeWebBluetoothDriver } = await import("./smartcube-web-bluetooth-driver");
    const driver = new SmartCubeWebBluetoothDriver();
    await driver.requestDevice();
    expect(driver.deviceName).toBe("GAN12 ui FreePlay");
    expect(driver.capabilities).toEqual({ facelets: true, moves: true, gyro: true, battery: true });
  });

  it("maps a vendor MOVE event onto onMove", async () => {
    const { SmartCubeWebBluetoothDriver } = await import("./smartcube-web-bluetooth-driver");
    const driver = new SmartCubeWebBluetoothDriver();
    await driver.requestDevice();
    const moves: string[] = [];
    driver.onMove((e) => moves.push(e.move));

    events$.next({ type: "MOVE", move: "R", cubeTimestamp: 123, localTimestamp: 123 });

    expect(moves).toEqual(["R"]);
  });

  it("maps GYRO and BATTERY events onto their respective callbacks", async () => {
    const { SmartCubeWebBluetoothDriver } = await import("./smartcube-web-bluetooth-driver");
    const driver = new SmartCubeWebBluetoothDriver();
    await driver.requestDevice();
    const quaternions: unknown[] = [];
    const batteries: number[] = [];
    driver.onOrientation((q) => quaternions.push(q));
    driver.onBattery((pct) => batteries.push(pct));

    events$.next({ type: "GYRO", quaternion: { x: 0, y: 0, z: 0, w: 1 } });
    events$.next({ type: "BATTERY", batteryLevel: 91 });

    expect(quaternions).toEqual([{ x: 0, y: 0, z: 0, w: 1 }]);
    expect(batteries).toEqual([91]);
  });

  it("maps a vendor DISCONNECT event onto onConnectionChange", async () => {
    const { SmartCubeWebBluetoothDriver } = await import("./smartcube-web-bluetooth-driver");
    const driver = new SmartCubeWebBluetoothDriver();
    const states: string[] = [];
    driver.onConnectionChange((s) => states.push(s));
    await driver.requestDevice();

    events$.next({ type: "DISCONNECT" });

    expect(states).toEqual(["connected", "disconnected"]);
  });

  it("readFacelets sends REQUEST_FACELETS and resolves from the next FACELETS event", async () => {
    const { SmartCubeWebBluetoothDriver } = await import("./smartcube-web-bluetooth-driver");
    const driver = new SmartCubeWebBluetoothDriver();
    await driver.requestDevice();

    const promise = driver.readFacelets();
    expect(sendCommand).toHaveBeenCalledWith({ type: "REQUEST_FACELETS" });
    events$.next({ type: "FACELETS", facelets: SOLVED_FACELETS });

    await expect(promise).resolves.toBe(SOLVED_FACELETS);
  });

  it("readFacelets throws CapabilityError when the device doesn't report facelets", async () => {
    const { SmartCubeWebBluetoothDriver } = await import("./smartcube-web-bluetooth-driver");
    connectSmartCube.mockResolvedValueOnce({ ...fakeConnection, capabilities: { ...fakeConnection.capabilities, facelets: false } });
    const driver = new SmartCubeWebBluetoothDriver();
    await driver.requestDevice();
    await expect(driver.readFacelets()).rejects.toBeInstanceOf(CapabilityError);
  });

  it("disconnect() unsubscribes and calls the vendor connection's disconnect", async () => {
    const { SmartCubeWebBluetoothDriver } = await import("./smartcube-web-bluetooth-driver");
    const driver = new SmartCubeWebBluetoothDriver();
    await driver.requestDevice();
    await driver.disconnect();
    expect(disconnect).toHaveBeenCalled();
  });
});
