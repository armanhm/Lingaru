import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import { ToastProvider, useToast } from "./ToastContext";

const holder = { api: null };
function Grab() {
  const toast = useToast();
  useEffect(() => {
    holder.api = toast;
  }, [toast]);
  return null;
}
function setup() {
  render(
    <ToastProvider>
      <Grab />
    </ToastProvider>,
  );
}

describe("ToastContext", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows a toast in a status region and removes it after the duration", () => {
    setup();
    let id;
    act(() => {
      id = holder.api.showToast("Saved");
    });
    expect(typeof id).toBe("number");
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Saved");
    expect(region).toHaveAttribute("aria-live", "polite");
    act(() => vi.advanceTimersByTime(2799));
    expect(screen.getByText("Saved")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("stacks toasts and honours a custom duration", () => {
    setup();
    act(() => {
      holder.api.showToast("One", "info", 1000);
      holder.api.showToast("Two", "info", 3000);
    });
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1001));
    expect(screen.queryByText("One")).not.toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
  });

  it("makes error toasts assertive and keeps them 5 s", () => {
    setup();
    act(() => {
      holder.api.showToast("Boom", "error");
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
    act(() => vi.advanceTimersByTime(4900));
    expect(screen.getByText("Boom")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("Boom")).not.toBeInTheDocument();
  });

  it("dismisses with the close button", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    setup();
    act(() => {
      holder.api.showToast("Bye");
    });
    await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Bye")).not.toBeInTheDocument();
  });
});
