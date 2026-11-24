import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedbackPanel } from "./FeedbackPanel";

describe("FeedbackPanel", () => {
  it("nearly uses the ok classes and is a polite status", () => {
    render(
      <FeedbackPanel state="nearly" title="Nearly">
        Check the accent
      </FeedbackPanel>,
    );
    const panel = screen.getByRole("status");
    expect(panel).toHaveAttribute("aria-live", "polite");
    expect(panel).toHaveClass("bg-ok-bg", "border-ok-line");
    expect(screen.getByText("Nearly")).toHaveClass("text-ok");
    expect(screen.getByText("Check the accent")).toHaveClass("text-fg");
  });

  it("correct uses the ok classes", () => {
    render(<FeedbackPanel title="Correct" />);
    expect(screen.getByRole("status")).toHaveClass("bg-ok-bg");
  });

  it("wrong uses the err classes and renders the action", () => {
    render(
      <FeedbackPanel state="wrong" title="Not quite" action={<button>Continue</button>}>
        body
      </FeedbackPanel>,
    );
    const panel = screen.getByRole("status");
    expect(panel).toHaveClass("bg-err-bg", "border-err");
    expect(screen.getByText("Not quite")).toHaveClass("text-err");
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });
});
