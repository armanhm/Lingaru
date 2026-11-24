import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cx } from "./cx";

const BASE =
  "relative inline-flex items-center justify-center gap-2 rounded-xl border font-medium " +
  "whitespace-nowrap select-none cursor-pointer transition-colors duration-150 ease-out " +
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
  "disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:pointer-events-none";

const VARIANTS = {
  primary: "bg-accent text-on-accent border-transparent hover:bg-accent-strong",
  secondary: "bg-card text-fg border-line-strong hover:bg-canvas",
  quiet: "bg-transparent text-fg-2 border-transparent hover:bg-line-soft hover:text-fg",
  danger: "bg-err-bg text-err border-err hover:bg-card",
};

// `sm` is 36 px tall but keeps a 44 px hit area through the ::after overlay.
const SIZES = {
  sm:
    "min-h-9 px-3 text-small after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
  md: "min-h-11 px-4 text-body",
  lg: "min-h-12 px-6 text-body-lg",
};

/**
 * Paper button. `asChild` renders the single child (for example a router
 * Link) with the button classes instead of a `<button>`.
 */
export const Button = /* @__PURE__ */ forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    iconLeft,
    iconRight,
    asChild = false,
    className,
    disabled,
    children,
    type,
    ...rest
  },
  ref,
) {
  const classes = cx(BASE, VARIANTS[variant], SIZES[size], className);

  const inactive = disabled || loading;

  if (asChild) {
    // Icons and the loading spinner are not supported with `asChild`: the
    // child element is rendered as given. `loading` and `disabled` still make
    // it aria-disabled, inert and visually disabled.
    const { onClick, ...slotRest } = rest;
    return (
      <Slot
        ref={ref}
        className={cx(classes, inactive && "opacity-50 pointer-events-none cursor-not-allowed")}
        aria-disabled={inactive ? "true" : undefined}
        aria-busy={loading ? "true" : undefined}
        onClick={(event) => {
          if (inactive) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
        }}
        {...slotRest}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes}
      disabled={inactive}
      aria-busy={loading ? "true" : undefined}
      {...rest}
    >
      {/* Content keeps its space while loading, so the width never changes. */}
      <span className={cx("inline-flex items-center justify-center gap-2", loading && "opacity-0")}>
        {iconLeft}
        {children}
        {iconRight}
      </span>
      {loading && (
        <span className="absolute inset-0 inline-flex items-center justify-center">
          <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        </span>
      )}
    </button>
  );
});
