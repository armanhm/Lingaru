import { describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("toggles when the 44 px wrapper is clicked, not only the 20 px box", async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="Agree" />);
    const box = screen.getByRole("checkbox", { name: "Agree" });
    const wrapper = box.closest("label");
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveClass("size-11");
    await user.click(wrapper);
    expect(box).toBeChecked();
    await user.click(wrapper);
    expect(box).not.toBeChecked();
  });

  it("with `label` renders a visible label that names and toggles the box", async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Remind me daily" />);
    const box = screen.getByRole("checkbox", { name: "Remind me daily" });
    await user.click(screen.getByText("Remind me daily"));
    expect(box).toBeChecked();
  });

  it("uses an outline focus indicator, not a box-shadow ring", () => {
    render(<Checkbox aria-label="Agree" />);
    const box = screen.getByRole("checkbox");
    expect(box).toHaveClass("focus-visible:outline-2", "focus-visible:outline-accent");
    expect(box.className).not.toMatch(/focus-visible:ring/);
  });
});
