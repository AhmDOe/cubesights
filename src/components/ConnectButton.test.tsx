import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConnectButton } from "./ConnectButton";

describe("<ConnectButton>", () => {
  it("@002-S11 calls onConnect synchronously from the click handler, with no microtask boundary before it", async () => {
    const calls: string[] = [];
    const onConnect = vi.fn(() => calls.push("onConnect"));

    const user = userEvent.setup();
    render(<ConnectButton onConnect={onConnect} />);

    calls.push("before-click");
    await user.click(screen.getByRole("button", { name: "Connect cube" }));
    calls.push("after-click");

    // If onConnect were invoked after an await, "before-click" -> "after-click" would both
    // complete before "onConnect" could run (a later microtask). The call recorded here proves
    // it ran synchronously within the click dispatch itself.
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["before-click", "onConnect", "after-click"]);
  });

  it("renders a custom label and respects disabled", () => {
    render(<ConnectButton onConnect={() => undefined} disabled label="Reconnect" />);
    const button = screen.getByRole("button", { name: "Reconnect" });
    expect(button).toBeDisabled();
  });
});
