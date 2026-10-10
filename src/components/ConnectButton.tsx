"use client";

/**
 * ConnectButton (002-R9): a single primary action whose onClick calls onConnect synchronously —
 * no logic before it — so the caller's requestDevice() call stays inside the user-gesture
 * activation window (@002-S11). Kept as its own tiny component precisely so this contract is
 * easy to verify in isolation.
 */
export interface ConnectButtonProps {
  readonly onConnect: () => void;
  readonly disabled?: boolean;
  readonly label?: string;
}

export function ConnectButton({ onConnect, disabled, label = "Connect cube" }: ConnectButtonProps) {
  return (
    <button
      type="button"
      onClick={onConnect}
      disabled={disabled}
      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold disabled:opacity-40"
    >
      {label}
    </button>
  );
}
