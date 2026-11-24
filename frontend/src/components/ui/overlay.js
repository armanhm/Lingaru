import { useRef } from "react";

// Shared class names for Dialog and Drawer: the only components allowed the
// one soft overlay shadow.
export const SCRIM = "bg-[rgb(20_18_15/0.55)]";
export const OVERLAY = `fixed inset-0 z-50 ${SCRIM}`;
export const PANEL =
  "fixed z-50 bg-card border border-line shadow-card-elevated flex flex-col " +
  "focus-visible:outline-hidden";

/**
 * Controlled dialogs have no Radix Trigger, so remember the element that had
 * focus when the dialog opened and give focus back to it on close.
 */
export function useFocusRestore() {
  const opener = useRef(null);
  return {
    onOpenAutoFocus: () => {
      opener.current = document.activeElement;
    },
    onCloseAutoFocus: (event) => {
      const el = opener.current;
      opener.current = null;
      if (el instanceof HTMLElement && el !== document.body && el.isConnected) {
        event.preventDefault();
        el.focus();
      }
    },
  };
}

/**
 * Toasts live outside the dialog, so Radix sees a click on one as an outside
 * interaction. Ignore those: a toast must not close the overlay.
 */
export function ignoreToastInteraction(event) {
  const target = event.detail?.originalEvent?.target ?? event.target;
  if (target instanceof Element && target.closest("[data-paper-toasts]")) {
    event.preventDefault();
  }
}
