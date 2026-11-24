import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { Field } from "./Field";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Select } from "./Select";
import { Checkbox } from "./Checkbox";
import { Switch } from "./Switch";

describe("Field", () => {
  it("labels the input it wraps", () => {
    render(
      <Field label="Email">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("uses a given id for the label association", () => {
    render(
      <Field id="mail" label="Email">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute("id", "mail");
  });

  it("links the error and marks the input invalid", () => {
    render(
      <Field label="Email" error="Required">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const ids = input.getAttribute("aria-describedby").split(" ");
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toContain("Required");
    expect(input).toHaveClass("border-err");
  });

  it("links the hint and is valid without an error", () => {
    render(
      <Field label="Email" hint="We never share it">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(document.getElementById(input.getAttribute("aria-describedby"))).toHaveTextContent(
      "We never share it",
    );
  });

  it("works with Textarea, Select and Checkbox", () => {
    render(
      <>
        <Field label="Answer">
          <Textarea size="lg" />
        </Field>
        <Field label="Level">
          <Select>
            <option>A1</option>
          </Select>
        </Field>
        <Field label="Remember me">
          <Checkbox />
        </Field>
      </>,
    );
    expect(screen.getByLabelText("Answer")).toHaveClass("text-body-lg");
    expect(screen.getByLabelText("Level").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Remember me")).toHaveAttribute("type", "checkbox");
  });

  it("works with Switch (button role=switch)", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Field label="Reminders">
        <Switch checked={false} onCheckedChange={onCheckedChange} />
      </Field>,
    );
    const sw = screen.getByLabelText("Reminders");
    expect(sw).toHaveAttribute("role", "switch");
    await user.click(screen.getByText("Reminders"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe("Switch", () => {
  it("toggles with Space and calls onCheckedChange(true)", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} label="Dark" />);
    await user.tab();
    expect(screen.getByRole("switch", { name: "Dark" })).toHaveFocus();
    await user.keyboard(" ");
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
