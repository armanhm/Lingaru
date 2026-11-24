import { forwardRef } from "react";
import { cx } from "./cx";

const PADDING = { none: "", md: "p-5", lg: "p-8" };

const INTERACTIVE =
  "cursor-pointer transition-colors duration-150 ease-out hover:border-line-strong " +
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

/**
 * Flat Paper card: depth comes from the border, never a shadow.
 * `interactive` is only valid on natively focusable elements: use
 * `as="button"` or `as="a"`.
 */
export const Card = /* @__PURE__ */ forwardRef(function Card(
  { as: Tag = "div", padding = "md", interactive = false, className, type, ...props },
  ref,
) {
  const focusable = Tag === "button" || Tag === "a";
  if (interactive && !focusable && import.meta.env.DEV) {
    console.error('Card `interactive` requires as="button" or as="a"; a div cannot take focus.');
  }
  const extra = Tag === "button" ? { type: type ?? "button" } : type ? { type } : {};
  return (
    <Tag
      ref={ref}
      className={cx(
        "bg-card border border-line rounded-2xl",
        PADDING[padding],
        interactive && focusable && INTERACTIVE,
        Tag === "button" && "text-left w-full",
        className,
      )}
      {...extra}
      {...props}
    />
  );
});
