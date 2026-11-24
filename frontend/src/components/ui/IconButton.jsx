import { forwardRef, isValidElement } from "react";
import { cx } from "./cx";

const BASE =
  "relative inline-flex items-center justify-center rounded-full border shrink-0 cursor-pointer " +
  "transition-colors duration-150 ease-out " +
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const VARIANTS = {
  quiet: "bg-transparent text-fg-2 border-transparent hover:bg-canvas hover:text-fg",
  secondary: "bg-card text-fg border-line-strong hover:bg-canvas",
  primary: "bg-accent text-on-accent border-transparent hover:bg-accent-strong",
  danger: "bg-err-bg text-err border-err hover:bg-card",
};

// `sm` is 36 px but keeps a 44 px hit area through the ::after overlay.
const SIZES = {
  sm: "min-h-9 min-w-9 after:absolute after:-inset-1 after:content-['']",
  md: "min-h-11 min-w-11",
  lg: "min-h-12 min-w-12",
};

/** Round, icon-only button. `label` is required: it is the accessible name. */
export const IconButton = /* @__PURE__ */ forwardRef(function IconButton(
  { label, icon, variant = "quiet", size = "md", className, type, ...rest },
  ref,
) {
  if (!label && import.meta.env.DEV) {
    console.error("IconButton requires a `label` prop for its accessible name.");
  }
  const Icon = icon;
  // `icon` is an element, or a component such as a lucide icon.
  const content = isValidElement(icon) ? icon : Icon && <Icon aria-hidden="true" className="size-5" />;

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-label={label}
      className={cx(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {content}
    </button>
  );
});
