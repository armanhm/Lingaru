import { createElement } from "react";

/** The one nav icon style: 20 px line icon, decorative (the label names the link). */
export function navIcon(Icon) {
  return createElement(Icon, {
    "aria-hidden": "true",
    size: 20,
    strokeWidth: 1.75,
    className: "shrink-0",
  });
}
