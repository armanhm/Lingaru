import { forwardRef } from "react";
import { cx } from "./cx";

const STATES = {
  correct: { panel: "bg-ok-bg border-ok-line", title: "text-ok" },
  nearly: { panel: "bg-ok-bg border-ok-line", title: "text-ok" },
  wrong: { panel: "bg-err-bg border-err", title: "text-err" },
};

/**
 * Learning feedback after an answer. A polite live region, so the verdict is
 * announced without stealing focus. `action` is for the Continue button.
 */
export const FeedbackPanel = /* @__PURE__ */ forwardRef(function FeedbackPanel(
  { state = "correct", title, children, action, className, ...props },
  ref,
) {
  const styles = STATES[state] ?? STATES.correct;
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={cx("rounded-xl border p-4", styles.panel, className)}
      {...props}
    >
      <p className={cx("text-h4", styles.title)}>{title}</p>
      {children ? <div className="mt-1 text-body text-fg">{children}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
});
