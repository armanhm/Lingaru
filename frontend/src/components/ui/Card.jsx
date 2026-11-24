import { forwardRef } from "react";
import { cx } from "./cx";

const PADDING = { none: "", md: "p-5", lg: "p-8" };

const INTERACTIVE =
  "cursor-pointer transition-colors duration-150 ease-out hover:border-line-strong " +
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

/** Flat Paper card: depth comes from the border, never a shadow. */
export const Card = /* @__PURE__ */ forwardRef(function Card(
  { as: Tag = "div", padding = "md", interactive = false, className, ...props },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={cx(
        "bg-card border border-line rounded-2xl",
        PADDING[padding],
        interactive && INTERACTIVE,
        className,
      )}
      {...props}
    />
  );
});
