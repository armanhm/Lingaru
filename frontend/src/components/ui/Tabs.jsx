import { forwardRef } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { cx } from "./cx";

export const Tabs = RadixTabs.Root;

export const TabsList = /* @__PURE__ */ forwardRef(function TabsList({ className, ...props }, ref) {
  return (
    <RadixTabs.List
      ref={ref}
      className={cx("flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line", className)}
      {...props}
    />
  );
});

// The list clips vertically (horizontal scroll only), so the trigger ring is
// drawn inset: it stays fully visible inside the clip.
export const TabsTrigger = /* @__PURE__ */ forwardRef(function TabsTrigger(
  { className, ...props },
  ref,
) {
  return (
    <RadixTabs.Trigger
      ref={ref}
      className={cx(
        "relative inline-flex min-h-11 items-center whitespace-nowrap px-4 " +
          "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent after:content-[''] " +
          "text-body font-medium text-fg-2 cursor-pointer transition-colors duration-150 ease-out " +
          "hover:text-fg data-[state=active]:after:bg-accent data-[state=active]:text-fg " +
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent rounded-t-lg",
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = /* @__PURE__ */ forwardRef(function TabsContent(
  { className, ...props },
  ref,
) {
  return (
    <RadixTabs.Content
      ref={ref}
      className={cx(
        "pt-4 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent " +
          "focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded-lg",
        className,
      )}
      {...props}
    />
  );
});
