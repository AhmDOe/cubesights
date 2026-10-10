import { describe, expect, it, vi } from "vitest";
import { ReplayDriver } from "./replay-driver";
import { CapabilityError } from "./driver";
import {
  DROPPED_MOVE_GAP,
  DUPLICATE_EVENT_BURST,
  GAN_GEN3_SCRAMBLE_AND_SOLVE,
  MID_SOLVE_DISCONNECT_RECONNECT,
  QIYI_SOLVE,
} from "../../../../tests/fixtures/ble/traces";

describe("ReplayDriver", () => {
  it("reports device name and capabilities from the trace", () => {
    const driver = new ReplayDriver(GAN_GEN3_SCRAMBLE_AND_SOLVE);
    expect(driver.deviceName).toBe("GAN12 ui FreePlay");
    expect(driver.capabilities).toEqual(GAN_GEN3_SCRAMBLE_AND_SOLVE.capabilities);
  });

  it("emits a connected event on requestDevice and plays move events in order", async () => {
    const driver = new ReplayDriver(QIYI_SOLVE, { speed: Number.POSITIVE_INFINITY });
    const connectionStates: string[] = [];
    driver.onConnectionChange((s) => connectionStates.push(s));
    const moves: string[] = [];
    driver.onMove((e) => moves.push(e.move));

    await driver.requestDevice();
    await vi.waitFor(() => expect(moves.length).toBe(8));

    expect(connectionStates).toEqual(["connected"]);
    expect(moves).toEqual(["R", "U", "R'", "U'", "U'", "R", "U", "R'"]);
  });

  it("readFacelets throws CapabilityError when the trace reports no facelet support", async () => {
    const trace = { ...QIYI_SOLVE, capabilities: { ...QIYI_SOLVE.capabilities, facelets: false } };
    const driver = new ReplayDriver(trace);
    await driver.requestDevice();
    await expect(driver.readFacelets()).rejects.toBeInstanceOf(CapabilityError);
  });

  it("readFacelets reflects moves applied so far, independent of the tracker's serial bookkeeping", async () => {
    // DROPPED_MOVE_GAP plays "R" (serial 0) then "R'" (serial 2); the driver applies both
    // regardless of the serial gap (reorder/gap handling is the tracker's job, not the driver's)
    // — net effect is the identity, so this also proves the driver doesn't skip serial 2.
    const driver = new ReplayDriver(DROPPED_MOVE_GAP, { speed: Number.POSITIVE_INFINITY });
    const moves: string[] = [];
    driver.onMove((e) => moves.push(e.move));
    await driver.requestDevice();
    await vi.waitFor(() => expect(moves).toEqual(["R", "R'"]));
    expect(await driver.readFacelets()).toBe(DROPPED_MOVE_GAP.initialFacelets);
  });

  it("emits disconnect/reconnect connection states from trace events", async () => {
    const driver = new ReplayDriver(MID_SOLVE_DISCONNECT_RECONNECT, { speed: Number.POSITIVE_INFINITY });
    const states: string[] = [];
    driver.onConnectionChange((s) => states.push(s));
    await driver.requestDevice();
    await vi.waitFor(() => expect(states).toEqual(["connected", "disconnected", "connected"]));
  });

  it("delivers duplicate-serial move events as two separate onMove calls (dedup is the tracker's job, not the driver's)", async () => {
    const driver = new ReplayDriver(DUPLICATE_EVENT_BURST, { speed: Number.POSITIVE_INFINITY });
    const serials: (number | undefined)[] = [];
    driver.onMove((e) => serials.push(e.serial));
    await driver.requestDevice();
    await vi.waitFor(() => expect(serials.length).toBe(3));
    expect(serials).toEqual([0, 0, 1]);
  });

  it("stops emitting events after disconnect() is called", async () => {
    const driver = new ReplayDriver(GAN_GEN3_SCRAMBLE_AND_SOLVE, { speed: Number.POSITIVE_INFINITY });
    const moves: string[] = [];
    driver.onMove((e) => moves.push(e.move));
    await driver.requestDevice();
    await driver.disconnect();
    const countAfterDisconnect = moves.length;
    await new Promise((r) => setTimeout(r, 20));
    expect(moves.length).toBe(countAfterDisconnect);
  });
});
