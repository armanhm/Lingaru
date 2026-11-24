import { forwardRef } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { cx } from "./cx";

export const Tabs = RadixTabs.Root;

export const TabsList = /* @__PURE__ */ forwardRef(function TabsList({ className, ...props }, ref) {
  return (
    <RadixTabs.List
      ref={ref}
      className={cx("flex gap-1 overflow-x-auto border-b border-line", className)}
      {...props}
    />
  );
});

export const TabsTrigger = /* @__PURE__ */ forwardRef(function TabsTrigger(
  { className, ...props },
  ref,
) {
  return (
    <RadixTabs.Trigger
      ref={ref}
      className={cx(
        "-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-2 border-transparent px-4 " +
          "text-body font-medium text-fg-2 cursor-pointer transition-colors duration-150 ease-out " +
          "hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg " +
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent " +
          "focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded-t-lg",
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
