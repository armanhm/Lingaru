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
  quiet: "bg-transparent text-fg-2 border-transparent hover:bg-canvas hover:text-fg",
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

  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...rest}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading ? "true" : undefined}
      {...rest}
    >
      {loading ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
      ) : (
        iconLeft
      )}
      {children}
      {!loading && iconRight}
    </button>
  );
});
