import { forwardRef } from "react";
import { clamp01 } from "./clamp01";
import { cx } from "./cx";


/** Thin Paper progress bar. `value` is 0..1. */
export const ProgressBar = /* @__PURE__ */ forwardRef(function ProgressBar(
  { value, label, className, ...props },
  ref,
) {
  const v = clamp01(value);
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={cx("h-2 w-full overflow-hidden rounded-full bg-line-soft", className)}
      {...props}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out motion-reduce:transition-none"
        style={{ width: `${v * 100}%` }}
      />
    </div>
  );
});
