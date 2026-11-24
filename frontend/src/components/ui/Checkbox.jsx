import { forwardRef } from "react";
import { cx } from "./cx";

/**
 * Real `<input type="checkbox">` tinted with the accent colour. The wrapper is
 * a `<label>`, so a tap anywhere in the 44 px box toggles it. With `label` it
 * also shows a visible row label; inside a `Field` leave `label` out and let
 * the Field label it. An invalid state draws an outline.
 */
export const Checkbox = /* @__PURE__ */ forwardRef(function Checkbox(
  { label, className, ...props },
  ref,
) {
  return (
    <label
      className={cx(
        "inline-flex min-h-11 cursor-pointer items-center self-start",
        label ? "gap-3" : "size-11 justify-center",
        props.disabled && "cursor-not-allowed",
      )}
    >
      <input
        ref={ref}
        type="checkbox"
        className={cx(
          "size-5 shrink-0 cursor-pointer accent-accent",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          "aria-invalid:outline-2 aria-invalid:outline-offset-2 aria-invalid:outline-err",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      />
      {label ? <span className="text-body text-fg">{label}</span> : null}
    </label>
  );
});
