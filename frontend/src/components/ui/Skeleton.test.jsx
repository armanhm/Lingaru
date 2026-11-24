import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton, SkeletonCard, SkeletonCircle } from "./Skeleton";

describe("Skeleton radius", () => {
  it("defaults to rounded-lg", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("rounded-lg");
  });

  it("card is rounded-2xl only", () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstChild).toHaveClass("rounded-2xl");
    expect(container.firstChild).not.toHaveClass("rounded-lg");
  });

  it("circle is rounded-full only", () => {
    const { container } = render(<SkeletonCircle />);
    expect(container.firstChild).toHaveClass("rounded-full");
    expect(container.firstChild).not.toHaveClass("rounded-lg");
  });
});
