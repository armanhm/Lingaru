import { forwardRef } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cx } from "./cx";
import { OVERLAY, PANEL, useFocusRestore, ignoreToastInteraction } from "./overlay";

export const CLOSE_BUTTON =
  "absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-full text-fg-2 " +
  "transition-colors duration-150 ease-out hover:bg-canvas hover:text-fg " +
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/**
 * Centered modal. Radix handles focus trap, Escape, overlay click, focus
 * restore and scroll lock. `title` is the accessible name.
 */
export const Dialog = /* @__PURE__ */ forwardRef(function Dialog(
  { open, onOpenChange, title, description, children, footer, className },
  ref,
) {
  const focus = useFocusRestore();
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay data-paper-overlay="" className={OVERLAY} />
        <RadixDialog.Content
          ref={ref}
          {...focus}
          onInteractOutside={ignoreToastInteraction}
          
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cx(
            PANEL,
            "left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6",
            className,
          )}
        >
          <RadixDialog.Title className="pr-10 text-h3 text-fg">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="mt-2 text-body text-fg-2">
              {description}
            </RadixDialog.Description>
          ) : null}
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto text-body text-fg">{children}</div>
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
          <RadixDialog.Close className={CLOSE_BUTTON} aria-label="Close">
            <X aria-hidden="true" className="size-5" />
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
});
