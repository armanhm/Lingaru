import { forwardRef } from "react";
import { cx } from "./cx";

export const CONTROL =
  "w-full min-h-11 rounded-xl border bg-card text-fg border-line-strong px-3 text-body " +
  "placeholder:text-fg-3 transition-colors duration-150 ease-out " +
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
  "aria-invalid:border-err disabled:opacity-50 disabled:cursor-not-allowed";

/** Paper text input. 16 px text, so iOS does not zoom on focus. */
export const Input = /* @__PURE__ */ forwardRef(function Input(
  { className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cx(CONTROL, "py-2", className)}
      {...props}
    />
  );
});
