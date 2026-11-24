import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renders a bordered div with md padding by default", () => {
    render(<Card data-testid="c">x</Card>);
    const el = screen.getByTestId("c");
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveClass("bg-card", "border-line", "p-5");
  });

  it("supports as, padding and none", () => {
    render(
      <Card as="section" padding="none" data-testid="c">
        x
      </Card>,
    );
    const el = screen.getByTestId("c");
    expect(el.tagName).toBe("SECTION");
    expect(el).not.toHaveClass("p-5");
  });

  it("adds a focus-visible ring when interactive", () => {
    render(
      <Card interactive data-testid="c">
        x
      </Card>,
    );
    expect(screen.getByTestId("c")).toHaveClass("focus-visible:ring-2");
  });
});
