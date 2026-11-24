import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import { Dialog } from "./Dialog";
import { Drawer } from "./Drawer";

describe("Dialog", () => {
  it("moves focus inside and Escape calls onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange} title="Delete deck" description="This is final">
        <button>Inside</button>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Delete deck" });
    expect(dialog).toContainElement(document.activeElement);
    expect(dialog).toHaveAccessibleDescription("This is final");
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders the footer and closes on overlay click", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange} title="T" footer={<button>Confirm</button>}>
        body
      </Dialog>,
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    await user.click(document.querySelector("[data-paper-overlay]"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("restores focus to the trigger on close", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <Dialog open={open} onOpenChange={setOpen} title="T">
            x
          </Dialog>
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe("Drawer", () => {
  it("is a named dialog; bottom is a rounded sheet, right is a panel", () => {
    const { rerender } = render(
      <Drawer open onOpenChange={() => {}} title="Filters">
        x
      </Drawer>,
    );
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    expect(sheet).toHaveClass("rounded-t-2xl", "bottom-0");
    rerender(
      <Drawer open onOpenChange={() => {}} title="Filters" side="right">
        x
      </Drawer>,
    );
    expect(screen.getByRole("dialog", { name: "Filters" })).toHaveClass("right-0", "h-full");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Drawer open onOpenChange={onOpenChange} title="Filters">
        <button>a</button>
      </Drawer>,
    );
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("Dialog with toasts", () => {
  it("does not close when a toast is clicked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onOpenChange = vi.fn();
    render(
      <>
        <div data-paper-toasts="">
          <button>Dismiss notification</button>
        </div>
        <Dialog open onOpenChange={onOpenChange} title="T">
          x
        </Dialog>
      </>,
    );
    await user.click(screen.getByText("Dismiss notification"));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
