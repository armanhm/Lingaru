import { forwardRef } from "react";
import { cx } from "./cx";
import { clamp01 } from "./clamp01";

/**
 * One progressbar made of blocks: each segment is as wide as its `weight`
 * and filled to its `value` (0..1). `aria-valuenow` is the weighted
 * completion across all segments.
 */
export const SegmentedProgress = /* @__PURE__ */ forwardRef(function SegmentedProgress(
  { segments, label, className, ...props },
  ref,
) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.weight), 0);
  const done = segments.reduce((sum, s) => sum + Math.max(0, s.weight) * clamp01(s.value), 0);
  const now = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={now}
      className={cx("flex h-2 w-full gap-1", className)}
      {...props}
    >
      {segments.map((s, i) => (
        <div
          key={i}
          data-segment=""
          className="h-full min-w-0 basis-0 overflow-hidden rounded-full bg-line-soft"
          style={{ flexGrow: Math.max(0, s.weight) }}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out motion-reduce:transition-none"
            style={{ width: `${clamp01(s.value) * 100}%` }}
          />
        </div>
      ))}
    </div>
  );
});
