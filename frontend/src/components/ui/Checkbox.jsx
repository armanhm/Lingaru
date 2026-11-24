import { forwardRef } from "react";
import { cx } from "./cx";

/**
 * Real `<input type="checkbox">` tinted with the accent colour. A 44 px box
 * around it is the touch target; an invalid state draws an outline.
 */
export const Checkbox = /* @__PURE__ */ forwardRef(function Checkbox(
  { className, ...props },
  ref,
) {
  return (
    <span className="inline-flex size-11 items-center justify-center self-start">
      <input
        ref={ref}
        type="checkbox"
        className={cx(
          "size-5 shrink-0 cursor-pointer accent-accent",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
          "aria-invalid:outline-2 aria-invalid:outline-offset-2 aria-invalid:outline-err",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      />
    </span>
  );
});
