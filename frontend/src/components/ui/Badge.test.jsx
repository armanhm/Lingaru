import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it.each([
    ["neutral", "text-fg-2"],
    ["accent", "text-accent"],
    ["ok", "text-ok"],
    ["err", "text-err"],
    ["warn", "text-warn"],
  ])("renders the %s tone", (tone, cls) => {
    render(<Badge tone={tone}>label</Badge>);
    expect(screen.getByText("label")).toHaveClass(cls);
  });

  it("defaults to neutral", () => {
    render(<Badge>label</Badge>);
    expect(screen.getByText("label")).toHaveClass("text-fg-2");
  });
});
