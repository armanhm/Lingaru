import { StrictMode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { FeedbackPanel } from "./FeedbackPanel";

afterEach(() => vi.useRealTimers());

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

  it("clears the hidden live copy after announcing, so browse mode reads the verdict once", () => {
    vi.useFakeTimers();
    render(
      <FeedbackPanel state="nearly" title="Nearly">
        Check the accent
      </FeedbackPanel>,
    );
    const live = screen.getByRole("status");
    expect(live).toHaveTextContent("Nearly. Check the accent");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(live).toBeEmptyDOMElement();
    expect(screen.getByText("Nearly")).toBeInTheDocument();
  });

  it("does not announce again when the parent re-renders with the same text", () => {
    vi.useFakeTimers();
    const { rerender } = render(<FeedbackPanel title="Correct">Well done</FeedbackPanel>);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    rerender(<FeedbackPanel title="Correct">Well done</FeedbackPanel>);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("clears the live copy under StrictMode's double effect run", () => {
    vi.useFakeTimers();
    render(
      <StrictMode>
        <FeedbackPanel title="Correct">Well done</FeedbackPanel>
      </StrictMode>,
    );
    const live = screen.getByRole("status");
    expect(live).toHaveTextContent("Correct. Well done");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(live).toBeEmptyDOMElement();
  });

  it("re-announces identical text when announceKey changes, then clears", () => {
    vi.useFakeTimers();
    const ui = (key) => (
      <FeedbackPanel title="Correct" announceKey={key}>
        Well done
      </FeedbackPanel>
    );
    const { rerender } = render(ui(1));
    const live = screen.getByRole("status");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(live).toBeEmptyDOMElement();
    rerender(ui(1));
    expect(live).toBeEmptyDOMElement();
    rerender(ui(2));
    expect(live).toHaveTextContent("Correct. Well done");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(live).toBeEmptyDOMElement();
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
