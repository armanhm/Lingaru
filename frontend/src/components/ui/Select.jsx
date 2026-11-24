import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "./cx";
import { CONTROL } from "./Input";

/** Paper select: a native `<select>` with a custom chevron. */
export const Select = /* @__PURE__ */ forwardRef(function Select(
  { className, wrapperClassName, children, ...props },
  ref,
) {
  return (
    <span className={cx("relative block", wrapperClassName)}>
      <select
        ref={ref}
        className={cx(
          CONTROL,
          "appearance-none py-2 pr-10 cursor-pointer",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-3"
      />
    </span>
  );
});
