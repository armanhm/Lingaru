import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { IconButton } from "./IconButton";

afterEach(() => vi.restoreAllMocks());

describe("IconButton", () => {
  it("renders the label as aria-label", () => {
    render(<IconButton label="Close" icon={<svg />} />);
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("aria-label", "Close");
  });

  it("is at least 44px square at md", () => {
    render(<IconButton label="Close" icon={<svg />} />);
    expect(screen.getByRole("button")).toHaveClass("min-h-11", "min-w-11");
  });

  it("logs a console error when label is missing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<IconButton icon={<svg />} />);
    expect(spy).toHaveBeenCalled();
  });

  it("accepts an icon component", () => {
    const Icon = () => <svg data-testid="ic" />;
    render(<IconButton label="Go" icon={Icon} />);
    expect(screen.getByTestId("ic")).toBeInTheDocument();
  });
});
