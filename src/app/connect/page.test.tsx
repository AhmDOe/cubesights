import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SOLVED_FACELETS } from "~/cube/core/facelets";
import type { ConnectionState, CubeDriver, MoveEvent } from "~/cube/input/bluetooth/driver";
import type * as RegistryModule from "~/cube/input/bluetooth/registry";

vi.mock("~/components/CubeView", () => ({
  CubeView: () => <div data-testid="cube-view" />,
}));

interface FakeDriverListeners {
  move: ((e: MoveEvent) => void)[];
  battery: ((pct: number) => void)[];
  connection: ((s: ConnectionState) => void)[];
}

function fakeDriver(overrides: Partial<CubeDriver> = {}): CubeDriver & { _listeners: FakeDriverListeners } {
  const listeners: FakeDriverListeners = { move: [], battery: [], connection: [] };
  return {
    id: "replay",
    deviceName: "Test Cube",
    capabilities: { facelets: true, moves: true, gyro: false, battery: true },
    requestDevice: vi.fn(async () => undefined),
    readFacelets: vi.fn(async () => SOLVED_FACELETS),
    onMove: vi.fn((cb: (e: MoveEvent) => void) => {
      listeners.move.push(cb);
      return () => undefined;
    }),
    onOrientation: vi.fn(() => () => undefined),
    onBattery: vi.fn((cb: (pct: number) => void) => {
      listeners.battery.push(cb);
      return () => undefined;
    }),
    onConnectionChange: vi.fn((cb: (s: ConnectionState) => void) => {
      listeners.connection.push(cb);
      return () => undefined;
    }),
    disconnect: vi.fn(async () => undefined),
    _listeners: listeners,
    ...overrides,
  };
}

const connectCube = vi.fn<typeof RegistryModule.connectCube>();
vi.mock("~/cube/input/bluetooth/registry", async () => {
  const actual = await vi.importActual<typeof RegistryModule>("~/cube/input/bluetooth/registry");
  return { ...actual, connectCube };
});

describe("/connect page", () => {
  beforeEach(() => {
    connectCube.mockReset();
    Object.defineProperty(globalThis.navigator, "bluetooth", { value: {}, configurable: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    // @ts-expect-error -- test cleanup of a property we defined for the test.
    delete globalThis.navigator.bluetooth;
  });

  it("@002-S10 shows a no-Bluetooth message and camera link when unsupported, with no connect button", async () => {
    // @ts-expect-error -- simulating absence.
    delete globalThis.navigator.bluetooth;
    const Page = (await import("./page")).default;
    render(<Page />);
    await waitFor(() => expect(screen.getByTestId("no-bluetooth-message")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Use the camera scanner instead" })).toHaveAttribute("href", "/scan");
    expect(screen.queryByRole("button", { name: "Connect cube" })).not.toBeInTheDocument();
  });

  it("connects and displays device name, battery, and the cube view", async () => {
    const driver = fakeDriver();
    connectCube.mockResolvedValue(driver);
    const Page = (await import("./page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Connect cube" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Connect cube" }));

    await waitFor(() => expect(screen.getByTestId("device-name")).toHaveTextContent("Test Cube"));

    driver._listeners.battery[0]!(73);
    await waitFor(() => expect(screen.getByTestId("battery-level")).toHaveTextContent("73% battery"));
  });

  it("@002-S9 prompts manual calibration for a facelet-less device, and clearing it hides the prompt", async () => {
    const driver = fakeDriver({ capabilities: { facelets: false, moves: true, gyro: false, battery: false } });
    connectCube.mockResolvedValue(driver);
    const Page = (await import("./page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await user.click(await screen.findByRole("button", { name: "Connect cube" }));
    await screen.findByRole("button", { name: "My cube is solved" });
    expect(driver.readFacelets).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "My cube is solved" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "My cube is solved" })).not.toBeInTheDocument());
  });

  it("shows the live-move indicator after a move event", async () => {
    const driver = fakeDriver();
    connectCube.mockResolvedValue(driver);
    const Page = (await import("./page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await user.click(await screen.findByRole("button", { name: "Connect cube" }));
    expect(screen.queryByTestId("live-move-indicator")).not.toBeInTheDocument();

    driver._listeners.move[0]!({ move: "R" as never, deviceTimestamp: 0, receivedAt: 0 });
    await waitFor(() => expect(screen.getByTestId("live-move-indicator")).toBeInTheDocument());
  });

  it("@002-S8 surfaces a manual Reconnect control after three failed backoff attempts", async () => {
    const driver = fakeDriver({ requestDevice: vi.fn(async () => undefined) });
    connectCube.mockResolvedValue(driver);
    const Page = (await import("./page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await user.click(await screen.findByRole("button", { name: "Connect cube" }));
    await waitFor(() => expect(screen.getByTestId("device-name")).toBeInTheDocument());

    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Fail every reconnect attempt from here on.
    (driver.requestDevice as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("still out of range"));
    driver._listeners.connection[0]!("disconnected");

    await vi.advanceTimersByTimeAsync(250 + 1000 + 3000 + 100);

    await vi.waitFor(() => expect(screen.getByTestId("stale-indicator")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeInTheDocument();
  });
});
