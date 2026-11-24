import { forwardRef } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "./cx";
import { OVERLAY, PANEL, useFocusRestore, ignoreToastInteraction } from "./overlay";
import { CLOSE_BUTTON } from "./Dialog";

const SIDES = {
  bottom: "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-b-0 p-6",
  right: "right-0 top-0 h-full w-full max-w-md rounded-l-2xl border-r-0 p-6",
};

/**
 * Edge-attached panel. `side="bottom"` is the phone sheet (internal scroll),
 * `side="right"` the desktop panel. `closeLabel` overrides the translated
 * name of the close button.
 */
export const Drawer = /* @__PURE__ */ forwardRef(function Drawer(
  { open, onOpenChange, title, description, side = "bottom", children, className, closeLabel },
  ref,
) {
  const { t } = useTranslation();
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
          className={cx(PANEL, SIDES[side], className)}
        >
          <RadixDialog.Title className="pr-10 text-h3 text-fg">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="mt-2 text-body text-fg-2">
              {description}
            </RadixDialog.Description>
          ) : null}
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto text-body text-fg">{children}</div>
          <RadixDialog.Close className={CLOSE_BUTTON} aria-label={closeLabel ?? t("common.close")}>
            <X aria-hidden="true" className="size-5" />
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
});
