import { forwardRef, useId } from "react";
import * as RadixSwitch from "@radix-ui/react-switch";
import { cx } from "./cx";

/**
 * Paper switch (Radix). With `label` it renders its own visible label; inside
 * a `Field` leave `label` out and let the Field label it.
 */
export const Switch = /* @__PURE__ */ forwardRef(function Switch(
  { checked, onCheckedChange, label, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const switchId = id ?? autoId;

  const root = (
    <RadixSwitch.Root
      ref={ref}
      id={switchId}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cx(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-line-strong",
        "bg-canvas transition-colors duration-150 ease-out motion-reduce:transition-none",
        "data-[state=checked]:bg-accent data-[state=checked]:border-transparent",
        "after:absolute after:-inset-y-2 after:inset-x-0 after:content-['']",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        "aria-invalid:border-err disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      <RadixSwitch.Thumb
        className={cx(
          "block size-5 translate-x-1 rounded-full bg-fg-3 transition-transform duration-150 ease-out",
          "motion-reduce:transition-none data-[state=checked]:translate-x-6 data-[state=checked]:bg-on-accent",
        )}
      />
    </RadixSwitch.Root>
  );

  if (!label) return root;
  return (
    <span className="inline-flex min-h-11 items-center gap-3">
      {root}
      <label htmlFor={switchId} className="text-body text-fg cursor-pointer">
        {label}
      </label>
    </span>
  );
});
