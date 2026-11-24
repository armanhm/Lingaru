import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders a type=button button by default", () => {
    render(<Button>Save</Button>);
    const el = screen.getByRole("button", { name: "Save" });
    expect(el.tagName).toBe("BUTTON");
    expect(el).toHaveAttribute("type", "button");
  });

  it("is busy and disabled while loading", () => {
    render(<Button loading>Save</Button>);
    const el = screen.getByRole("button", { name: "Save" });
    expect(el).toHaveAttribute("aria-busy", "true");
    expect(el).toBeDisabled();
  });

  it("applies the danger variant class", () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole("button")).toHaveClass("text-err");
  });

  it("is at least 44px tall at md", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button")).toHaveClass("min-h-11");
  });

  it("renders the child element with button classes when asChild", () => {
    render(
      <Button asChild>
        <a href="/x">Go</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Go" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveClass("bg-accent");
  });

  it("renders icons beside the label", () => {
    render(
      <Button iconLeft={<svg data-testid="l" />} iconRight={<svg data-testid="r" />}>
        Next
      </Button>,
    );
    expect(screen.getByTestId("l")).toBeInTheDocument();
    expect(screen.getByTestId("r")).toBeInTheDocument();
  });
});

describe("Button loading and asChild states", () => {
  it("keeps the label in the DOM while loading", () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveTextContent("Save");
  });

  it("keeps its accessible name while loading (hidden with opacity, not visibility)", () => {
    render(<Button loading>Continue</Button>);
    const button = screen.getByRole("button", { name: "Continue" });
    const content = screen.getByText("Continue");
    expect(button.querySelector(".invisible")).toBeNull();
    expect(content).toHaveClass("opacity-0");
  });

  it("marks an asChild link aria-disabled and blocks clicks when loading", async () => {
    const onClick = vi.fn();
    render(
      <Button asChild loading onClick={onClick}>
        <a href="#x">Go</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Go" });
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("aria-busy", "true");
    link.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("still calls onClick on an enabled asChild link", () => {
    const onClick = vi.fn((e) => e.preventDefault());
    render(
      <Button asChild onClick={onClick}>
        <a href="#x">Go</a>
      </Button>,
    );
    screen.getByRole("link").click();
    expect(onClick).toHaveBeenCalled();
  });
});
