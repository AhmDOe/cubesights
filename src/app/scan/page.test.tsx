import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/components/CubeView", () => ({
  CubeView: () => <div data-testid="cube-view" />,
}));

function mockGetUserMedia(impl: () => Promise<MediaStream>) {
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn(impl) },
    configurable: true,
  });
}

function fakeStream(): MediaStream {
  return {
    getTracks: () => [{ stop: vi.fn() }],
  } as unknown as MediaStream;
}

describe("/scan page", () => {
  afterEach(() => {
    // @ts-expect-error -- test cleanup of a property we defined for the test.
    delete globalThis.navigator.mediaDevices;
    document.dispatchEvent(new Event("visibilitychange"));
  });

  it("shows an unsupported message with a smart-cube alternative when getUserMedia doesn't exist", async () => {
    // @ts-expect-error -- simulating absence.
    delete globalThis.navigator.mediaDevices;
    const Page = (await import("./page")).default;
    render(<Page />);
    await waitFor(() => expect(screen.getByTestId("unsupported-message")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Connect a smart cube instead" })).toHaveAttribute("href", "/connect");
  });

  it("@003-S11 explains permission denial and offers manual entry and smart-cube alternatives", async () => {
    mockGetUserMedia(() => Promise.reject(new DOMException("denied", "NotAllowedError")));
    const Page = (await import("./page")).default;
    render(<Page />);

    await waitFor(() => expect(screen.getByTestId("scan-error-message")).toHaveTextContent(/blocked/i));
    expect(screen.getByTestId("scan-error-alternatives")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect a smart cube instead" })).toHaveAttribute("href", "/connect");
    expect(screen.getByRole("button", { name: "Enter colours manually" })).toBeInTheDocument();
  });

  it("@003-S12 distinguishes no-camera from permission denial", async () => {
    mockGetUserMedia(() => Promise.reject(new DOMException("none", "NotFoundError")));
    const Page = (await import("./page")).default;
    render(<Page />);

    await waitFor(() => expect(screen.getByTestId("scan-error-message")).toHaveTextContent(/no camera/i));
    expect(screen.getByTestId("scan-error-message")).not.toHaveTextContent(/blocked/i);
  });

  it("gives a distinct message for an over-constrained request", async () => {
    mockGetUserMedia(() => Promise.reject(new DOMException("bad constraints", "OverconstrainedError")));
    const Page = (await import("./page")).default;
    render(<Page />);

    await waitFor(() => expect(screen.getByTestId("scan-error-message")).toHaveTextContent(/doesn't support/i));
  });

  it("gives a distinct message for a generic hardware failure", async () => {
    mockGetUserMedia(() => Promise.reject(new DOMException("busy", "NotReadableError")));
    const Page = (await import("./page")).default;
    render(<Page />);

    await waitFor(() => expect(screen.getByTestId("scan-error-message")).toHaveTextContent(/in use by another app/i));
  });

  it("opens the manual-entry correction net from the error screen", async () => {
    mockGetUserMedia(() => Promise.reject(new DOMException("denied", "NotAllowedError")));
    const Page = (await import("./page")).default;
    render(<Page />);

    await screen.findByRole("button", { name: "Enter colours manually" });
    screen.getByRole("button", { name: "Enter colours manually" }).click();

    await waitFor(() => expect(screen.getByTestId("correction-net")).toBeInTheDocument());
  });

  it("starts a live video preview once permission is granted", async () => {
    mockGetUserMedia(() => Promise.resolve(fakeStream()));
    const Page = (await import("./page")).default;
    render(<Page />);

    await waitFor(() => expect(screen.getByTestId("scan-video")).toBeInTheDocument());
    expect(screen.getByTestId("scan-overlay")).toBeInTheDocument();
  });

  describe("@003-S17 visibility-change teardown/restart", () => {
    it("stops all tracks when the tab is hidden", async () => {
      const stop = vi.fn();
      const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
      mockGetUserMedia(() => Promise.resolve(stream));
      const Page = (await import("./page")).default;
      render(<Page />);
      await waitFor(() => expect(screen.getByTestId("scan-video")).toBeInTheDocument());

      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(stop).toHaveBeenCalled();
    });

    it("requests the camera again when the tab becomes visible while scanning", async () => {
      const getUserMedia = vi.fn(() => Promise.resolve(fakeStream()));
      Object.defineProperty(globalThis.navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
      const Page = (await import("./page")).default;
      render(<Page />);
      await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));

      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));

      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));

      await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    });
  });

  afterEach(() => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });
});
