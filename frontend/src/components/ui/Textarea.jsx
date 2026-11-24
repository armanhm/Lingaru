import { forwardRef } from "react";
import { cx } from "./cx";
import { CONTROL } from "./Input";

/** Paper textarea. `size="lg"` is for learner answers. */
export const Textarea = /* @__PURE__ */ forwardRef(function Textarea(
  { size = "md", className, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx(
        CONTROL,
        "py-2.5 resize-y",
        size === "lg" && "text-body-lg",
        className,
      )}
      {...props}
    />
  );
});
