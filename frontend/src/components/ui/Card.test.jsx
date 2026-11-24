import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
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
});

describe("Card interactive", () => {
  it("renders a focusable button with the ring class", async () => {
    const user = userEvent.setup();
    render(
      <Card as="button" interactive>
        x
      </Card>,
    );
    const el = screen.getByRole("button");
    expect(el).toHaveAttribute("type", "button");
    expect(el).toHaveClass("focus-visible:ring-2");
    await user.tab();
    expect(el).toHaveFocus();
  });

  it("logs an error and adds no ring on a div", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Card interactive data-testid="c">
        x
      </Card>,
    );
    expect(spy).toHaveBeenCalled();
    expect(screen.getByTestId("c")).not.toHaveClass("focus-visible:ring-2");
    spy.mockRestore();
  });
});
