import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("defaults to a line icon, not an emoji", () => {
    const { container } = render(<EmptyState title="Nothing" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.textContent).toBe("Nothing");
  });

  it("still renders a string icon", () => {
    const { container } = render(<EmptyState icon="🎉" title="Done" />);
    expect(container.textContent).toContain("🎉");
  });
});
