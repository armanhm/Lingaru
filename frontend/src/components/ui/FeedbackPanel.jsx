import { forwardRef, useEffect, useRef, useState } from "react";
import { cx } from "./cx";

const STATES = {
  correct: { panel: "bg-ok-bg border-ok-line", title: "text-ok" },
  nearly: { panel: "bg-ok-bg border-ok-line", title: "text-ok" },
  wrong: { panel: "bg-err-bg border-err", title: "text-err" },
};
const CLEAR_AFTER_MS = 1500;
const NEUTRAL = { panel: "bg-card border-line", title: "text-fg" };

/**
 * Learning feedback after an answer. The verdict is announced through a
 * visually hidden polite live node whose text is set after mount (a live
 * region that mounts with its text is often silent) and cleared again once
 * announced. `action` is for the
 * Continue button.
 */
export const FeedbackPanel = /* @__PURE__ */ forwardRef(function FeedbackPanel(
  { state = "correct", title, children, action, className, ...props },
  ref,
) {
  const known = Object.hasOwn(STATES, state);
  if (!known && import.meta.env.DEV) {
    console.error(`FeedbackPanel: unknown state "${state}"; use correct, nearly or wrong.`);
  }
  const styles = known ? STATES[state] : NEUTRAL;
  const bodyRef = useRef(null);
  const lastRef = useRef("");
  const timerRef = useRef();
  const [announcement, setAnnouncement] = useState("");

  // `children` is a new element on every parent render, so the effect runs
  // each time and announces only when the text actually changed. The hidden
  // copy is cleared shortly after, so browse mode reads the verdict once
  // (from the visible text), not twice.
  useEffect(() => {
    const body = bodyRef.current?.textContent?.trim();
    const text = [title, body].filter(Boolean).join(". ");
    if (text === lastRef.current) return;
    lastRef.current = text;
    setAnnouncement(text);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAnnouncement(""), CLEAR_AFTER_MS);
  });

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div ref={ref} className={cx("rounded-xl border p-4", styles.panel, className)} {...props}>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <p className={cx("text-h4", styles.title)}>{title}</p>
      {children ? (
        <div ref={bodyRef} className="mt-1 text-body text-fg">
          {children}
        </div>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
});
