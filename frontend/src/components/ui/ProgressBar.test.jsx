import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("reports the rounded percentage", () => {
    render(<ProgressBar value={0.456} label="Lesson" />);
    const bar = screen.getByRole("progressbar", { name: "Lesson" });
    expect(bar).toHaveAttribute("aria-valuenow", "46");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("clamps out-of-range values", () => {
    const { rerender } = render(<ProgressBar value={3} label="L" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    rerender(<ProgressBar value={-1} label="L" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });
});
