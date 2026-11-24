import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SegmentedProgress } from "./SegmentedProgress";

describe("SegmentedProgress", () => {
  const segments = [
    { weight: 3, value: 1 },
    { weight: 10, value: 0.45 },
    { weight: 6, value: 0 },
    { weight: 1, value: 0 },
  ];

  it("is one progressbar with the weighted completion", () => {
    render(<SegmentedProgress segments={segments} label="Session" />);
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    expect(screen.getByRole("progressbar", { name: "Session" })).toHaveAttribute(
      "aria-valuenow",
      "38",
    );
  });

  it("sizes segments by weight and fills by clamped value", () => {
    const { container } = render(
      <SegmentedProgress
        segments={[
          { weight: 3, value: 2 },
          { weight: 1, value: -1 },
        ]}
        label="S"
      />,
    );
    const segs = container.querySelectorAll("[data-segment]");
    expect(segs[0].style.flexGrow).toBe("3");
    expect(segs[1].style.flexGrow).toBe("1");
    expect(segs[0].firstChild.style.width).toBe("100%");
    expect(segs[1].firstChild.style.width).toBe("0%");
  });

  it("handles no weight", () => {
    render(<SegmentedProgress segments={[]} label="S" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });
});
