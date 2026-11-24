import { useRef } from "react";

// Shared class names for Dialog and Drawer: the only components allowed the
// one soft overlay shadow.
export const OVERLAY =
  "fixed inset-0 z-50 bg-fg/40";
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
