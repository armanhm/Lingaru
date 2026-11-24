import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedbackPanel } from "./FeedbackPanel";

const panelOf = () => screen.getByRole("status").parentElement;

describe("FeedbackPanel", () => {
  it("nearly uses the ok classes", () => {
    render(
      <FeedbackPanel state="nearly" title="Nearly">
        Check the accent
      </FeedbackPanel>,
    );
    expect(panelOf()).toHaveClass("bg-ok-bg", "border-ok-line");
    expect(screen.getByText("Nearly")).toHaveClass("text-ok");
    expect(screen.getByText("Check the accent")).toHaveClass("text-fg");
  });

  it("sets the announced text in the polite live node after mount", () => {
    render(
      <FeedbackPanel state="nearly" title="Nearly">
        Check the accent
      </FeedbackPanel>,
    );
    const live = screen.getByRole("status");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveTextContent("Nearly. Check the accent");
  });

  it("correct uses the ok classes", () => {
    render(<FeedbackPanel title="Correct" />);
    expect(panelOf()).toHaveClass("bg-ok-bg");
  });

  it("wrong uses the err classes and renders the action", () => {
    render(
      <FeedbackPanel state="wrong" title="Not quite" action={<button>Continue</button>}>
        body
      </FeedbackPanel>,
    );
    expect(panelOf()).toHaveClass("bg-err-bg", "border-err");
    expect(screen.getByText("Not quite")).toHaveClass("text-err");
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("renders a neutral panel and logs for an unknown state", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<FeedbackPanel state="bogus" title="Hmm" />);
    expect(panelOf()).toHaveClass("bg-card", "border-line");
    expect(panelOf()).not.toHaveClass("bg-ok-bg");
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
