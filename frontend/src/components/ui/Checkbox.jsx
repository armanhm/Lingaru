import { forwardRef } from "react";
import { cx } from "./cx";

/**
 * Native checkbox with Paper colours. The input is 20 px; a pseudo-element
 * extends its hit area to 44 px.
 */
export const Checkbox = /* @__PURE__ */ forwardRef(function Checkbox(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cx(
        "relative size-5 shrink-0 cursor-pointer rounded-md border border-line-strong bg-card accent-accent",
        "after:absolute after:-inset-3 after:content-['']",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        "aria-invalid:border-err disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
});
